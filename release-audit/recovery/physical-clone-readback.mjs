/** Database-only checker for T45's protected, bounded physical-clone carrier.
 * The caller owns actual clone provenance, file/auth readers, pool bounds and
 * start/stop. This module grants nothing and never calls the formal loader. */
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {BoundedPostgresPool} from '../../adapters/postgres/src/bounded-pool.ts';
import {loadFresh35CombinedRecordEnvelope} from '../../scripts/release/unified-install/fresh35-combined-record-v1.mjs';
import {reconstructFresh35InstalledProductionTargetV2,describeFresh35CombinedTarget} from '../../scripts/release/unified-install/fresh35-combined-target-v1.mjs';
import {resolveFresh35ReferenceInputPaths,loadFresh35CompactZeroSource,assertFresh35CombinedSourcesCurrent} from '../../scripts/release/unified-install/fresh35-combined-source-v1.mjs';
import {buildFresh35CompactZeroCatalog,describeFresh35CombinedCatalog,assertFresh35CombinedCatalogCurrent,fresh35Admin154ControllerCatalogSql,validateFresh35CombinedRuntimeCatalogObservation,fresh35CombinedOrdinaryCatalogSql,validateFresh35CombinedOrdinaryCatalogObservation} from '../../scripts/release/unified-install/fresh35-combined-catalog-v1.mjs';
import {buildFresh35BatchedHostCatalog} from './fresh35-host-session.mjs';
import {reconcileWholePackage} from './whole-package-reconcile.mjs';
import {runtimeReadbackSql,validateProjection,compareWholePackageRuntimeProjection,ordinaryIdentitySql,runtimeReadIdentitySql} from './physical-clone-projection.mjs';

const installedCatalog=Object.freeze({"catalogSpecSha256":"97853a42224bcab2518965c8b47f785b23dc96d3cbc817c1bed0d901723f582a","modelSha256":"096a084e9d6fddd98277c56adc5688fa9a7fb179286e5e03fc7f6b54cbcedad8","sourceSetSha256":"4785eed1ad97eb67a36b29b0beee11a68aeb1a096d7fc15d5311081f77244220","routineCount":166,"indexCount":116,"relationCount":155});
const model=installedCatalog.modelSha256;
const exactCatalog=description=>Object.entries(installedCatalog).every(([key,value])=>description[key]===value);
const runtimeRole='erp_unified27_runtime_2393dbc6db9581c2';
const initializerRole='erp_unified27_initializer_2393dbc6db9581c2';
const importerRole='erp_unified27_importer_2393dbc6db9581c2';
export const PHYSICAL_CLONE_RESTORE_KEY='t45-r3-final33-independent-restore-20261116-01';
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const digest=/^[a-f0-9]{64}$/;
const need=(ok,code)=>{if(!ok)throw Error(code)};
const ack=(result,command)=>need(result?.command===command,'CLONE_CHECK_QUERY_ACK_INVALID');
const safeCodes=new Set(['CLONE_CHECK_HOST_CURRENT_FAILED','CLONE_CHECK_WINDOW_EXPIRED','CLONE_CHECK_IDLE_CLIENT_REQUIRED','CLONE_CHECK_QUERY_ACK_INVALID','CLONE_CHECK_PHYSICAL_DIFFERS','CLONE_CHECK_RUNTIME_ROLE_DIFFERS','CLONE_CHECK_CATALOG_REPLY_INVALID','CLONE_CHECK_CATALOG_GUARD_ACK_INVALID','CLONE_CHECK_NATIVE_VERIFY_FAILED','CLONE_CHECK_PROJECTION_REPLY_INVALID','CLONE_CHECK_CLEANUP_UNKNOWN']);

