/** Fixed final-source preparation and persisted-plan consumption; no issuer. */
import {createHash} from 'node:crypto';
import {constants,fstatSync,openSync,writeSync,lstatSync,ftruncateSync,fsyncSync,closeSync} from 'node:fs';
import {open,lstat,realpath} from 'node:fs/promises';
import {dirname,relative,resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual as equal,types} from 'node:util';
import {AssertionError} from 'node:assert';


// Closed diagnostic values only: never emit arbitrary message, stack, path or error properties.
const FAILURE_STAGES=Object.freeze(['PREFLIGHT','BIND_INPUTS','PREPARE_READERS','PREPARE_CALL','PREPARE_RESULT','EXECUTION_BINDING','WRITER_SCOPE','WRITER_CALL','WRITER_READBACK']);
const FAILURE_SYSTEM_CODES=Object.freeze(['ERR_ASSERTION','ERR_INVALID_ARG_TYPE','ERR_INVALID_ARG_VALUE','ERR_OUT_OF_RANGE','ERR_MODULE_NOT_FOUND','ERR_UNKNOWN_FILE_EXTENSION','ERR_ACCESS_DENIED','EACCES','EPERM','ENOENT','ELOOP','ENOTDIR','ECONNREFUSED','ECONNRESET','ETIMEDOUT','EPIPE','EHOSTUNREACH','ENETUNREACH','EADDRINUSE']);
const FAILURE_SQLSTATES=Object.freeze(['42601','42702','42501','42P01','42703','42883','23502','23503','23505','23514','22012','22P02','40001','40P01','57014','55P03','55000','P0001','28P01','3D000','53300','57P01','08006']);
const FAILURE_GUARDS=Object.freeze(["FINAL33_RESUME_BOUNDARY_REQUIRED","FINAL33_RESUME_FIRST_ABSENT_NOT_REACHED","FINAL_R3_PRIVATE_PLAN_REQUIRED","FINAL_R3_SOURCE_PROFILE_DIFFERS","FINAL_R3_REAL_OPTIONS_REQUIRED","FINAL33_APPROVAL_CANONICAL_REQUIRED","FINAL33_APPROVAL_OUTSIDE_PACKAGE_REQUIRED","FINAL33_CANONICAL_INPUT_REQUIRED","FINAL33_CURRENT_SERVICE_DIFFERS","FINAL33_ENV_REFUSED","FINAL33_FINITE_AUTHORITY_REQUIRED","FINAL33_FIXED_CONTROLLER_REQUIRED","FINAL33_FIXED_PROCESS_REQUIRED","FINAL33_INITIALIZER_BOUND","FINAL33_INPUT_CHANGED","FINAL33_NATIVE_OUTCOME_UNCONFIRMED","FINAL33_ORIGINAL_PREPARE_BINDING_REQUIRED","FINAL33_PERSISTED_INITIALIZER_BINDING_DIFFERS","FINAL33_PERSISTED_SCOPE_BINDING_DIFFERS","FINAL33_PREFLIGHT_REFUSED","FINAL33_PRIVATE_INPUT_BOUND","FINAL33_PRIVATE_PLAN_DIRECTORY_REQUIRED","FINAL33_PROTECTED_INPUT_REQUIRED","FINAL33_PROTECTED_PARENT_REQUIRED","FINAL33_RESTORED_SCOPE_DIFFERS","FINAL33_SCRATCH_REQUIRED","FINAL33_SOURCE_MATERIALIZATION_DIFFERS","FINAL33_RESUME_FIRST_ABSENT_DIFFERS","FINAL33_RESUME_COMMITTED_PREFIX_DIFFERS"]);
export function describeFailure(error,stage){
 const native=types.isNativeError(error);
 const own=key=>{try{const d=Object.getOwnPropertyDescriptor(error,key);return d&&'value'in d?d.value:undefined}catch{return undefined}};
 const pick=(values,value)=>typeof value==='string'&&values.includes(value)?value:'UNKNOWN';
 const code=native?own('code'):undefined,message=native?own('message'):undefined;
 const errorType=!native?'UNKNOWN':error instanceof AssertionError?'AssertionError':error instanceof TypeError?'TypeError':error instanceof RangeError?'RangeError':error instanceof SyntaxError?'SyntaxError':error instanceof ReferenceError?'ReferenceError':Object.getPrototypeOf(error)===Error.prototype?'Error':'UNKNOWN';
 return {format:'FINAL33_FAILURE_DIAGNOSTIC_V1',stage:pick(FAILURE_STAGES,stage),errorType,
  systemCode:pick(FAILURE_SYSTEM_CODES,code),guardCode:pick(FAILURE_GUARDS,message),
  sqlstate:FAILURE_SQLSTATES.includes(code)?code:null};
}

export const PREPARE='t45-r3-review-d2b1de9a2d';
export const LOGICAL_PREPARE='t45-r3-review-f77d598142';
export const FIRST_INCOMPLETE=Object.freeze({"ordinal":157,"firstStepOrdinal":1178,"lastStepOrdinal":1278,"descriptorSha256":"d98c42ddfacaa0660cd46747b87a41e7b00461d8e8be77c8a37115dc07832839","state":"ABSENT"});
const PREPARATION_IDENTITY_MAPPING=Object.freeze({"batchPlanPath":"/release-review/location-019d42dc77","businessWriterRequestKey":"t45-r3-review-2d2924565b","nativeLogicalPreparationKey":"t45-r3-review-f77d598142","outerPreparationAttemptKey":"t45-r3-review-d2b1de9a2d"});
export const WRITER='t45-r3-review-e49bce1d1a';
const STATE='/release-review/location-8ac850f99d';
const INPUT=STATE+'/r3-final33-private-import-input-20261116-01/package';
const PACKAGE=INPUT+'/standard-ready-20261116-1140-r1';
const PLAN_DIR=STATE+'/real-first-20261110-r3/reports/'+PREPARE;
const PLAN=PLAN_DIR+'/batched-plan.sqlite';
const OPERATOR_ROOT='installed-real-operation-batched-hall165-six-v3-20261119-01';
const OPERATOR=STATE+'/'+OPERATOR_ROOT+'/operation';
const ROLE='erp35_controller_20261110_r3';
const WORK_ROOT=STATE+'/final33-private';
const mount=dirname(fileURLToPath(import.meta.url));
const KEY=mount.split('/').at(-1);
const sha=b=>createHash('sha256').update(b).digest('hex');
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const need=(v,c)=>{if(!v)throw Error(c)};
const load=rel=>import(pathToFileURL(OPERATOR+'/'+rel).href);
const INPUT_PINS=Object.freeze({
 manifest:'7ebdac46d6f266065368b26d91821882284ce91a9071c23a98176bacede78679',
 summary:'6751463c596b0330faf7851c255bf972cbede3cfad6c0fed027e5befd137336d',
 profile:'b460db7ded610e6afe0fc8d506fedb8eda9d947819571211a25ecc5b52a39c0b',
});
export const REGISTRATION=Object.freeze({batch_id:'0ba19ca1-5903-573d-b1e0-c809808b0c81',
 source_namespace:'naijue:tplus:20261102',source_metadata_sha256:'f9488a2a0e148483fb985a73b177b923daf89b86df0c00179b4756fa097a098c',
 cutoff_at:'2026-11-16T11:40:00+08:00'});
