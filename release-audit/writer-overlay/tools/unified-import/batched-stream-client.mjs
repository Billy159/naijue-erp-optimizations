import {requestHash} from '../../packages/application/src/request-hash.ts';

function committed(found, batch) {
  if (found.state !== 'COMMITTED') return false;
  if (found.subBatchId !== batch.subBatchId || found.descriptorSha256 !== batch.descriptorSha256) {
    throw Error('BATCH_COMMITTED_IDENTITY_CONFLICT');
  }
  return true;
}

async function acknowledge(client, sql, command) {
  const reply = await client.query(sql);
  if (reply?.command !== command) throw Error('BATCH_TRANSACTION_ACK_INVALID');
}

// D1 owns these concrete kernel methods and their SQL. lockAndInspect must
// serialize competing writers, verify root/version/predecessor, and read the
// durable receipt. complete writes that receipt in this business transaction.
// No local flag or old whole-package pending receipt is used as commit proof.
export async function executeBatchedStreamImport(plan, openClient, createKernel, {borrowedClient = false, progress} = {}) {
  const identity = Object.freeze({...structuredClone(plan.metadata.identity), rootOperationId: plan.metadata.rootOperationId});
  // A private optional observer never changes a transaction or its outcome.
  const observe = event => {
    if (typeof progress !== 'function') return;
    try { const pending = progress(Object.freeze(event)); if (pending?.then) Promise.resolve(pending).catch(() => {}); } catch {}
  };
  let completedBatches = 0;
  let skippedBatches = 0;
  let finalSummary = null;
  for (const incoming of plan.batches()) {
    const batch = Object.freeze(structuredClone(incoming));
    const emit = (stage, queryClass = 'NONE', acknowledged = false, stepOrdinal = null) => observe({
      stage, queryClass, acknowledged, stepOrdinal, phase: batch.phase, groupOrdinal: batch.ordinal,
      descriptorSha256: batch.descriptorSha256, completedBatches, skippedBatches,
    });
    emit('DESCRIPTOR_CHECK');
    const {descriptorSha256, ...descriptor} = batch;
    if (requestHash({identity, descriptor}) !== descriptorSha256) throw Error('BATCH_DESCRIPTOR_CHANGED');
    let client;
    let began = false;
    let commitAttempted = false;
    let inspectedAbsent = false;
    let reusable = false;
    let existing = false;
    let stage = 'OPEN';
    try {
      emit('OPEN');
      client = await openClient();
      emit('OPEN_ACK', 'NONE', true);
      const kernel = createKernel();
      stage = 'BEGIN';
      emit('BEGIN', 'BEGIN');
      await acknowledge(client, 'BEGIN ISOLATION LEVEL READ COMMITTED', 'BEGIN');
      emit('BEGIN_ACK', 'BEGIN', true);
      began = true;
      stage = 'INSPECT';
      emit('INSPECT', 'INSPECT');
      const found = await kernel.lockAndInspect(client, identity, batch);
      emit('INSPECT_ACK', 'INSPECT', true);
      existing = committed(found, batch);
      if (existing) emit('COMMITTED_MATCH', 'INSPECT', true);
      if (!existing) {
        if (found.state !== 'ABSENT') throw Error('BATCH_STATE_UNRESOLVED');
        inspectedAbsent = true;
        stage = 'APPLY';
        let ordinal = batch.first;
        for await (const step of plan.steps(batch)) {
          emit('APPLY', 'APPLY', false, ordinal);
          const appliedOrdinal = ordinal;
          await kernel.applyStep(client, identity, batch, step, ordinal++);
          emit('APPLY_ACK', 'APPLY', true, appliedOrdinal);
        }
        if (ordinal !== batch.last + 1) throw Error('BATCH_PLAN_RANGE_INCOMPLETE');
        // D1 performs phase-specific verification and writes both business
        // changes and this batch's success receipt before the single COMMIT.
        stage = 'COMPLETE';
        emit('COMPLETE', 'COMPLETE');
        const finished = await kernel.complete(client, identity, batch);
        emit('COMPLETE_ACK', 'COMPLETE', true);
        if (finished.subBatchId !== batch.subBatchId || finished.descriptorSha256 !== batch.descriptorSha256) {
          throw Error('BATCH_COMPLETE_IDENTITY_CONFLICT');
        }
        if (batch.phase === 'FINALIZE') {
          if (finished.summary === null || typeof finished.summary !== 'object') throw Error('BATCH_FINAL_SUMMARY_MISSING');
          finalSummary = finished.summary;
        }
        stage = 'CONSTRAINTS';
        emit('CONSTRAINTS', 'CONSTRAINTS');
        await acknowledge(client, 'SET CONSTRAINTS ALL IMMEDIATE', 'SET');
        emit('CONSTRAINTS_ACK', 'CONSTRAINTS', true);
      } else if (batch.phase === 'FINALIZE') {
        if (found.summary === null || typeof found.summary !== 'object') throw Error('BATCH_FINAL_SUMMARY_MISSING');
        finalSummary = found.summary;
      }
      stage = 'COMMIT';
      commitAttempted = true;
      emit('COMMIT_ATTEMPT', 'COMMIT');
      await acknowledge(client, 'COMMIT', 'COMMIT');
      emit('COMMIT_ACK', 'COMMIT', true);
      began = false;
      reusable = true;
      if (existing) skippedBatches++;
      else completedBatches++;
    } catch (error) {
      emit(commitAttempted ? 'COMMIT_UNCONFIRMED' : 'TRANSACTION_UNCONFIRMED');
      if (began && !commitAttempted) {
        try {
          emit('ROLLBACK', 'ROLLBACK');
          await acknowledge(client, 'ROLLBACK', 'ROLLBACK');
          emit('ROLLBACK_ACK', 'ROLLBACK', true);
          reusable = inspectedAbsent;
          // Rolling back this read transaction says nothing about a previous
          // writer's uncertain COMMIT. Only a locked ABSENT permits ROLLED_BACK.
          return {state: inspectedAbsent ? 'ROLLED_BACK' : 'UNKNOWN', subBatchId: batch.subBatchId, stage,
            completedBatches, skippedBatches, businessReady: false};
        } catch {}
      }
      // End this invocation. Resumption opens a new connection and asks D1's
      // lockAndInspect with this same immutable key before reading its steps.
      return {state: 'UNKNOWN', subBatchId: batch.subBatchId, stage,
        completedBatches, skippedBatches, businessReady: false};
    } finally {
      if (client && (!borrowedClient || !reusable)) try {
        emit('DISCARD'); await client.discard(); emit('DISCARD_ACK', 'NONE', true);
      } catch { emit('DISCARD_UNCONFIRMED'); }
    }
  }
  if (completedBatches + skippedBatches !== plan.metadata.batchCount || finalSummary === null) {
    throw Error('BATCH_ROOT_INCOMPLETE');
  }
  return {state: 'COMPLETED', completedBatches, skippedBatches, summary: finalSummary,
    businessReady: false};
}