/** Uses the protected historical target and the same catalog compiler as the formal writer. */
export async function loadPhysicalCloneReadbackCatalog(sourceRoot,referenceDirectory){
  need(resolve(sourceRoot)===resolve(fileURLToPath(new URL('../../',import.meta.url))),'CLONE_CHECK_RUNNING_SOURCE_ROOT_REQUIRED');
  const target=await reconstructFresh35InstalledProductionTargetV2(await loadFresh35CombinedRecordEnvelope());
  const paths=await resolveFresh35ReferenceInputPaths(referenceDirectory);
  const source=await loadFresh35CompactZeroSource(sourceRoot,{baselineDirectory:paths.baselineDirectory});
  const base=await buildFresh35CompactZeroCatalog(source,target,paths);
  const catalog=await buildFresh35BatchedHostCatalog(source,target,base);
  need(exactCatalog(describeFresh35CombinedCatalog(catalog)),'CLONE_CHECK_ACTUAL_CATALOG166_TARGET_REQUIRED');
  return Object.freeze({source,target,catalog});
}

/** Not an admission API. Only the existing trusted T45 carrier calls this,
 * after reading real protected refs and freezing its actual clone proof.
 * Pools are the existing BoundedPostgresPool with distinct fixed login roles.
 * No fixture, caller JSON or fabricated issuer establishes clone authority. */