const APPROVALS=Object.freeze([
 ['readHistoricalSettlementRetentionCliApproval','historicalSettlementRetentionApproval','final-approval-20261116-1140-r1/historical-settlement24.json','b97826567240e9509b60a263ba62d35bc08135b57cce84cc184debc83b1d6a05','--historical-settlement-retention-approval-sha256'],
 ['readHistoricalLineAmountCliEvidence','historicalLineAmountEvidence','final-approval-20261116-1140-r1/historical-line-amount6.json','e6f76ffd32f7d807e433e85bd2228b65281a6dc83ec3205117661bea13fdc710','--historical-line-amount-evidence-sha256'],
 ['readHistoricalHallCliApproval','historicalSalesHallApproval','final-approval-20261116-1140-r1/historical-sales-hall.json','a2e0893e36dc3260613a0e585c896aac6dd57939da2f7345d77561dcdf5a1a42','--historical-hall-approval-sha256'],
 ['readCurrentEffectiveAlignmentCliEvidence','currentEffectiveAlignmentEvidence','final-approval-20261116-1140-r1/current-effective-alignment.json','5a359f66aa5d6163fbb81dd23039395afdb81c8e30ed31d308dd5418f0d3b9ab','--current-effective-alignment-sha256'],
 ['readExplicitZeroCliApproval','explicitZeroApproval','current-materialized-r1/review/baseline-scope-review/inventory-baseline-scope.jsonl','669c0e4228ee2f7d8929bcc92a1bdf4cea9d491028e518d379818a64a775b566','--explicit-zero-approval-sha256'],
 ['readStaffHallCliApproval','historicalStaffHallApproval','final-approval-20261116-1140-r1/historical-staff-null-hall.json','4dec9cf865099dd8a74564202fddf9ebb37648ade6f6e0e1a55b1fbf45f9bb40','--staff-hall-approval-sha256'],
]);
export function finalBatchBinding(target,admin){
 const sourceOptions={'--target-profile':'FRESH35_COMPACT_ZERO_FIRST_IMPORT_V2'};
 for(const row of APPROVALS)sourceOptions[row[4]]=row[3];
 return {manifestSha256:INPUT_PINS.manifest,target,admin,registration:{...REGISTRATION},sourceOptions};
}
export function finalHostOptions(service,proof){return {
 referenceDirectory:'/release-review/location-9ace91dbdd',sourceProfileSha256:INPUT_PINS.profile,
 currentService:{sha256:service.proofSha256,capacityExpiresAt:proof.sharedPostgresNamespace.serviceLeaseExpiresAt},
 parentPins:{sha256:'96d35d3b4c7b356b334849373611068d07bb12b3fcf6c6f47dacce3d570a3e3e',
  sourceSetSha256:'d69cae66caf44473cd6c578943852e0f8eb4af38064135d2c0fcebc368aa3afe',
  catalogSpecSha256:'811c3cf6df32c6cfabc77071812f7e3abd43a0ea64b9f7b4d982b8ccae791d67'},
 successorSha256:'d18f80cec591b3740f7aeceb14f1148bdea4ce867feba4e5ff3465dbdb8d231e'};}
const identity=s=>[s.dev,s.ino,s.uid,s.gid,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs].join(':');
async function protectedBytes(path,pin,maximum,exactBytes,groupPrivate=false){
 need(await realpath(path)===path,'FINAL33_CANONICAL_INPUT_REQUIRED');
 for(let d=dirname(path);;d=dirname(d)){
  const st=await lstat(d);
  need(st.isDirectory()&&st.uid===0&&!(st.mode&0o022),'FINAL33_PROTECTED_PARENT_REQUIRED');
  if(d==='/')break;
 }
 const fd=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const a=await fd.stat({bigint:true});
  need(a.isFile()&&a.uid===0n&&a.nlink===1n&&!(a.mode&0o022n)&&a.size>0n&&a.size<=BigInt(maximum)
   &&(exactBytes===undefined||a.size===BigInt(exactBytes))
   &&(!groupPrivate||a.gid===61035n&&(a.mode&0o777n)===0o440n),'FINAL33_PROTECTED_INPUT_REQUIRED');
  const bytes=await fd.readFile();
  need(BigInt(bytes.length)===a.size&&identity(a)===identity(await fd.stat({bigint:true}))
   &&identity(a)===identity(await lstat(path,{bigint:true}))&&sha(bytes)===pin,'FINAL33_INPUT_CHANGED');
  return bytes;
 }finally{await fd.close()}
}
async function privateInput(){
 const parts=[];let n=0;
 try{
  for await(const b of process.stdin){n+=b.length;need(n<=65536,'FINAL33_PRIVATE_INPUT_BOUND');parts.push(b)}
  const raw=Buffer.concat(parts);
  try{
   const p=JSON.parse(raw);
   need(p?.postgres?.host==='127.0.0.1'&&p.postgres.port===56791&&p.postgres.database==='erp_fresh35_20261110_r3'
    &&p.postgres.user===ROLE&&p.postgres.ssl===false&&digest(p.postgres.password),'FINAL33_FIXED_CONTROLLER_REQUIRED');
   return p;
  }finally{raw.fill(0)}
 }finally{parts.forEach(b=>b.fill(0))}
}
async function retainInitializer(initialize){
 const dir=await lstat(PLAN_DIR);
 need(await realpath(PLAN_DIR)===PLAN_DIR&&dir.isDirectory()&&dir.uid===61035&&dir.gid===61035
  &&(dir.mode&0o777)===0o700,'FINAL33_PRIVATE_PLAN_DIRECTORY_REQUIRED');
 const bytes=Buffer.from(JSON.stringify(initialize)+'\n');
 need(bytes.length>0&&bytes.length<=128*1024*1024,'FINAL33_INITIALIZER_BOUND');
 const fd=await open(PLAN_DIR+'/original-initializer.json',constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 try{await fd.writeFile(bytes);await fd.sync()}finally{bytes.fill(0);await fd.close()}
}
async function outsidePackage(path){
 need(await realpath(path)===path&&await realpath(PACKAGE)===PACKAGE,'FINAL33_APPROVAL_CANONICAL_REQUIRED');
 const rel=relative(PACKAGE,path);
 need(rel==='..'||rel.startsWith('..'+sep)||rel.startsWith(sep),'FINAL33_APPROVAL_OUTSIDE_PACKAGE_REQUIRED');
}
async function persistedScope(batchBinding,preparedBinding,encodedScrypt){
 const stateApi=await load('tools/unified-import/batched-stream-cli-state.mjs');
 const {requestHash}=await load('packages/application/src/request-hash.ts');
 const approvals=await load('packages/application/src/unified-explicit-zero-approval.ts');
 let state,token;
 try{
  state=await stateApi.openCliBatchedState(PLAN,batchBinding);
  const initialize=state.initialize(),descriptor=initialize.payload?.explicit_zero_approval;
  need(requestHash({initialize,encodedScrypt})===preparedBinding.initializerSha256,
   'FINAL33_PERSISTED_INITIALIZER_BINDING_DIFFERS');
  need(descriptor?.format_version==='INVENTORY_BASELINE_SCOPE_V1'&&descriptor.sha256===APPROVALS[4][3]
   &&descriptor.source_namespace===initialize.namespace&&descriptor.cutoff_at===initialize.cutoff_at,
   'FINAL33_PERSISTED_SCOPE_BINDING_DIFFERS');
  const path=INPUT+'/'+APPROVALS[4][2];await outsidePackage(path);
  const bytes=await protectedBytes(path,APPROVALS[4][3],65536,undefined,true);
  token=await approvals.readExplicitZeroScopeApproval({bytes,trustedSha256:APPROVALS[4][3],directory:dirname(path),
   sourceNamespace:descriptor.source_namespace,inventoryFileSha256:descriptor.inventory_file_sha256,cutoffAt:descriptor.cutoff_at});
  need(requestHash(approvals.explicitZeroApprovalDescriptor(token))===requestHash(descriptor),'FINAL33_RESTORED_SCOPE_DIFFERS');
  return token;
 }catch(error){if(token)await approvals.closeExplicitZeroApproval(token);throw error}
 finally{
  try{state?.close()}catch(error){if(token)await approvals.closeExplicitZeroApproval(token);throw error}
 }
}
/** Per-key latest checkpoint only. Included inline in the final private runner. */
const PROGRESS_STAGES=Object.freeze(['PLAN_VERIFY','PLAN_VERIFY_ACK','RESTORE','RESTORE_ACK','HOST_CORE_INSPECT_PENDING','CORE_INSPECT_ACK','DESCRIPTOR_CHECK','OPEN','OPEN_ACK','BEGIN','BEGIN_ACK','INSPECT','INSPECT_ACK','COMMITTED_MATCH','APPLY','APPLY_ACK','COMPLETE','COMPLETE_ACK','CONSTRAINTS','CONSTRAINTS_ACK','COMMIT_ATTEMPT','COMMIT_ACK','COMMIT_UNCONFIRMED','TRANSACTION_UNCONFIRMED','ROLLBACK','ROLLBACK_ACK','DISCARD','DISCARD_ACK','DISCARD_UNCONFIRMED','BIND_INPUTS','VERIFY_PERSISTED_SCOPE','VERIFY_PERSISTED_SCOPE_ACK','WRITER_CALL','WRITER_CALL_ACK','WRITER_READBACK','WRITER_READBACK_ACK','APPROVAL_CLEANUP','APPROVAL_CLEANUP_ACK','RUNNER_FAILURE','RUNNER_FINISH']);
const PROGRESS_QUERIES=Object.freeze(['NONE','BEGIN','INSPECT','APPLY','COMPLETE','CONSTRAINTS','COMMIT','ROLLBACK']);
const PROGRESS_PHASES=Object.freeze(['CORE','MASTER','KEYS','BASELINE_CLOSE','DOCUMENT_OPEN','HISTORY','FINALIZE']);
const PROGRESS_KEYS=Object.freeze(['stage','queryClass','acknowledged','stepOrdinal','phase','groupOrdinal','descriptorSha256','completedBatches','skippedBatches']);
function closedProgressEvent(event){
 if(!event||typeof event!=='object'||Object.keys(event).length!==PROGRESS_KEYS.length||PROGRESS_KEYS.some(k=>!Object.hasOwn(event,k)))return false;
 const integer=(x,max)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
 return PROGRESS_STAGES.includes(event.stage)&&PROGRESS_QUERIES.includes(event.queryClass)&&typeof event.acknowledged==='boolean'
  &&(event.phase===null||PROGRESS_PHASES.includes(event.phase))&&(event.groupOrdinal===null||integer(event.groupOrdinal,1060))
  &&(event.stepOrdinal===null||integer(event.stepOrdinal,44910))&&(event.descriptorSha256===null||typeof event.descriptorSha256==='string'&&/^[a-f0-9]{64}$/.test(event.descriptorSha256))
  &&integer(event.completedBatches,1061)&&integer(event.skippedBatches,1061);
}
const TIMING_PHASES = {
 PLAN_VERIFY: ['planVerify', false], PLAN_VERIFY_ACK: ['planVerify', true],
 RESTORE: ['restore', false], RESTORE_ACK: ['restore', true],
 HOST_CORE_INSPECT_PENDING: ['coreInspect', false], CORE_INSPECT_ACK: ['coreInspect', true],
};
const emptySpan = () => ({count: 0, totalMilliseconds: 0, maxMilliseconds: 0});
const sameGroup = (a, b) => a.groupOrdinal === b.groupOrdinal && a.descriptorSha256 === b.descriptorSha256;

// Callback boundaries include synchronous checkpoint writes and the full awaited operation.
export function createProgressTiming() {
 const spans = {
  planVerify: emptySpan(), restore: emptySpan(), coreInspect: emptySpan(),
  skippedGroups: emptySpan(), firstHistoryApply: emptySpan(),
 };
 let writing = false, pending = null, groupStart = null, firstHistoryGroup = null;
 let unconfirmed = null, pairingGapObserved = false;
 function start(scope, event, at) {
  if (pending) pairingGapObserved = true;
  pending = {scope, event, at};
  unconfirmed = null;
 }
 function acknowledge(scope, event, at) {
  if (!pending || pending.scope !== scope || !sameGroup(pending.event, event)
    || pending.event.stepOrdinal !== event.stepOrdinal || at < pending.at) {
   pairingGapObserved = true;
   return;
  }
  const duration = Math.floor(at - pending.at);
  const span = spans[scope];
  span.count++;
  span.totalMilliseconds += duration;
  span.maxMilliseconds = Math.max(span.maxMilliseconds, duration);
  pending = null;
  unconfirmed = null;
 }
 function closePending(at) {
  if (!pending) return;
  unconfirmed = {
   scope: pending.scope, observedMilliseconds: Math.floor(at - pending.at), atBoundary: true,
  };
  pending = null;
 }
 return {
  record(event, at) {
   const {stage, queryClass, acknowledged, groupOrdinal, stepOrdinal, descriptorSha256, phase} = event;
   if (stage === 'WRITER_CALL') { writing = true; return; }
   if (!writing) return;
   if (stage === 'WRITER_CALL_ACK' || stage === 'RUNNER_FAILURE' || stage === 'RUNNER_FINISH') {
    closePending(at);
    writing = false;
    return;
   }
   const pair = TIMING_PHASES[stage];
   if (pair && queryClass === 'NONE' && groupOrdinal === null && acknowledged === pair[1]) {
    if (acknowledged) acknowledge(pair[0], event, at);
    else start(pair[0], event, at);
    return;
   }
   if (groupOrdinal === null || descriptorSha256 === null) return;
   if (stage === 'DESCRIPTOR_CHECK') groupStart = {event, at};
   if (stage === 'COMMITTED_MATCH' && queryClass === 'INSPECT' && acknowledged) {
    if (groupStart && sameGroup(groupStart.event, event)) start('skippedGroups', event, groupStart.at);
    else pairingGapObserved = true;
   }
   if (stage === 'COMMIT_ACK' && queryClass === 'COMMIT' && acknowledged && pending?.scope === 'skippedGroups') {
    acknowledge('skippedGroups', event, at);
   }
   if (phase === 'HISTORY' && queryClass === 'APPLY' && stepOrdinal !== null) {
    if (stage === 'APPLY' && !acknowledged) {
     firstHistoryGroup ??= event;
     if (sameGroup(firstHistoryGroup, event)) start('firstHistoryApply', event, at);
    } else if (stage === 'APPLY_ACK' && acknowledged) {
     if (firstHistoryGroup && sameGroup(firstHistoryGroup, event)) acknowledge('firstHistoryApply', event, at);
     else if (firstHistoryGroup === null) pairingGapObserved = true;
    }
   }
   if ((stage === 'TRANSACTION_UNCONFIRMED' || stage === 'COMMIT_UNCONFIRMED') &&
      pending && sameGroup(pending.event, event)) closePending(at);
  },
  snapshot(at) {
   return {
    format: 'FINAL33_PROGRESS_TIMING_V1', ...spans,
    firstHistoryGroupOrdinal: firstHistoryGroup?.groupOrdinal ?? null, pairingGapObserved,
    unconfirmed: pending ? {scope: pending.scope, observedMilliseconds: Math.floor(at - pending.at), atBoundary: false} : unconfirmed,
   };
  },
 };
}
const TIMING_LIMITS = {planVerify: 1, restore: 1, coreInspect: 1, skippedGroups: 1061, firstHistoryApply: 44910};
const TIMING_FIELDS = [...Object.keys(TIMING_LIMITS), 'format', 'firstHistoryGroupOrdinal', 'pairingGapObserved', 'unconfirmed'];
const exactTimingFields = (value, fields) => value !== null && typeof value === 'object'
 && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key));