export async function checkPhysicalCloneDatabase(input){
  const {source,target,catalog}=input.catalogContext??{};
  const t=describeFresh35CombinedTarget(target),description=describeFresh35CombinedCatalog(catalog);
  need(t.purpose==='PRODUCTION_NEW_EMPTY_EXACT35'&&exactCatalog(description),'CLONE_CHECK_ACTUAL_CATALOG166_TARGET_REQUIRED');
  const clone=Object.freeze({...input.clone});
  need(typeof clone.assertCurrent==='function'&&Number.isSafeInteger(clone.startsAt)&&Number.isSafeInteger(clone.expiresAt)&&clone.startsAt<clone.expiresAt&&
    typeof clone.postmasterStart==='string'&&/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(?:\.\d{1,6})?\+00$/.test(clone.postmasterStart)&&clone.postmasterStart!==t.physical.postmasterStart&&
    typeof clone.controllerLoginValidUntil==='string'&&Number.isFinite(Date.parse(clone.controllerLoginValidUntil))&&Date.parse(clone.controllerLoginValidUntil)<=clone.expiresAt&&
    (clone.runtimeLoginValidUntil===null||(typeof clone.runtimeLoginValidUntil==='string'&&Number.isFinite(Date.parse(clone.runtimeLoginValidUntil)))),'CLONE_CHECK_ACTUAL_CLONE_WINDOW_REQUIRED');
  const {controllerPool,runtimePool}=input;
  need(controllerPool!==runtimePool&&controllerPool instanceof BoundedPostgresPool&&runtimePool instanceof BoundedPostgresPool,'CLONE_CHECK_DISTINCT_BOUNDED_POOLS_REQUIRED');
  const binding=structuredClone(input.binding),initialize=structuredClone(input.initialize);
  const sourceCounts=structuredClone(input.sourceCounts),sourceTotals=structuredClone(input.sourceTotals);
  const warehouseEvidence=structuredClone(input.warehouseEvidence),aggregateEvidence=structuredClone(input.aggregateEvidence);
  const explicitSha=input.expectedExplicitValuesSha256,encodedScrypt=input.encodedScrypt;
  need(binding?.database===t.proposal.database&&[binding.baselineBatchId,binding.documentBatchId,binding.rootOperationId,binding.publishOperationId].every(x=>typeof x==='string'&&uuid.test(x))&&
    binding.baselineBatchId!==binding.documentBatchId&&[binding.manifestSha256,binding.planSha256,binding.scopeSha256,explicitSha].every(x=>typeof x==='string'&&digest.test(x))&&
    initialize?.batch_id===binding.baselineBatchId&&initialize?.payload?.document_batch_id===binding.documentBatchId&&initialize?.package_manifest_sha256===binding.manifestSha256&&initialize?.plan_sha256===binding.planSha256,
    'CLONE_CHECK_FINAL_INIT_BINDING_REQUIRED');
  // Pin the two independently calculated expectation inputs before any SQL.
  need(warehouseEvidence?.format==='R3_WAREHOUSE_SOURCE_EXPECTATIONS_V1'&&warehouseEvidence.manifest?.sha256===binding.manifestSha256&&aggregateEvidence?.references?.manifest?.sha256===binding.manifestSha256,
    'CLONE_CHECK_EXPECTATION_MANIFEST_REQUIRED');
  let phase='CATALOG',catalogResult,nativeResult,runtimeResult;
  let cleanupUnknown=false;
  const current=async role=>{
    const now=Date.now(),until=role==='controller'?Date.parse(clone.controllerLoginValidUntil):clone.runtimeLoginValidUntil===null?clone.expiresAt:Date.parse(clone.runtimeLoginValidUntil);
    need(now>=clone.startsAt&&now<Math.min(clone.expiresAt,until),'CLONE_CHECK_WINDOW_EXPIRED');
    try{await clone.assertCurrent()}catch{throw Error('CLONE_CHECK_HOST_CURRENT_FAILED')}
  };
  // The callback is internal; only the fixed SQL below is submitted. Rollback
  // remains possible after host expiry/revocation and transport cleanup wins.
  const useClient=async(pool,role,work)=>{
    await current(role);
    const raw=await pool.connect();let active=false,discarded=false,failed=true,rollbackAttempted=false;
    const query=async(sql,values)=>{
      if(sql!=='ROLLBACK')await current(role);
      if(sql.startsWith('BEGIN '))active=true;
      if(sql==='ROLLBACK')rollbackAttempted=true;
      const result=await raw.query(sql,values);
      if(sql==='ROLLBACK'&&result?.command==='ROLLBACK')active=false;
      await current(role);
      return result;
    };
    const client={query,discard:async()=>{discarded=true;try{await raw.release(true)}catch{cleanupUnknown=true;throw Error('CLONE_CHECK_CLEANUP_UNKNOWN')}}};
    try{
      need(typeof raw.query==='function'&&typeof raw.release==='function'&&raw.getTransactionStatus?.()==='I','CLONE_CHECK_IDLE_CLIENT_REQUIRED');
      const result=await work(client,raw);
      need(raw.getTransactionStatus()==='I','CLONE_CHECK_IDLE_CLIENT_REQUIRED');
      failed=false;return result;
    }finally{
      if(!discarded){
        if((active||raw.getTransactionStatus?.()!=='I')&&!rollbackAttempted){
          try{ack(await raw.query('ROLLBACK'),'ROLLBACK');need(raw.getTransactionStatus?.()==='I','CLONE_CHECK_IDLE_CLIENT_REQUIRED')}
          catch{cleanupUnknown=true}
        }
        try{await raw.release(failed||cleanupUnknown)}catch{cleanupUnknown=true}
      }
      if(cleanupUnknown)throw Error('CLONE_CHECK_CLEANUP_UNKNOWN');
    }
  };
  const physical=async(client,role,backend)=>{
    const result=await client.query(ordinaryIdentitySql,[role==='controller'?clone.controllerLoginValidUntil:clone.runtimeLoginValidUntil]);ack(result,'SELECT');
    need(result.rows?.length===1,'CLONE_CHECK_PHYSICAL_DIFFERS');const row=result.rows[0];
    const login=role==='controller'?t.proposal.controller:t.proposal.runtime;
    const members=role==='controller'?[[importerRole,false,false,true],[initializerRole,false,false,true]]:[[runtimeRole,false,false,true]];
    need(row.systemIdentifier===t.physical.systemIdentifier&&row.databaseOid===t.physical.databaseOid&&row.database===t.proposal.database&&row.currentUser===login&&row.sessionUser===login&&
      row.serverAddress===(role==='controller'?t.proposal.host:t.ordinary.serverAddress)&&row.serverPort===(role==='controller'?t.proposal.port:t.ordinary.serverPort)&&row.serverVersionNum===t.physical.serverVersionNum&&row.postmasterStart===clone.postmasterStart&&
      row.rowSecurity==='on'&&row.replicationRole==='origin'&&row.recovery===false&&row.ordinaryAttributes===true&&row.lifetimeMatches===true&&JSON.stringify(row.memberships)===JSON.stringify(members)&&
      Number.isSafeInteger(row.backendPid)&&row.backendPid>0&&(backend===undefined||row.backendPid===backend),'CLONE_CHECK_PHYSICAL_DIFFERS');
    return row;
  };
  const catalogQuery=async(client,sql,validate)=>{
    const guards=await client.query(sql.guardSql);
    need(Array.isArray(guards)&&guards.length===2&&guards.every(x=>x.command==='DO'),'CLONE_CHECK_CATALOG_GUARD_ACK_INVALID');
    const observed=await client.query(sql.observationSql);ack(observed,'SELECT');
    need(observed.rows?.length===1,'CLONE_CHECK_CATALOG_REPLY_INVALID');
    return validate(observed.rows[0].catalog_json,catalog,source,target);
  };
  try{
    await current('controller');await assertFresh35CombinedSourcesCurrent(source);await assertFresh35CombinedCatalogCurrent(catalog);
    catalogResult=await useClient(controllerPool,'controller',async client=>{
      const first=await physical(client,'controller');
      ack(await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'),'BEGIN');
      await physical(client,'controller',first.backendPid);
      const observed=await catalogQuery(client,fresh35Admin154ControllerCatalogSql(catalog,source,target,clone.postmasterStart,clone.expiresAt),validateFresh35CombinedRuntimeCatalogObservation);
      await physical(client,'controller',first.backendPid);
      ack(await client.query('ROLLBACK'),'ROLLBACK');return observed;
    });
    phase='NATIVE_PACKAGE';
    nativeResult=await useClient(controllerPool,'controller',async client=>{
      const first=await physical(client,'controller');
      // Preserve the native verifier's exact BEGIN/SET ROLE/verify/ROLLBACK.
      // Recheck the same physical controller after BEGIN, before SET ROLE.
      const nativeClient={...client,query:async(sql,values)=>{
        const result=await client.query(sql,values);
        if(sql==='BEGIN ISOLATION LEVEL READ COMMITTED')await physical(client,'controller',first.backendPid);
        return result;
      }};
      const result=await reconcileWholePackage(nativeClient,initialize,encodedScrypt,sourceCounts,sourceTotals);
      nativeResult=result;
      need(result.state==='VERIFIED','CLONE_CHECK_NATIVE_VERIFY_FAILED');
      await physical(client,'controller',first.backendPid);return result;
    });
    phase='RUNTIME_PROJECTION';
    runtimeResult=await useClient(runtimePool,'runtime',async client=>{
      const first=await physical(client,'runtime');
      ack(await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'),'BEGIN');
      await physical(client,'runtime',first.backendPid);
      ack(await client.query('SET LOCAL ROLE '+runtimeRole),'SET');
      await catalogQuery(client,fresh35CombinedOrdinaryCatalogSql(catalog,source,target,first),validateFresh35CombinedOrdinaryCatalogObservation);
      const runtimeIdentity=async()=>{
        const r=await client.query(runtimeReadIdentitySql);ack(r,'SELECT');const x=r.rows?.[0];
        need(r.rows?.length===1&&x?.database===t.proposal.database&&x.role===runtimeRole&&x.session_user===t.proposal.runtime&&x.server_port===t.ordinary.serverPort&&
          x.row_security==='on'&&x.search_path==='pg_catalog'&&x.replication_role==='origin'&&x.superuser===false&&x.bypass===false&&x.session_superuser===false&&x.session_bypass===false&&
          x.runtime_inherit===false&&x.runtime_membership===false&&x.can_create===false&&x.version_ok===true&&x.gate_ok===true&&x.read_only==='on'&&x.isolation==='repeatable read'&&x.policies_ok===true,
          'CLONE_CHECK_RUNTIME_ROLE_DIFFERS');
      };
      await runtimeIdentity();
      const r=await client.query(runtimeReadbackSql,[binding.baselineBatchId,binding.documentBatchId,binding.manifestSha256,binding.planSha256,binding.rootOperationId,binding.publishOperationId,binding.scopeSha256]);ack(r,'SELECT');
      need(r.rows?.length===1,'CLONE_CHECK_PROJECTION_REPLY_INVALID');validateProjection(r.rows[0],binding);
      const projection={binding,...r.rows[0]},comparison=compareWholePackageRuntimeProjection(projection,warehouseEvidence,aggregateEvidence);
      await runtimeIdentity();
      // RESET ROLE lets the original login repeat the privileged physical read.
      ack(await client.query('RESET ROLE'),'RESET');await physical(client,'runtime',first.backendPid);
      ack(await client.query('ROLLBACK'),'ROLLBACK');
      return {projection,comparison,scopeExplicitDigestMatched:projection.scope_explicit_values_sha256===explicitSha};
    });
    phase='FINAL_SOURCE_CHECK';
    await current('controller');await current('runtime');
    await assertFresh35CombinedSourcesCurrent(source);await assertFresh35CombinedCatalogCurrent(catalog);
    const {comparison,scopeExplicitDigestMatched}=runtimeResult;
    return {publicResult:{format:'D1_R3_PHYSICAL_CLONE_DATABASE_READBACK_V1',requestKey:PHYSICAL_CLONE_RESTORE_KEY,
      state:comparison.state==='FIRST_IMPORT_RECONCILED'&&scopeExplicitDigestMatched?'VERIFIED_CLONE_DATABASE_READBACK_ONLY':'CLONE_DATABASE_READBACK_DIFFERS',phase:'COMPLETE',code:null,
      database:t.proposal.database,systemIdentifier:t.physical.systemIdentifier,databaseOid:t.physical.databaseOid,postmasterStart:clone.postmasterStart,
      routineCount:installedCatalog.routineCount,catalogModelSha256:model,physicalMatched:true,catalogMatched:true,nativePackageState:nativeResult.state,scopeExplicitDigestMatched,
      warehouseMismatchCount:comparison.warehouseMismatches.length,cashMismatchCount:comparison.cashMismatches.length,currentInventory:comparison.currentExplicitInventory,
      currentCashDirectionsDiffer:comparison.currentCashDirectionsDiffer,omittedKeyHasEffects:comparison.omittedKeyHasEffects,
      transactionsRolledBack:true,connectionCleanup:'CLOSED',restoreClosed:false,hostClosure:'T45_OUTER_STOP_READBACK_REQUIRED'},
      detail:{catalog:catalogResult,nativePackage:nativeResult,projection:runtimeResult.projection,comparison}};
  }catch(error){
    return {publicResult:{format:'D1_R3_PHYSICAL_CLONE_DATABASE_READBACK_V1',requestKey:PHYSICAL_CLONE_RESTORE_KEY,
      state:cleanupUnknown?'CLONE_DATABASE_CHECK_CLEANUP_UNKNOWN':'CLONE_DATABASE_CHECK_FAILED',phase,
      code:safeCodes.has(error?.message)?error.message:'CLONE_CHECK_DATABASE_OR_CATALOG_FAILED',
      database:t.proposal.database,systemIdentifier:t.physical.systemIdentifier,databaseOid:t.physical.databaseOid,postmasterStart:clone.postmasterStart,
      routineCount:installedCatalog.routineCount,catalogModelSha256:model,physicalMatched:null,catalogMatched:catalogResult?true:null,nativePackageState:nativeResult?.state??null,
      scopeExplicitDigestMatched:null,warehouseMismatchCount:null,cashMismatchCount:null,currentInventory:null,currentCashDirectionsDiffer:null,omittedKeyHasEffects:null,transactionsRolledBack:null,
      connectionCleanup:cleanupUnknown?'UNKNOWN':'CLOSED',restoreClosed:false,hostClosure:'T45_OUTER_STOP_READBACK_REQUIRED'},detail:{catalog:catalogResult??null,nativePackage:nativeResult??null}};
  }
}