const boundedTimingInteger = (value, maximum) => Number.isSafeInteger(value) && value >= 0 && value <= maximum;

function closedTiming(timing, elapsed) {
 if (!exactTimingFields(timing, TIMING_FIELDS) || timing.format !== 'FINAL33_PROGRESS_TIMING_V1'
   || typeof timing.pairingGapObserved !== 'boolean') return false;
 const group = timing.firstHistoryGroupOrdinal;
 if (group !== null && !boundedTimingInteger(group, 1060)) return false;
 for (const [scope, limit] of Object.entries(TIMING_LIMITS)) {
  const span = timing[scope];
  if (!exactTimingFields(span, ['count', 'totalMilliseconds', 'maxMilliseconds'])) return false;
  const {count, totalMilliseconds, maxMilliseconds} = span;
  if (!boundedTimingInteger(count, limit) || !boundedTimingInteger(totalMilliseconds, elapsed)
    || !boundedTimingInteger(maxMilliseconds, totalMilliseconds) || totalMilliseconds > count * maxMilliseconds
    || (count > 0 && scope === 'firstHistoryApply' && group === null)) return false;
 }
 const tail = timing.unconfirmed;
 return tail === null || (exactTimingFields(tail, ['scope', 'observedMilliseconds', 'atBoundary'])
   && typeof tail.scope === 'string' && Object.hasOwn(TIMING_LIMITS, tail.scope) && (tail.scope !== 'firstHistoryApply' || group !== null)
   && boundedTimingInteger(tail.observedMilliseconds, elapsed) && typeof tail.atBoundary === 'boolean');
}

const APPLY_BUCKETS = Object.freeze(['checkpoint', 'packaging', 'authorization', 'driver']);
export function createApplyTiming(clock = () => Math.floor(performance.now() * 1000)) {
 const buckets = Object.fromEntries(APPLY_BUCKETS.map(k => [k, {count:0, totalMicros:0, maxMicros:0}]));
 let active = null, tail = null, disabled = false, supplementalFailures = 0;
 const stamp = () => {
  const value = clock();
  if (!Number.isSafeInteger(value) || value < 0) throw Error('APPLY_CLOCK');
  return value;
 };
 const maxMicros = 20000000000;
 const delta = (first, last) => {
  if (last < first || last - first > maxMicros) throw Error('APPLY_CLOCK');
  return last - first;
 };
 const add = (key, elapsed) => {
  const slot = buckets[key];
  slot.count++;
  slot.totalMicros += elapsed;
  slot.maxMicros = Math.max(slot.maxMicros, elapsed);
 };
 const attempt = (fn) => {
  if (!disabled) try { return fn(); } catch { disabled = true; }
 };
 const describe = (value, now, atBoundary) => ({stage:value.stage, groupOrdinal:value.groupOrdinal,
  stepOrdinal:value.stepOrdinal, observedMicros:delta(value.since, now), atBoundary});
 return {
  beforeCheckpoint(event, supplemental) {
   return attempt(() => {
    const now = stamp();
    if (!supplemental && event.stage === 'APPLY' && event.queryClass === 'APPLY') {
     if (active || event.groupOrdinal === null || event.stepOrdinal === null) throw Error('APPLY_ORDER');
     tail = null;
     active = {stage:'packaging', groupOrdinal:event.groupOrdinal, stepOrdinal:event.stepOrdinal, since:now};
    }
    if (!supplemental && ['TRANSACTION_UNCONFIRMED','COMMIT_UNCONFIRMED','WRITER_CALL_ACK','RUNNER_FAILURE','RUNNER_FINISH'].includes(event.stage) && active) {
     tail = describe(active, now, true); active = null;
    }
    return now;
   });
  },
  afterCheckpoint(event, supplemental, started, failed) {
   attempt(() => {
    if (started === undefined) return;
    const now = stamp();
    add('checkpoint', delta(started, now));
    if (supplemental && failed) supplementalFailures++;
    if (active && (supplemental || event.stage === 'APPLY')) active.since = now;
   });
  },
  stage(name) {
   return attempt(() => {
    const expected = {authorization:'packaging', driver:'authorization', returned:'driver'}[name];
    if (!active || !expected || active.stage !== expected) throw Error('APPLY_ORDER');
    const now = stamp();
    add(active.stage, delta(active.since, now));
    if (name === 'returned') {active = null; return false;}
    active.stage = name; active.since = now;
    return true;
   });
  },
  snapshot(at, elapsedMilliseconds) {
   return attempt(() => {
    const limit = (elapsedMilliseconds + 1) * 1000;
    for (const k of APPLY_BUCKETS) {
     const {count,totalMicros,maxMicros}=buckets[k];
     if (!Number.isSafeInteger(totalMicros) || count > (k==='checkpoint'?1000000:44911)
      || totalMicros > limit || maxMicros > totalMicros || totalMicros > count*maxMicros) throw Error('APPLY_TIMING_BOUND');
    }
    const pending = active ? describe(active, at, false) : tail;
    if (pending && pending.observedMicros > limit) throw Error('APPLY_TIMING_BOUND');
    return {format:'FINAL33_APPLY_TIMING_V1', ...buckets, supplementalFailures, pending};
   });
  },
 };
}

// A constant-width V3 frame avoids stale trailing bytes on short records.
// Readers normalize only this fixed checksum field and verify all 4096 bytes.
const FRAME_HASH_START = Buffer.byteLength('{"frameSha256":"');
const FRAME_HASH_ZERO = '0'.repeat(64);
function privateProgressFrame(out, timing, applyTiming) {
 const frame = Buffer.alloc(4096, 0x20);
 const bytes = Buffer.from(JSON.stringify({frameSha256:FRAME_HASH_ZERO,
  ...out, format:'NORMAL48_PRIVATE_PROGRESS_V3', timing, applyTiming})+'\n');
 if (bytes.length > frame.length) return null;
 bytes.copy(frame);
 const checksum = createHash('sha256').update(frame).digest('hex');
 frame.write(checksum, FRAME_HASH_START, 64, 'ascii');
 return frame;
}

function createPrivateProgress(mount,expiresAt){
 const path=mount+'/scratch/writer-progress.json',began=performance.now();
 let applyTiming; try { applyTiming=createApplyTiming(); } catch {}
 let lastEvent;
 let timing;
 let fd=null,failed=false,events=0,lastSync=0,currentGroup=null,commitAttempted=false,commitAcknowledged=false,lastCommittedGroup=null,openedIdentity=null;
 const fail=()=>{failed=true;};
 try{
  const dir=lstatSync(mount+'/scratch');
  if(!dir.isDirectory()||dir.isSymbolicLink()||dir.uid!==61035||dir.gid!==61035||(dir.mode&0o777)!==0o700)throw Error('PRIVATE_PROGRESS_DIRECTORY_DIFFERS');
  fd=openSync(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  const z=fstatSync(fd);if(!z.isFile()||z.uid!==61035||z.gid!==61035||z.nlink!==1||(z.mode&0o777)!==0o600)throw Error('PRIVATE_PROGRESS_FILE_DIFFERS');
  openedIdentity=[z.dev,z.ino,z.uid,z.gid,z.nlink,z.mode].join(':');
 }catch{fail();if(fd!==null)try{closeSync(fd)}catch{}fd=null;}
 const record=(event,supplemental=false)=>{
  if(fd===null)return;
  let checkpointStarted, supplementalFailed = false;
  try { checkpointStarted=applyTiming?.beforeCheckpoint(event,supplemental); } catch { applyTiming=null; }
  try{
   if(!closedProgressEvent(event))throw Error('PRIVATE_PROGRESS_CLOSED_EVENT_REQUIRED');
   if(!supplemental)lastEvent=event;
   if(!supplemental && event.groupOrdinal!==null&&event.groupOrdinal!==currentGroup){currentGroup=event.groupOrdinal;commitAttempted=false;commitAcknowledged=false;}
   if(!supplemental && event.stage==='COMMIT_ATTEMPT')commitAttempted=true;
   if(!supplemental && event.stage==='COMMIT_ACK'){commitAcknowledged=true;lastCommittedGroup=event.groupOrdinal;}
   const z=fstatSync(fd),named=lstatSync(path);
   if([z.dev,z.ino,z.uid,z.gid,z.nlink,z.mode].join(':')!==openedIdentity||named.dev!==z.dev||named.ino!==z.ino||!named.isFile()||named.isSymbolicLink())throw Error('PRIVATE_PROGRESS_IDENTITY_CHANGED');
   const observed = Math.max(0, performance.now() - began);
   const elapsedMilliseconds = Math.floor(observed);
   const out={format:'NORMAL48_PRIVATE_PROGRESS_V1',requestKey:'t45-r3-review-e49bce1d1a',...event,elapsedMilliseconds,remainingMilliseconds:Math.max(0,expiresAt-Date.now()),eventsObserved:supplemental?events:++events,commitAttempted,commitAcknowledged,lastCommittedGroup,recordingFailureObserved:failed};
   // Telemetry validity and the original checkpoint status are independent.
   let legacyTiming=null, apply=null;
   if (timing !== null) {
    try {
     timing ??= createProgressTiming();
     if(!supplemental)timing.record(event, observed);
     const snapshot=timing.snapshot(observed);
     if(closedTiming(snapshot,elapsedMilliseconds))legacyTiming=snapshot;
    } catch {}
    if(!legacyTiming && !supplemental)timing=null;
   }
   try { if(checkpointStarted!==undefined)apply=applyTiming?.snapshot(checkpointStarted,elapsedMilliseconds)??null; }
   catch { applyTiming=null; }
   if(supplemental && !apply)return;
   const bytes=privateProgressFrame(out,legacyTiming,apply)
    ?? (supplemental?null:privateProgressFrame(out,null,null));
   if(!bytes) {
    if(supplemental)return;
    throw Error('PRIVATE_PROGRESS_BOUND');
   }
   let offset=0;while(offset<bytes.length){const n=writeSync(fd,bytes,offset,bytes.length-offset,offset);if(n<=0)throw Error('PRIVATE_PROGRESS_SHORT_WRITE');offset+=n;}
   ftruncateSync(fd,bytes.length);
   if(!supplemental && (elapsedMilliseconds-lastSync>=1000||event.stage==='COMMIT_ACK'||event.stage==='RUNNER_FINISH')){fsyncSync(fd);lastSync=elapsedMilliseconds;}
  }catch{
   if(supplemental)supplementalFailed=true;
   else fail();
  }finally{
   // Account for attempted synchronous writes even on short-write or EIO.
   // The next phase starts after that attempt, or timing is disabled.
   try { applyTiming?.afterCheckpoint(event,supplemental,checkpointStarted,supplementalFailed); }
   catch { applyTiming=null; }
  }
 };
 const outer=stage=>record({stage,queryClass:'NONE',acknowledged:stage.endsWith('_ACK'),stepOrdinal:null,phase:null,groupOrdinal:null,descriptorSha256:null,completedBatches:0,skippedBatches:0});
 const close=()=>{if(fd!==null){try{fsyncSync(fd);closeSync(fd)}catch{fail();}fd=null;}return {status:failed?'UNCONFIRMED':'CLOSED',eventsObserved:events,maximumBytes:4096};};
 const wireStage=stage=>{
  try { if(applyTiming?.stage(stage) && lastEvent?.stage==='APPLY')record(lastEvent,true); }
  catch { applyTiming=null; }
 };
 return {record,outer,wireStage,close};
}
// The native executor creates a fresh kernel per transaction and advances
// only after COMMIT ACK. These counters never advance a plan cursor.
export function guardedResumeKernel(createKernel, firstIncomplete) {
 const {ordinal,firstStepOrdinal,lastStepOrdinal,descriptorSha256,state}=firstIncomplete;
 need(Number.isSafeInteger(ordinal)&&ordinal>0&&Number.isSafeInteger(firstStepOrdinal)&&firstStepOrdinal>0
  &&Number.isSafeInteger(lastStepOrdinal)&&lastStepOrdinal>=firstStepOrdinal
  &&digest(descriptorSha256)&&state==='ABSENT','FINAL33_RESUME_BOUNDARY_REQUIRED');
 let matchedGroups=0,nextStep=0,reached=false;
 return {
  get reached(){return reached;},
  createKernel(){
   const kernel=createKernel();
   return Object.freeze({...kernel,async lockAndInspect(client,identity,batch){
    const found=await kernel.lockAndInspect(client,identity,batch);
    if(reached)return found;
    if(batch.ordinal===ordinal){
     need(matchedGroups===ordinal&&nextStep===firstStepOrdinal
      &&batch.first===firstStepOrdinal&&batch.last===lastStepOrdinal&&batch.descriptorSha256===descriptorSha256
      &&found.state==='ABSENT','FINAL33_RESUME_FIRST_ABSENT_DIFFERS');
     reached=true;
    }else{
     need(batch.ordinal===matchedGroups&&batch.ordinal<ordinal
      &&batch.first===nextStep&&Number.isSafeInteger(batch.last)
      &&batch.last>=batch.first&&batch.last<firstStepOrdinal
      &&found.state==='COMMITTED'&&found.subBatchId===batch.subBatchId
      &&found.descriptorSha256===batch.descriptorSha256,'FINAL33_RESUME_COMMITTED_PREFIX_DIFFERS');
     matchedGroups++;
     nextStep=batch.last+1;
    }
    return found;
   }});
  },
 };
}

// Writer-only composition of the frozen retained entry. The same reviewed host
// still admits the exact plan and opens the same client before the native kernel.
// No operation member, SQL adapter, or existing entry is patched.
async function runPreparedResumeWithBoundary(config,target,inputs,hostOptions,inputBinding,firstIncomplete){
 const [{openCliBatchedState,FINAL_R3_SOURCE},{openReviewedFresh35CompactZeroHost,restoreFresh35FinalPreparedImport},
  {runBatchedStreamOperation},{createBatchedStreamSqlKernel},{requestHash}]=await Promise.all([
  load('tools/unified-import/batched-stream-cli-state.mjs'),
  load('tools/unified-import/fresh35-host-session.mjs'),
  load('tools/unified-import/batched-stream-operation.mjs'),
  load('tools/unified-import/batched-stream-sql-kernel.mjs'),
  load('packages/application/src/request-hash.ts'),
 ]);
 need(inputs.resume===true&&inputs.options?.allowSynthetic===false
  &&requestHash(inputs.options.target)===requestHash(target)
  &&requestHash(inputs.options.registration??null)===requestHash(inputs.batchBinding.registration),
  'FINAL_R3_REAL_OPTIONS_REQUIRED');
 need(hostOptions?.sourceProfileSha256===FINAL_R3_SOURCE.sourceProfileSha256,'FINAL_R3_SOURCE_PROFILE_DIFFERS');
 const guard=guardedResumeKernel(()=>createBatchedStreamSqlKernel(inputs.encodedScrypt),firstIncomplete);
 const observe=stage=>{
  try{const pending=inputs.progress(Object.freeze({stage,queryClass:'NONE',acknowledged:stage.endsWith('_ACK'),
   stepOrdinal:null,phase:null,groupOrdinal:null,descriptorSha256:null,completedBatches:0,skippedBatches:0}));
   if(pending?.then)Promise.resolve(pending).catch(()=>{});
  }catch{}
 };
 let state,prepared,result,operationResult;
 try{
  observe('PLAN_VERIFY');
  const path=inputs.batchPlanPath;
  const file=await lstat(path);
  need(path===PLAN&&await realpath(path)===path&&file.isFile()&&file.nlink===1
   &&(file.mode&0o777)===0o600&&file.uid===process.getuid(),'FINAL_R3_PRIVATE_PLAN_REQUIRED');
  state=await openCliBatchedState(path,inputs.batchBinding);
  observe('PLAN_VERIFY_ACK');
  result=await openReviewedFresh35CompactZeroHost(config,OPERATOR,target,async admission=>{
   observe('RESTORE');
   prepared=await restoreFresh35FinalPreparedImport(state,inputs.encodedScrypt,target,admission,inputBinding,
    inputs.preparedBinding,'RESUME');
   observe('RESTORE_ACK');
   observe('HOST_CORE_INSPECT_PENDING');
   return prepared;
  },async client=>{
   observe('CORE_INSPECT_ACK');
   const outcome=await runBatchedStreamOperation({planPath:path,identity:prepared.identity,preparedPlan:state,
    openClient:async()=>client,encodedScrypt:inputs.encodedScrypt,borrowedClient:true,progress:inputs.progress,
    createKernel:guard.createKernel});
   need(outcome.state!=='COMPLETED'||guard.reached,'FINAL33_RESUME_FIRST_ABSENT_NOT_REACHED');
   return operationResult=outcome;
  },{...hostOptions,purpose:'FIRST_REAL_BUSINESS_IMPORT',transactionMode:'BATCHED_V1',prepareOnly:false,
   explicitZeroApproval:inputs.options.explicitZeroApproval,
   finalSource:{mode:'RESUME',inputBinding,preparedBinding:inputs.preparedBinding},applyTiming:inputs.applyTiming});
  return result;
 }catch(error){
  if(!operationResult)throw error;
  result={result:operationResult,cleanup:'UNKNOWN'};
  return result;
 }finally{
  try{state?.close()}catch{if(result)result.local_cleanup='FAILED';else throw Error('FINAL_R3_WRITER_LOCAL_CLEANUP_FAILED');}
 }
}

export async function main(){
 need(process.platform==='linux'&&process.version==='v24.21.0'&&[process.getuid(),process.geteuid(),process.getgid(),process.getegid()].every(x=>x===61035)
  &&process.getgroups().every(x=>x===61035)&&!WRITER.startsWith('__UNISSUED_')&&KEY===WRITER&&mount===WORK_ROOT+'/'+KEY
  &&process.execArgv.length===1&&process.execArgv[0]==='--no-global-search-paths'
  &&process.argv.length===3&&digest(process.argv[2])&&fstatSync(0).isFIFO(),'FINAL33_FIXED_PROCESS_REQUIRED');
 need(!Object.keys(process.env).some(k=>k.startsWith('PG')||['DATABASE_URL','NODE_PATH','NODE_OPTIONS'].includes(k)
  ||k.startsWith('LD_')||k.startsWith('DYLD_')),'FINAL33_ENV_REFUSED');
 need(process.env.TMPDIR===mount+'/scratch'&&process.env.SQLITE_TMPDIR===mount+'/scratch','FINAL33_SCRATCH_REQUIRED');
 const a=JSON.parse(await protectedBytes(mount+'/host-authorization.json',process.argv[2],131072,undefined,true));
 need(equal(a.firstIncomplete,FIRST_INCOMPLETE),'FINAL33_RESUME_BOUNDARY_REQUIRED');
 need(equal(a.preparationIdentityMapping,PREPARATION_IDENTITY_MAPPING)&&a.preparationRequestKey===LOGICAL_PREPARE&&a.batchPlanPath===PLAN,'FINAL33_FINITE_AUTHORITY_REQUIRED');
 need(a.executionMode==='RESUME'&&a.requestKey===KEY&&a.phase===(KEY===PREPARE?'PREPARE':'WRITER')&&a.startsAt<=Date.now()
  &&Date.now()+30000<a.expiresAt,'FINAL33_FINITE_AUTHORITY_REQUIRED');
 const proof=JSON.parse(await protectedBytes('/release-review/location-55b5a943b4',a.service.proofSha256,65536));
 need(proof.requestKey===a.service.serviceKey&&proof.physical.postmasterStart===a.service.postmasterStart
  &&proof.sharedPostgresNamespace.container.id===a.service.containerId&&proof.sharedPostgresNamespace.container.startedAt===a.service.containerStartedAt
  &&a.expiresAt<=proof.sharedPostgresNamespace.serviceLeaseExpiresAt,'FINAL33_CURRENT_SERVICE_DIFFERS');
 const material=JSON.parse(await protectedBytes(STATE+'/'+OPERATOR_ROOT+'/source-materialization.json',a.operatorReadySha256,65536));
 const expectedMaterial={"databaseWrites":0,"nodeModulesChanged":false,"ordinaryActorReadability":{"uid":61035,"gid":61035,"groups":[],"openedCodeFilesWithoutBodyRead":415,"privateBaselineExcluded":true,"mappingBasis":"EXISTING_STATE_BIND_ROOT_FD","bodyReads":false,"hostAncestorPermissionsChanged":false},"state":"SOURCE_PHYSICALLY_MATERIALIZED_SQL_UPGRADE_NOT_PERFORMED","operatorRuntimeSourceSetSha256":"9467a363a60a908d120e088f471901248f7060f5e6c2d7e9a1d2ece7208fadef","requestKey":"t45-r3-review-3c4db4ee73","sourceDescriptionSha256":"4a0666522a1b0c82245aff2505d01b9a5ae9b5783143021ad2dd81388e1204a2","sourceFiles":416,"sourceRoot":"/release-review/location-de271e8983","sourceRowsSha256":"2d7b2695bd0a774a9b9f2141c3d2b685d2e6182ca7349486ea35dae5936f42bb","sourceSetSha256":"4bea5392dd64ec1dce32a44f71208f45d94e0e57a91e3e6ff9acda24d11fe2dd"};
 need(Object.entries(expectedMaterial).every(([k,value])=>equal(material[k],value))
  &&a.operatorReadySha256===a.operatorMaterialization.rootResultSha256,
  'FINAL33_SOURCE_MATERIALIZATION_DIFFERS');
 await protectedBytes(OPERATOR+'/tools/unified-import/r3-service20-entry.mjs','a36f2a10911f19682e488bd1432924f4616f8e7b5007691e4ac50caafe3a68f6',2048,1075);
 const api=await load('tools/unified-import/r3-service20-entry.mjs');
 const p=await privateInput();let options;let failureStage='BIND_INPUTS';
 const evidence={requestKey:KEY,service:a.service,inputSha256:process.argv[2],phase:a.phase,state:'UNKNOWN',
  connectionCleanup:'NOT_OPENED',automaticReplay:false};
 const progress=createPrivateProgress(mount,a.expiresAt);progress.outer('BIND_INPUTS');
 try{
  const batchBinding=finalBatchBinding(p.target,p.admin),hostOptions=finalHostOptions(a.service,proof);
  const config={host:p.postgres.host,port:p.postgres.port,database:p.postgres.database,user:p.postgres.user,password:p.postgres.password};
  options={target:p.target,initialization_identity:p.admin,allowSynthetic:false,registration:{...REGISTRATION}};
  let result;
  {
   failureStage='WRITER_SCOPE';
   need(p.preparedBinding&&equal(p.preparedBinding,a.originalPreparedBinding),'FINAL33_ORIGINAL_PREPARE_BINDING_REQUIRED');
   const inputBinding=api.describeFinalR3InputBinding(p.target,p.admin,p.provision,batchBinding);
   const expected=await api.describeFresh35FinalExecutionBinding(OPERATOR,hostOptions.referenceDirectory,hostOptions.currentService,hostOptions.parentPins,hostOptions.successorSha256,inputBinding,p.preparedBinding);
   need(equal(expected,a.expectedBinding),'FINAL33_ORIGINAL_PREPARE_BINDING_REQUIRED');
   evidence.executionBinding=expected;
   progress.outer('VERIFY_PERSISTED_SCOPE');
   options.explicitZeroApproval=await persistedScope(batchBinding,p.preparedBinding,p.encodedScrypt);
   progress.outer('VERIFY_PERSISTED_SCOPE_ACK');
   const inputs={batchPlanPath:PLAN,batchBinding,options,provision:p.provision,encodedScrypt:p.encodedScrypt,preparedBinding:p.preparedBinding,resume:true,progress:progress.record,applyTiming:progress.wireStage};
   evidence.connectionCleanup='UNKNOWN';
   failureStage='WRITER_CALL';
   progress.outer('WRITER_CALL');
   result=await runPreparedResumeWithBoundary(config,p.target,inputs,hostOptions,inputBinding,a.firstIncomplete);
   progress.outer('WRITER_CALL_ACK');
   evidence.nativeResult=result.result;evidence.state=result.result?.state??'UNKNOWN';
   evidence.connectionCleanup=result.cleanup;evidence.localCleanup=result.local_cleanup??null;evidence.hostVerification=result.host_verification??null;
   if(evidence.state==='COMPLETED'&&result.cleanup==='CLOSED'&&!result.local_cleanup){
    failureStage='WRITER_READBACK';
    progress.outer('WRITER_READBACK');
    const verified=await api.runFinalR3Readback03(config,OPERATOR,p.target,inputs,hostOptions);
    progress.outer('WRITER_READBACK_ACK');
    evidence.verification={state:verified.result?.state??'UNKNOWN'};evidence.readbackConnectionCleanup=verified.cleanup;
    evidence.readbackHostVerification=verified.host_verification??null;evidence.readbackLocalCleanup=verified.local_cleanup??null;
   }
  }
  evidence.connectionCleanup=result.cleanup;evidence.localCleanup=result.local_cleanup??null;evidence.hostVerification=result.host_verification??null;
 }catch(error){
  evidence.failureDiagnostic=describeFailure(error,failureStage);
  evidence.sqlstate=evidence.failureDiagnostic.sqlstate;
  evidence.safeCode=evidence.failureDiagnostic.guardCode==='UNKNOWN'?'FINAL33_NATIVE_OUTCOME_UNCONFIRMED':evidence.failureDiagnostic.guardCode;
 }finally{
  if(options?.explicitZeroApproval)try{await api.closeExplicitZeroApproval(options.explicitZeroApproval)}catch{evidence.approvalCleanup='UNCONFIRMED'}
  p.encodedScrypt=null;p.postgres.password=null;p.admin=null;p.provision=null;
  progress.outer(evidence.failureDiagnostic?'RUNNER_FAILURE':'RUNNER_FINISH');
  evidence.progressCapture=progress.close();
 }
 return evidence;
}
export function successful(v,key){return v.connectionCleanup==='CLOSED'&&!v.localCleanup&&v.approvalCleanup!=='UNCONFIRMED'
 &&(key===PREPARE?v.state==='BATCHED_IMPORT_PREPARED'&&v.nativeResult?.root_state==='ABSENT'
  &&v.nativeResult?.business_database_writes===false&&v.preparedBinding&&v.executionBinding
  :key===WRITER&&v.state==='COMPLETED'&&v.verification?.state==='VERIFIED'&&v.readbackConnectionCleanup==='CLOSED'&&!v.readbackLocalCleanup);}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=await main();process.stdout.write(JSON.stringify(result)+'\n');process.exitCode=successful(result,KEY)?0:2}
 catch(error){const failureDiagnostic=describeFailure(error,'PREFLIGHT');process.stdout.write(JSON.stringify({requestKey:KEY,state:'UNKNOWN',connectionCleanup:'NOT_OPENED',
  safeCode:failureDiagnostic.guardCode==='UNKNOWN'?'FINAL33_PREFLIGHT_REFUSED':failureDiagnostic.guardCode,failureDiagnostic})+'\n');process.exitCode=2}
}
