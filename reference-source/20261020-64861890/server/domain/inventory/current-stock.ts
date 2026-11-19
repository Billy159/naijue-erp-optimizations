import {createHash,randomUUID} from 'node:crypto';
import {formalSourceIncrementComponentReady,activeFormalBaselineRun,approvedUnlistedZeroPolicy} from './formal-current-baseline.js';
import {readFileSync} from 'node:fs';
import {ActionSession,type DataSession} from '../../database/session.js';
import {databaseIdentifier as ident,type DatabaseConfig} from '../../database/config.js';
import {identityAssertionSql} from '../../database/identity.js';
import {renderSql} from '../../database/migrations.js';
import {sqlBlock,sqlLiteral} from '../../database/sql.js';
import {assertProductionAdmission,type ProductionAdmission} from '../../database/production-admission.js';
import {SecurityError} from '../../security/errors.js';
import {inventorySkuDisplaySql} from './sku-display-sql.js';
import {formatScaled,parseScaled} from '../transactions/decimal.js';
import {refreshStandardSkuRelations,readStandardSkuRelationBinding} from '../products/standard-sku-relation.js';

export type StockBasisKind='FORMAL'|'NON_FINAL'|'HISTORY'|'OPENING'|'SOURCE';
export interface StockBasis {kind:StockBasisKind;runId:string;manifestSha256:string|null;sourceSha256:string|null;activated:boolean;sourceSchema:string}
export interface StockBinding {
 id:string;active:boolean;enabled:boolean;state:'BUILDING'|'READY'|'STALE';binding:StockBasis;
 mapping_updated_at:string|null;source_epoch:string|null;change_seq:string;component_sha256:string;
 maintenance_sha256?:string|null;catalog_version?:string|null;reconciliation?:Record<string,unknown>;
}
export interface ResolvedStockLeg {warehouseId:string;skuId:string;quantity:string}
export const inventoryUnitFreeContract='INVENTORY_UNIT_FREE_V1' as const;
const hash=(v:string):string=>createHash('sha256').update(v).digest('hex');
const template=():string=>readFileSync(new URL('../../database/sql/current-standard-stock-v2.sql',import.meta.url),'utf8');
let componentSha256:string|undefined;
export const currentStockComponentSha256=():string=>componentSha256??=hash(template());
export const maintainedStockContract='INVENTORY_MAINTAINED_STOCK_V3' as const;
let maintenanceSha256:string|undefined;
const maintenanceTemplate=()=>readFileSync(new URL('../../database/sql/current-standard-stock-maintenance-v3.sql',import.meta.url),'utf8');
export const currentStockMaintenanceSha256=():string=>maintenanceSha256??=hash(maintenanceTemplate());
const bindingColumns=`id,active,enabled,state,binding,mapping_updated_at,source_epoch,change_seq::text,component_sha256,reconciliation,
 to_jsonb(g)->>'maintenance_sha256' maintenance_sha256,to_jsonb(g)->>'catalog_version' catalog_version`;
export interface StockMaintenanceAdmission {instanceId:string;closedWriteSeamsSha256:string}
async function currentCatalogVersion(session:DataSession,s:string,r:string):Promise<string> {
 const {readStandardSkuState}=await import('../products/standard-sku-read.js');
 return (await readStandardSkuState(session,r,s)).catalogVersion;
}
async function maintenanceInstalled(session:DataSession,r:string):Promise<boolean> {
 schema(r);const row=(await session.query<{present:boolean;columns:number}>(`SELECT to_regclass($1) IS NOT NULL present,
 (SELECT count(*)::integer FROM pg_attribute WHERE NOT attisdropped AND attnum>0
 AND ((attrelid=to_regclass($2) AND attname IN('maintenance_sha256','catalog_version'))
 OR (attrelid=to_regclass($3) AND attname IN('zero_eligible','runtime_zero_eligible')))) columns`,[r+'.inventory_stock_rebuild_dirty',r+'.inventory_stock_generation',r+'.inventory_stock_relation'])).rows[0];
 if(!row||row.present&&row.columns!==4||!row.present&&row.columns!==0)unavailable();return row.present;
}
async function maintainedZeroCoverage(session:DataSession,s:string,r:string,basis:StockBasis):Promise<{policy:Record<string,unknown>|null;warehouseIds:string[]}> {
 if(basis.kind!=='FORMAL')return {policy:null,warehouseIds:[]};
 const run=await activeFormalBaselineRun(session,r);
 if(!run||run.id!==basis.runId||run.manifest_sha256!==basis.manifestSha256||run.source_sha256!==basis.sourceSha256)unavailable();
 const policy=approvedUnlistedZeroPolicy(run);if(!policy)return {policy:null,warehouseIds:[]};
 const rows=(await session.query<{id:string}>(`SELECT w.id FROM ${s}.warehouse w JOIN ${r}.inventory_quantity_identity i ON i.kind='WAREHOUSE' AND i.id=w.id
 WHERE i.target_key='WAREHOUSE:'||w.code AND NOT i.generated_in_target AND i.evidence_sha256 ~ '^[a-f0-9]{64}$'
 AND i.body->>'historicalIdentityAdmission'='true' AND i.body->>'currentCatalogueIdentityOnly'='false' ORDER BY w.id`)).rows;
 return {policy,warehouseIds:rows.map(row=>row.id)};
}
/** Maintenance must enter through the original factory with its complete two-lock plan. */
async function assertStockMaintenanceLocks(session:DataSession,admission:StockMaintenanceAdmission,maxMs=30000):Promise<void> {
 if(!(session instanceof ActionSession)||!admission||!admission.instanceId||admission.instanceId.length>128||!/^[a-f0-9]{64}$/.test(admission.closedWriteSeamsSha256))conflict();
 const ok=(await session.query<{ok:boolean}>(`WITH keys AS (SELECT hashtextextended($1||':'||name,0) k
 FROM unnest(ARRAY['2:reference:inventory-opening-snapshot','5:inventory:posting-ledger']) name)
 SELECT current_setting('transaction_read_only')='off' AND current_setting('transaction_isolation')='read committed'
 AND current_setting('statement_timeout')::interval>interval '0' AND current_setting('statement_timeout')::interval<=interval '15 seconds'
 AND extract(epoch FROM clock_timestamp()-transaction_timestamp())*1000<=$2::integer
 AND (SELECT bool_and(EXISTS(SELECT 1 FROM pg_locks l WHERE l.pid=pg_backend_pid() AND l.locktype='advisory'
 AND l.granted AND l.mode='ExclusiveLock' AND l.objsubid=1
 AND l.classid=((k>>32)&4294967295)::oid AND l.objid=(k&4294967295)::oid)) FROM keys) ok`,[admission.instanceId,maxMs])).rows[0]?.ok;
 if(ok!==true)conflict();
}

const schema=(s:string):void=>{if(!/^"[a-z][a-z0-9_]{0,62}"$/.test(s))throw new SecurityError('VALIDATION',400,'库存读取目标无效');};
const unavailable:()=>never=()=>{throw new SecurityError('INVENTORY_READ_FAILED',503,'库存资料暂未就绪，请稍后重试');};
const conflict:()=>never=()=>{throw new SecurityError('REVISION',409,'库存资料已变化，请重新查询');};
const uuid=(s:string):boolean=>/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s);

export function currentStockSchemaScript(c:DatabaseConfig,admission?:ProductionAdmission):string {
 if(c.environment==='production'){if(!admission)throw new SecurityError('VALIDATION',403,'库存维护授权尚未核实');assertProductionAdmission(c,admission,'database-migrate');}
 else if(!c.database.startsWith('demo_8877_'))throw new SecurityError('VALIDATION',403,'库存维护目标尚未核实');
 const r=ident(c.schemas.runtime),text=renderSql(c,template()),h=currentStockComponentSha256();
 return `BEGIN;SELECT pg_advisory_xact_lock(hashtextextended(${sqlLiteral(c.instanceId+':schema-migrations')},0));
 ${identityAssertionSql(c,'migrator')}
 SET LOCAL ROLE ${ident(c.roles.runtime)};
 DO $stock$ BEGIN
 IF to_regclass(${sqlLiteral(r+'.inventory_stock_generation')}) IS NULL THEN
 IF to_regclass(${sqlLiteral(r+'.inventory_stock_member')}) IS NOT NULL OR to_regclass(${sqlLiteral(r+'.inventory_stock_relation')}) IS NOT NULL
 OR to_regclass(${sqlLiteral(r+'.inventory_stock_standard_cell')}) IS NOT NULL THEN RAISE EXCEPTION 'STOCK_COMPONENT_PARTIAL';END IF;
 EXECUTE ${sqlBlock(text)};
 ELSIF to_regclass(${sqlLiteral(r+'.inventory_stock_member')}) IS NULL OR to_regclass(${sqlLiteral(r+'.inventory_stock_relation')}) IS NULL
 OR to_regclass(${sqlLiteral(r+'.inventory_stock_standard_cell')}) IS NULL THEN RAISE EXCEPTION 'STOCK_COMPONENT_PARTIAL';
 ELSIF EXISTS(SELECT 1 FROM ${r}.inventory_stock_generation WHERE active AND component_sha256<>${sqlLiteral(h)}) THEN RAISE EXCEPTION 'STOCK_COMPONENT_CHANGED';
 END IF;END $stock$;RESET ROLE;COMMIT;`;
}
async function installed(session:DataSession,r:string):Promise<boolean> {
 schema(r);const row=(await session.query<{n:number}>(`SELECT count(*)::integer n FROM unnest($1::text[]) name WHERE to_regclass(name) IS NOT NULL`,
 [ ['inventory_stock_generation','inventory_stock_relation','inventory_stock_member','inventory_stock_standard_cell'].map(n=>r+'.'+n)])).rows[0];
 if(!row)return unavailable();if(row.n!==0&&row.n!==4)unavailable();return row.n===4;
}
async function active(session:DataSession,r:string):Promise<StockBinding|null> {
 if(!await installed(session,r))return null;
 return (await session.query<StockBinding>(`SELECT ${bindingColumns} FROM ${r}.inventory_stock_generation g WHERE active`)).rows[0]??null;
}
export async function resolveStockBasis(session:DataSession,s:string,r:string):Promise<StockBasis> {
 schema(s);schema(r);
 const formal=(await session.query<{present:boolean}>('SELECT to_regclass($1) IS NOT NULL present',[r+'.inventory_formal_baseline_run'])).rows[0]?.present;
 const rows=(await session.query<StockBasis>(`
 SELECT 'HISTORY'::text kind,id AS "runId",manifest_sha256 AS "manifestSha256",NULL::text AS "sourceSha256",true activated FROM ${r}.inventory_history_run
 UNION ALL SELECT 'NON_FINAL',id,manifest_sha256,NULL,true FROM ${r}.inventory_current_export_run
 UNION ALL SELECT 'OPENING',id,body->>'manifestSha256',source_sha256,true FROM ${r}.inventory_opening_run WHERE active
 ${formal?`UNION ALL SELECT 'FORMAL',id,manifest_sha256,source_sha256,EXISTS(SELECT 1 FROM ${r}.inventory_formal_baseline_activation a WHERE a.run_id=f.id) FROM ${r}.inventory_formal_baseline_run f`:''}`)).rows;
 if(rows.length>1)conflict();
 return rows[0]?{...rows[0],sourceSchema:s}:{kind:'SOURCE',runId:'SOURCE',manifestSha256:null,sourceSha256:null,activated:true,sourceSchema:s};
}
async function epochs(session:DataSession,s:string):Promise<{mapping_updated_at:string|null;source_epoch:string|null}> {
 return (await session.query<{mapping_updated_at:string|null;source_epoch:string|null}>(`SELECT
 (SELECT updated_at::text FROM ${s}.system_setting WHERE key='inventory.standard-size-mappings') mapping_updated_at,
 (SELECT jsonb_build_array(batch_id,manifest_sha256)::text FROM ${s}.tplus_import_run WHERE status='COMMITTED'
 ORDER BY committed_at DESC NULLS LAST,started_at DESC LIMIT 1) source_epoch`)).rows[0]??unavailable();
}
const sameBasis=(a:StockBasis,b:StockBasis):boolean=>a.kind===b.kind&&a.runId===b.runId&&a.manifestSha256===b.manifestSha256&&a.sourceSha256===b.sourceSha256&&a.activated===b.activated&&a.sourceSchema===b.sourceSchema;
/** Qualifications are prepared with the generation; ordinary reads never re-admit a source identity. */
export function currentStockZeroQualificationSql(r:string,relation:string,warehouse:string,s:string):string {
 schema(s);schema(r);
 return `(coalesce(${relation}.runtime_zero_eligible,false) AND (EXISTS(SELECT 1 FROM ${s}.warehouse current_warehouse WHERE current_warehouse.id=${warehouse})
 OR EXISTS(SELECT 1 FROM ${r}.master_data_entity current_warehouse WHERE current_warehouse.kind='warehouses' AND current_warehouse.id=(${warehouse})::text)) OR coalesce(${relation}.zero_eligible,false) AND (${warehouse})::text=ANY(ARRAY(
 SELECT jsonb_array_elements_text(coalesce(zero_generation.reconciliation->'zeroWarehouseIds','[]'::jsonb))
 FROM ${r}.inventory_stock_generation zero_generation WHERE zero_generation.id=$1::uuid)))`;
}
/** Optional maintenance/writer probe only. Normal readers use requireCurrentStockBinding.
 * No ledger aggregation, source reconstruction or mapping JSON parsing occurs here. */
export async function readCurrentStockBinding(session:DataSession,r:string,s?:string):Promise<StockBinding|null> {
 const g=await active(session,r);if(!g||!g.enabled)return null;
 if(g.reconciliation?.['maintenanceContract']!==maintainedStockContract||g.reconciliation?.['quantityKeysVerified']!==true||g.reconciliation?.['allCommittedEffectsBound']!==true
 ||g.state!=='READY'||g.component_sha256!==currentStockComponentSha256()||g.maintenance_sha256!==currentStockMaintenanceSha256()||!uuid(g.id)||!/^\d+$/.test(g.change_seq)
 ||!g.binding||!['FORMAL','NON_FINAL','HISTORY','OPENING','SOURCE'].includes(g.binding.kind)
 ||typeof g.binding.runId!=='string'||!g.binding.runId||typeof g.binding.sourceSchema!=='string'
 ||typeof g.binding.activated!=='boolean')return unavailable();
 const source=s??g.binding.sourceSchema;schema(source);if(source!==g.binding.sourceSchema)unavailable();
 const e=await epochs(session,source),b=await resolveStockBasis(session,source,r);
 if(e.mapping_updated_at!==g.mapping_updated_at||e.source_epoch!==g.source_epoch||!sameBasis(b,g.binding)
  ||g.catalog_version!==await currentCatalogVersion(session,source,r))unavailable();
 if(g.binding.kind==='FORMAL'&&!await readStandardSkuRelationBinding(session,source,r,true))unavailable();
 return g;
}
/** Normal current-stock reads fail closed until explicit initialization/catch-up has published READY.
 * Absence or disabled state never authorizes a request-time source/history fallback. */
export async function requireCurrentStockBinding(session:DataSession,r:string,s?:string):Promise<StockBinding> {
 const g=await readCurrentStockBinding(session,r,s);if(!g||!g.binding.activated)return unavailable();
 const proof=g.reconciliation!,mode=proof['buildMode'],transaction=proof['checkedTransaction'];
 if(!await maintenanceInstalled(session,r)||typeof proof['writeSeamsSha256']!=='string'||!/^[a-f0-9]{64}$/.test(proof['writeSeamsSha256'])
 ||typeof transaction!=='string'||!/^\d+$/.test(transaction)
 ||!(mode==='FRESH_LOCKED_V1'&&proof['buildTransaction']===transaction
 ||mode==='DIRTY_KEY_REBUILD_V1'&&proof['finalTransaction']===transaction))return unavailable();
 return g;
}
export const currentStockReadVersion=(g:StockBinding):string=>JSON.stringify([inventoryUnitFreeContract,g.id,g.change_seq,g.binding.runId]);
export async function disableCurrentStockGeneration(session:DataSession,r:string):Promise<void> {
 schema(r);if(!await installed(session,r))return;
 await session.query(`UPDATE ${r}.inventory_stock_generation SET enabled=false,state='STALE' WHERE active`);
}
/** Reuse original source guards only at authorized initialization/SKU/mapping maintenance. */
export async function prepareStockRelations(session:DataSession,s:string,r:string,generation:string,skuIds:readonly string[]=[]):Promise<void> {
 schema(s);schema(r);if(!uuid(generation)||skuIds.length>5000||skuIds.some(id=>!uuid(id)))conflict();
 const scope={source:'(cardinality($2::uuid[])=0 OR v.id=ANY($2::uuid[]))',runtime:'(cardinality($2::uuid[])=0 OR v.id=ANY($2::uuid[]))'};
 const normalized=await readStandardSkuRelationBinding(session,s,r);
 const runtimeZero=await currentStockRuntimeZeroReady(session,s,r,generation);
 await session.query(`WITH ${inventorySkuDisplaySql(s,r,scope,!!normalized)}
 INSERT INTO ${r}.inventory_stock_relation(generation_id,sku_id,product_id,origin,enabled,options,standard_group,standard_fit,standard_code,standard_size,
 fit_id,mapping_status,mapping_revision,mapping_sha256,source_fingerprint,zero_eligible,runtime_zero_eligible)
 SELECT $1::uuid,v.id,v.product_id,v.origin,v.enabled AND NOT coalesce(pp.body->'disabledSkuIds' ? v.id::text,false),coalesce(v.options,'{}'::jsonb),v.standard_group,v.standard_fit,v.standard_code,v.standard_size,
 coalesce(ov.fit_id,v.standard_fit,coalesce(upper(substring(coalesce(f.name,'') from '(?i)([YABCDE])\\\\s*版')),
 CASE WHEN f.name LIKE '%特体%' THEN 'E' WHEN f.name LIKE '%加肥加大%' THEN 'D' WHEN f.name LIKE '%加肥%' THEN 'C'
 WHEN f.name ~ '宽松|偏大|大版' THEN 'B' WHEN f.name ~ '修身|偏小' THEN 'Y' ELSE 'A' END)),
 v.mapping_status,v.mapping_revision,v.mapping_pack_sha256,encode(sha256(convert_to(jsonb_build_array(v.id,v.product_id,v.options,v.mapping_pack_sha256,v.mapping_revision)::text,'UTF8')),'hex'),${normalized?"v.inventory_zero_status='ELIGIBLE'":'false'},${runtimeZero?normalRuntimeZeroEligibilitySql(s,r):'false'}
 FROM skus v LEFT JOIN ${r}.variant_overlay ov ON ov.id=v.id LEFT JOIN ${s}.product p ON p.id=v.product_id LEFT JOIN ${s}.fit f ON f.id=p.fit_id
 LEFT JOIN ${r}.product_profile_overlay pp ON pp.product_id=v.product_id
 ON CONFLICT(generation_id,sku_id) DO UPDATE SET product_id=excluded.product_id,origin=excluded.origin,enabled=excluded.enabled,options=excluded.options,
 standard_group=excluded.standard_group,standard_fit=excluded.standard_fit,standard_code=excluded.standard_code,standard_size=excluded.standard_size,
 fit_id=excluded.fit_id,mapping_status=excluded.mapping_status,mapping_revision=excluded.mapping_revision,mapping_sha256=excluded.mapping_sha256,source_fingerprint=excluded.source_fingerprint,zero_eligible=excluded.zero_eligible,runtime_zero_eligible=excluded.runtime_zero_eligible`,[generation,skuIds]);
}
/** Preparation and final verification use the same actual basis/component prerequisites.
 * Resolve this before rendering SQL so absent optional components are never referenced.
 */
export async function currentStockRuntimeZeroReady(session:DataSession,s:string,r:string,generation:string):Promise<boolean> {
 schema(s);schema(r);if(!uuid(generation))conflict();
 return (await session.query<{ready:boolean}>(`SELECT
 (SELECT count(*) FROM unnest($2::text[]) name WHERE to_regclass(name) IS NOT NULL)=4
 AND binding->>'kind'='FORMAL' AND binding->>'activated'='true' ready
 FROM ${r}.inventory_stock_generation WHERE id=$1::uuid`,[generation,[r+'.inventory_quantity_identity',r+'.inventory_formal_baseline_cell',r+'.generated_barcode',s+'.tplus_inventory_balance_source']])).rows[0]?.ready===true;
}
/** Same normal-runtime admission as maintainNormalRuntimeEmptyStock; prepared once, not re-inferred by GETs. */
function normalRuntimeZeroEligibilitySql(s:string,r:string):string {
 return `v.origin='RUNTIME' AND v.enabled AND v.mapping_status='CONFIRMED_RUNTIME' AND EXISTS(
 SELECT 1 FROM ${r}.variant_overlay ov JOIN ${r}.product_overlay po ON po.id=ov.product_id AND NOT po.deleted
 LEFT JOIN ${r}.product_profile_overlay pp ON pp.product_id=po.id
 WHERE ov.id=v.id AND ov.product_id=v.product_id AND v.options #>> '{COLOR,id}'=ov.color_id::text AND v.options #>> '{SIZE,id}'=ov.size_id::text
 AND v.standard_group=ov.group_name AND v.standard_fit=ov.fit_id AND v.standard_code=ov.size_code AND v.standard_size=ov.size_name
 AND NOT EXISTS(SELECT 1 FROM ${s}.product original WHERE original.id=v.product_id)
 AND NOT EXISTS(SELECT 1 FROM ${s}.variant original WHERE original.id=v.id)
 AND NOT (coalesce(po.body,'{}'::jsonb) ?| ARRAY['currentSourceProduct','currentQuantityEntities','codeOnlySkuEntities'])
 AND NOT (coalesce(pp.body,'{}'::jsonb) ?| ARRAY['currentSourceProduct','currentQuantityEntities','codeOnlySkuEntities'])
 AND NOT EXISTS(SELECT 1 FROM ${r}.inventory_quantity_identity i WHERE i.kind='SKU' AND i.id=v.id)
 AND NOT EXISTS(SELECT 1 FROM ${r}.inventory_formal_baseline_cell b WHERE b.sku_id=v.id)
 AND NOT EXISTS(SELECT 1 FROM ${s}.tplus_inventory_balance_source b WHERE b.variant_id=v.id)
 AND EXISTS(SELECT 1 FROM ${r}.generated_barcode b WHERE b.sku_id=v.id AND b.product_id=v.product_id AND b.barcode<>''
 AND b.evidence->>'source'='T18-new-SKU' AND b.evidence->>'colorId'=ov.color_id::text
 AND b.evidence->>'fitId'=ov.fit_id AND b.evidence->>'sizeId'=ov.size_id::text))`;
}
/** Trusted initialization algebra only. Ordinary reads never call this function. */
export function originalStockRowsSql(s:string,r:string,b:StockBasis):string {
 schema(s);schema(r);
 if(b.kind==='FORMAL'||b.kind==='NON_FINAL')return `SELECT warehouse_id,sku_id,quantity,
 proof->'binding' binding,jsonb_build_object('openingQuantity',confirmed_opening::text,'selectedSourceNet',source_net::text,
 'currentDelta',${b.kind==='FORMAL'?'current_delta':'0::numeric'}::text,
 'sourceMissing',coalesce(proof->>'kind'='POST_ACTIVATION_NEW_QUANTITY_KEY',false)) basis
 FROM ${r}.${b.kind==='FORMAL'?'inventory_formal_baseline_projection':'inventory_current_export_projection'} WHERE run_id=$2`;
 if(b.kind==='HISTORY')return `SELECT warehouse_id,sku_id,quantity,NULL::jsonb binding,
 jsonb_build_object('openingQuantity',opening_quantity::text,'selectedSourceNet','0.0000','currentDelta',current_delta::text,
 'reconciliationDifference',reconciliation_difference::text) basis FROM ${r}.inventory_history_projection WHERE run_id=$2`;
 return `WITH quantities AS (
 SELECT warehouse_id,variant_id sku_id,quantity FROM ${r}.inventory_balance_base
 UNION ALL SELECT warehouse_id,sku_id,quantity FROM ${r}.inventory_delta
 ) SELECT warehouse_id,sku_id,sum(quantity) quantity,NULL::jsonb binding,
 jsonb_build_object('openingQuantity',sum(quantity)::text,'selectedSourceNet','0.0000','currentDelta','0.0000') basis
 FROM quantities WHERE $2::text IS NOT NULL GROUP BY warehouse_id,sku_id`;
}
function allocationCtes(r:string,from:string):string {
 return `facts AS (
 SELECT m.*,v.options #>> '{COLOR,id}' next_color,v.standard_group,v.standard_fit,v.standard_code,v.standard_size,
 CASE WHEN v.standard_group IS NULL OR v.standard_fit IS NULL OR v.standard_code IS NULL OR v.standard_size IS NULL
 OR v.options #>> '{COLOR,id}' IS NULL OR m.product_id IS NULL THEN m.sku_id END unmapped_sku_id
 FROM ${from} m JOIN ${r}.inventory_stock_relation v ON v.generation_id=m.generation_id AND v.sku_id=m.sku_id
 ), tuples AS (SELECT f.*,jsonb_build_array(warehouse_id,product_id,next_color,standard_group,standard_fit,standard_code,standard_size,unmapped_sku_id) next_tuple FROM facts f),
 allocated AS (SELECT t.*,encode(sha256(convert_to(next_tuple::text,'UTF8')),'hex') next_key,
 encode(sha256(convert_to(display_search,'UTF8')),'hex') next_bucket FROM tuples t)`;
}

async function rebuildStandardCells(session:DataSession,r:string,id:string,skus:readonly string[]=[]):Promise<void> {
 const affected=`SELECT cell_key FROM ${r}.inventory_stock_member WHERE generation_id=$1::uuid AND sku_id=ANY($2::uuid[])`;
 const values=skus.length?[id,skus]:[id];
 const insert=async(where:string):Promise<void>=>{
  await session.query(`WITH ${allocationCtes(r,`(SELECT * FROM ${r}.inventory_stock_member WHERE generation_id=$1::uuid AND ${where})`)}
 INSERT INTO ${r}.inventory_stock_standard_cell(generation_id,cell_key,filter_bucket_key,cell_tuple,warehouse_id,product_id,product_key,product_code,color_id,
 standard_group,standard_fit,standard_code,standard_size,unmapped_sku_id,display_search,quantity,member_count,nonzero_count,negative_count)
 SELECT generation_id,next_key,next_bucket,next_tuple,warehouse_id,product_id,product_key,min(product_code),next_color,
 standard_group,standard_fit,standard_code,standard_size,unmapped_sku_id,display_search,
 sum(quantity),count(*),count(*) FILTER(WHERE quantity<>0),count(*) FILTER(WHERE quantity<0)
 FROM allocated GROUP BY generation_id,next_key,next_bucket,next_tuple,warehouse_id,product_id,product_key,next_color,
 standard_group,standard_fit,standard_code,standard_size,unmapped_sku_id,display_search`,values);
 };
 // Retain the other members of old coordinates in PostgreSQL before reallocation.
 // No unbounded array of warehouse/member keys travels through ActionSession.
 if(skus.length){
  await session.query(`DELETE FROM ${r}.inventory_stock_standard_cell WHERE generation_id=$1::uuid AND cell_key IN(${affected})`,values);
  await insert(`NOT(sku_id=ANY($2::uuid[])) AND cell_key IN(${affected})`);
 }
 await session.query(`WITH ${allocationCtes(r,`(SELECT * FROM ${r}.inventory_stock_member WHERE generation_id=$1::uuid AND ${skus.length?'sku_id=ANY($2::uuid[])':'true'})`)}
 UPDATE ${r}.inventory_stock_member m SET color_id=a.next_color,cell_tuple=a.next_tuple,cell_key=a.next_key,filter_bucket_key=a.next_bucket
 FROM allocated a WHERE m.generation_id=a.generation_id AND m.warehouse_id=a.warehouse_id AND m.sku_id=a.sku_id`,values);
 const next=skus.length?`cell_key IN(${affected})`:'true';
 await session.query(`DELETE FROM ${r}.inventory_stock_standard_cell WHERE generation_id=$1::uuid AND ${next}`,values);
 await insert(next);
}
function effectCutoffSql(r:string,b:StockBasis,increment=false):string {
 if(b.kind==='FORMAL'&&increment)return `(SELECT jsonb_build_object('count',count(*),'orderedIdentityDigest',md5(coalesce(string_agg(identity,'|' ORDER BY identity),''))) FROM (
 SELECT 'posting:'||posting_id::text||':'||leg_index::text||':'||quantity::text identity FROM ${r}.inventory_formal_baseline_movement WHERE run_id=$2
 UNION ALL SELECT 'source-receipt:'||id::text||':'||approval_sha256 FROM ${r}.inventory_formal_source_increment WHERE run_id=$2
 UNION ALL SELECT 'source-leg:'||l.receipt_id::text||':'||l.ordinal::text||':'||l.quantity::text FROM ${r}.inventory_formal_source_increment_leg l
 JOIN ${r}.inventory_formal_source_increment h ON h.id=l.receipt_id WHERE h.run_id=$2) cutoff)`;
 if(b.kind==='FORMAL')return `(SELECT jsonb_build_object('count',count(*),'orderedIdentityDigest',md5(coalesce(string_agg(posting_id::text||':'||leg_index::text||':'||quantity::text,'|' ORDER BY posting_id,leg_index),'')))
 FROM ${r}.inventory_formal_baseline_movement WHERE run_id=$2)`;
 if(b.kind==='HISTORY')return `(SELECT jsonb_build_object('count',count(*),'orderedIdentityDigest',md5(coalesce(string_agg(identity||':'||leg_index::text||':'||quantity::text,'|' ORDER BY identity,leg_index),'')))
 FROM ${r}.inventory_history_movement WHERE run_id=$2)`;
 if(b.kind==='NON_FINAL')return "'{\"count\":0,\"orderedIdentityDigest\":\"READONLY_NON_FINAL\"}'::jsonb";
 return `(SELECT jsonb_build_object('count',count(*),'orderedIdentityDigest',md5(coalesce(string_agg(posting_id::text||':'||line_index::text||':'||quantity::text,'|' ORDER BY posting_id,line_index),''))) FROM ${r}.movement)`;
}
/** Caller holds reference:inventory-opening-snapshot + inventory:posting-ledger from transaction start. */
export async function initializeCurrentStockGeneration(session:DataSession,s:string,r:string,{enable=false,maintenance}:{enable?:boolean;maintenance?:StockMaintenanceAdmission}={}):Promise<StockBinding> {
 if(!maintenance)conflict();await assertStockMaintenanceLocks(session,maintenance);
 if(!await installed(session,r)||!await maintenanceInstalled(session,r))unavailable();
 // Mapping/identity preparation belongs to the original batch/master transaction.
 // Initialization consumes its current complete result without rebuilding or artificially advancing the shared catalog version.
 const b=await resolveStockBasis(session,s,r),e=await epochs(session,s),id=randomUUID();
 const standard=await readStandardSkuRelationBinding(session,s,r,b.kind==='FORMAL');if(!standard?.catalogVersionReady)unavailable();
 const catalogVersion=await currentCatalogVersion(session,s,r);
 const sourceIncrement=b.kind==='FORMAL'&&await formalSourceIncrementComponentReady(session,r),zeroCoverage=await maintainedZeroCoverage(session,s,r,b);
 await session.query(`INSERT INTO ${r}.inventory_stock_generation(id,state,component_sha256,binding,mapping_updated_at,source_epoch,maintenance_sha256,catalog_version)
 VALUES($1::uuid,'BUILDING',$2,$3::jsonb,$4,$5,$6,$7)`,[id,currentStockComponentSha256(),JSON.stringify(b),e.mapping_updated_at,e.source_epoch,currentStockMaintenanceSha256(),catalogVersion]);
 await prepareStockRelations(session,s,r,id);
 const rows=originalStockRowsSql(s,r,b);
 await session.query(`WITH raw AS (${rows}), members AS (
 SELECT $1::uuid generation_id,c.warehouse_id,c.sku_id,
 coalesce(c.binding #>> '{display,productId}',v.product_id::text)::uuid product_id,
 coalesce(c.binding #>> '{display,productId}',v.product_id::text,'sku:'||c.sku_id::text) product_key,
 coalesce(c.binding #>> '{display,productCode}',po.code,p.code) product_code,c.quantity,
 CASE WHEN c.binding ? 'display' THEN (c.binding->'display')::text ELSE jsonb_build_object('productId',v.product_id,
 'productCode',coalesce(po.code,p.code),'productName',coalesce(pp.body->>'name',po.body->>'name',p.name),
 'warehouseName',coalesce(wm.body->>'name',wo.name,w.name))::text END display_search,
 jsonb_build_object('binding',coalesce(c.binding,jsonb_build_object('identityKind','POST_ACTIVATION_BUSINESS_SKU',
 'sourceQuantityKey',jsonb_build_array(coalesce(wm.body->>'code',w.code,c.warehouse_id::text),c.sku_id::text),
 'display',jsonb_build_object('productId',v.product_id,'productCode',coalesce(po.code,p.code),'productName',coalesce(pp.body->>'name',po.body->>'name',p.name),
 'warehouseName',coalesce(wm.body->>'name',wo.name,w.name)))),'basis',c.basis) basis_ref
 FROM raw c LEFT JOIN ${r}.inventory_stock_relation v ON v.generation_id=$1::uuid AND v.sku_id=c.sku_id
 LEFT JOIN ${s}.product p ON p.id=v.product_id LEFT JOIN ${r}.product_overlay po ON po.id=v.product_id LEFT JOIN ${r}.product_profile_overlay pp ON pp.product_id=v.product_id
 LEFT JOIN ${s}.warehouse w ON w.id=c.warehouse_id LEFT JOIN ${r}.master_reference_overlay wo ON wo.kind='warehouses' AND wo.id=c.warehouse_id
 LEFT JOIN ${r}.master_data_entity wm ON wm.kind='warehouses' AND wm.id=c.warehouse_id::text
 ), ${allocationCtes(r,'members')}
 INSERT INTO ${r}.inventory_stock_member(generation_id,warehouse_id,sku_id,product_id,product_key,product_code,color_id,
 cell_key,cell_tuple,filter_bucket_key,display_search,quantity,basis_ref)
 SELECT generation_id,warehouse_id,sku_id,product_id,product_key,product_code,next_color,next_key,next_tuple,next_bucket,display_search,quantity,basis_ref FROM allocated`,[id,b.runId]);
 await rebuildStandardCells(session,r,id);
 const verified=(await session.query<{ok:boolean;data:Record<string,unknown>;mismatches:Record<string,unknown>}>(currentStockVerificationSql(s,r,b,await currentStockRuntimeZeroReady(session,s,r,id)),[id,b.runId])).rows[0];
 if(verified?.ok!==true)unavailable();
 const cutoff=(await session.query<{data:Record<string,unknown>}>(`SELECT ${effectCutoffSql(r,b,sourceIncrement)} data WHERE $1::uuid IS NOT NULL`,[id,b.runId])).rows[0]?.data??unavailable();
 const receipt={data:{...verified.data,effectCutoff:cutoff,basis:b,buildMode:'FRESH_LOCKED_V1',buildTransaction:verified.data['checkedTransaction'],
 catalogVersion,writeSeamsSha256:maintenance?.closedWriteSeamsSha256??null,unlistedZeroPolicy:zeroCoverage.policy,zeroWarehouseIds:zeroCoverage.warehouseIds}};
 await session.query(`UPDATE ${r}.inventory_stock_generation SET state='READY',reconciliation=$2::jsonb WHERE id=$1::uuid`,[id,JSON.stringify(receipt.data)]);
 await publishStockGeneration(session,s,r,id,enable,maintenance);
 return (await active(session,r))??unavailable();
}
export async function publishStockGeneration(session:DataSession,s:string,r:string,id:string,enable:boolean,maintenance?:StockMaintenanceAdmission):Promise<void> {
 if(!maintenance)conflict();await assertStockMaintenanceLocks(session,maintenance);
 const g=(await session.query<StockBinding>(`SELECT ${bindingColumns} FROM ${r}.inventory_stock_generation g WHERE id=$1::uuid FOR UPDATE`,[id])).rows[0]??unavailable();
 const e=await epochs(session,s),b=await resolveStockBasis(session,s,r);
 if(g.binding.kind==='FORMAL'&&!await readStandardSkuRelationBinding(session,s,r,true))unavailable();
 if(g.state!=='READY'||g.maintenance_sha256!==currentStockMaintenanceSha256()||g.component_sha256!==currentStockComponentSha256()
  ||g.catalog_version!==await currentCatalogVersion(session,s,r)||e.mapping_updated_at!==g.mapping_updated_at||e.source_epoch!==g.source_epoch||!sameBasis(b,g.binding))unavailable();
 if(enable){
  if(g.binding.kind==='NON_FINAL'||!g.binding.activated)unavailable();
  const valid=(await session.query<{ok:boolean}>(`SELECT reconciliation->>'maintenanceContract'=$2 AND reconciliation->'quantityKeysVerified'='true'::jsonb
 AND reconciliation->'allCommittedEffectsBound'='true'::jsonb AND reconciliation->>'writeSeamsSha256'=$3
 AND ((reconciliation->>'buildMode'='FRESH_LOCKED_V1' AND reconciliation->>'buildTransaction'=txid_current()::text)
 OR (reconciliation->>'buildMode'='DIRTY_KEY_REBUILD_V1' AND reconciliation->>'finalTransaction'=txid_current()::text))
 AND NOT EXISTS(SELECT 1 FROM ${r}.inventory_stock_rebuild_dirty WHERE generation_id=$1::uuid) ok
 FROM ${r}.inventory_stock_generation WHERE id=$1::uuid`,[id,maintainedStockContract,maintenance!.closedWriteSeamsSha256])).rows[0]?.ok;
  if(valid!==true)conflict();
 }
 await session.query(`UPDATE ${r}.inventory_stock_generation SET active=false,enabled=false WHERE active`);
 await session.query(`UPDATE ${r}.inventory_stock_generation SET active=true,enabled=$2 WHERE id=$1::uuid`,[id,enable]);
}

/** Original stock identity, independent of standard display coordinates and source unit labels. */
export interface InventoryStockKey {warehouseId:string;skuId:string}
export interface InventoryStockMutationVersion {inventoryReadVersion:string|null;generationId:string|null;changeSeq:string|null}
/** Capture BUILDING keys in the original writer transaction. Never applies a business quantity twice.
 * Dirty revisions are row-local CAS tokens, never transaction sequence or commit watermarks.
 */
export async function captureCurrentStockRebuildDirty(session:DataSession,r:string,identity:string,keys:readonly InventoryStockKey[]):Promise<void> {
 schema(r);if(!identity||identity.length>512||keys.some(k=>!uuid(k.warehouseId)||!uuid(k.skuId)))conflict();
 const unique=[...new Map(keys.map(k=>[JSON.stringify([k.warehouseId,k.skuId]),k])).values()].sort((a,b)=>a.warehouseId.localeCompare(b.warehouseId)||a.skuId.localeCompare(b.skuId));
 if(!unique.length)return;
 const present=(await session.query<{present:boolean}>('SELECT to_regclass($1) IS NOT NULL present',[r+'.inventory_stock_rebuild_dirty'])).rows[0]?.present;
 if(typeof present!=='boolean')unavailable();
 // Absent additive component is the explicit old-mode compatibility condition, not swallowed errors.
 if(!present)return;
 for(let start=0;start<unique.length;start+=500){const part=unique.slice(start,start+500);
  await session.query(`INSERT INTO ${r}.inventory_stock_rebuild_dirty(generation_id,warehouse_id,sku_id,dirty_revision)
 SELECT g.id,k.warehouse_id,k.sku_id,1 FROM ${r}.inventory_stock_generation g
 CROSS JOIN unnest($1::uuid[],$2::uuid[]) k(warehouse_id,sku_id)
 WHERE g.state='BUILDING' AND NOT g.enabled
 ON CONFLICT(generation_id,warehouse_id,sku_id) DO UPDATE
 SET dirty_revision=${r}.inventory_stock_rebuild_dirty.dirty_revision+1`,[part.map(k=>k.warehouseId),part.map(k=>k.skuId)]);
 }
}
/** Central command hook reads the version after the existing effect writers finish.
 * It must not re-apply legs, synthesize quantities, or declare a BUILDING model readable.
 */
export async function currentStockMutationVersion(session:DataSession,s:string,r:string):Promise<InventoryStockMutationVersion> {
 const g=await readCurrentStockBinding(session,r,s);
 return {inventoryReadVersion:g?currentStockReadVersion(g):null,generationId:g?.id??null,changeSeq:g?.change_seq??null};
}

/** Original resolved writers call this once, after inserting immutable effects in the same transaction. */
export async function applyCurrentStockEffects(session:DataSession,s:string,r:string,basis:Pick<StockBasis,'kind'|'runId'>,identity:string,legs:readonly ResolvedStockLeg[]):Promise<void> {
 await captureCurrentStockRebuildDirty(session,r,identity,legs.map(l=>({warehouseId:l.warehouseId,skuId:l.skuId})));
 const g=await readCurrentStockBinding(session,r,s);if(!g)return;
 if(g.binding.kind!==basis.kind||g.binding.runId!==basis.runId||g.binding.kind==='NON_FINAL'||!g.binding.activated)unavailable();
 if(!identity||identity.length>512||legs.some(l=>!uuid(l.warehouseId)||!uuid(l.skuId)))conflict();
 const totals=new Map<string,ResolvedStockLeg>();
 for(const l of legs){const q=parseScaled(l.quantity,4,false),key=JSON.stringify([l.warehouseId,l.skuId]),old=totals.get(key);
 totals.set(key,{...l,quantity:formatScaled(q+(old?parseScaled(old.quantity,4,false):0n),4)});}
 const skuIds=[...new Set(legs.map(l=>l.skuId))];
 for(let i=0;i<skuIds.length;i+=5000){
  const missing=(await session.query<{id:string}>(`SELECT unnest($2::uuid[]) id EXCEPT SELECT sku_id FROM ${r}.inventory_stock_relation WHERE generation_id=$1::uuid`,[g.id,skuIds.slice(i,i+5000)])).rows.map(x=>x.id);
  if(missing.length)await prepareStockRelations(session,s,r,g.id,missing);
 }
 for(const l of [...totals.values()].sort((a,b)=>JSON.stringify([a.warehouseId,a.skuId]).localeCompare(JSON.stringify([b.warehouseId,b.skuId])))){
  const old=(await session.query<{quantity:string}>(`SELECT quantity::text FROM ${r}.inventory_stock_member WHERE generation_id=$1::uuid AND warehouse_id=$2::uuid AND sku_id=$3::uuid FOR UPDATE`,[g.id,l.warehouseId,l.skuId])).rows[0];
  if(!old){
   // A missing member is zero only if the original post-effect algebra proves
   // its pre-effect quantity was zero. All original identity/quantity guards still run first.
   const original=(await session.query<{quantity:string}>(`WITH raw AS (${originalStockRowsSql(s,r,g.binding)})
 SELECT quantity::text FROM raw WHERE warehouse_id=$3::uuid AND sku_id=$4::uuid
 AND $1::uuid IS NOT NULL`,[g.id,g.binding.runId,l.warehouseId,l.skuId])).rows;
   if(original.length!==1||parseScaled(original[0]!.quantity,4,false)!==parseScaled(l.quantity,4,false))unavailable();
   const inserted=await session.query(`INSERT INTO ${r}.inventory_stock_member(generation_id,warehouse_id,sku_id,product_id,product_key,product_code,color_id,
 cell_key,cell_tuple,filter_bucket_key,display_search,quantity,basis_ref)
 SELECT $1::uuid,$2::uuid,v.sku_id,v.product_id,coalesce(v.product_id::text,'sku:'||v.sku_id::text),coalesce(po.code,p.code),NULL,
 '', '[]'::jsonb,'',jsonb_build_object('productId',v.product_id,'productCode',coalesce(po.code,p.code),
 'productName',coalesce(pp.body->>'name',po.body->>'name',p.name),'warehouseName',coalesce(wm.body->>'name',wo.name,w.name))::text,
 0,jsonb_build_object('binding',jsonb_build_object('identityKind','POST_ACTIVATION_BUSINESS_SKU','sourceQuantityKey',jsonb_build_array(coalesce(wm.body->>'code',w.code,$2::uuid::text),v.sku_id::text),
 'display',jsonb_build_object('productId',v.product_id,'productCode',coalesce(po.code,p.code),'productName',coalesce(pp.body->>'name',po.body->>'name',p.name),
 'warehouseName',coalesce(wm.body->>'name',wo.name,w.name))),'basis',jsonb_build_object('openingQuantity','0.0000','selectedSourceNet','0.0000','currentDelta','0.0000',
 'sourceMissing',${g.binding.kind==='FORMAL'?'true':'false'}))
 FROM ${r}.inventory_stock_relation v LEFT JOIN ${s}.product p ON p.id=v.product_id LEFT JOIN ${r}.product_overlay po ON po.id=v.product_id
 LEFT JOIN ${r}.product_profile_overlay pp ON pp.product_id=v.product_id LEFT JOIN ${s}.warehouse w ON w.id=$2::uuid
 LEFT JOIN ${r}.master_reference_overlay wo ON wo.kind='warehouses' AND wo.id=$2::uuid LEFT JOIN ${r}.master_data_entity wm ON wm.kind='warehouses' AND wm.id=$2::uuid::text
 WHERE v.generation_id=$1::uuid AND v.sku_id=$3::uuid`,[g.id,l.warehouseId,l.skuId]);
   if(inserted.rowCount!==1)unavailable();
   await rebuildStandardCells(session,r,g.id,[l.skuId]);
  }
  const before=parseScaled(old?.quantity??'0.0000',4,false),after=before+parseScaled(l.quantity,4,false);
  const bucket=(await session.query<{cell_key:string;filter_bucket_key:string}>(`UPDATE ${r}.inventory_stock_member
 SET quantity=$4::numeric,basis_ref=jsonb_set(basis_ref,'{basis,currentDelta}',to_jsonb((coalesce(basis_ref #>> '{basis,currentDelta}','0')::numeric+$5::numeric)::text))
 WHERE generation_id=$1::uuid AND warehouse_id=$2::uuid AND sku_id=$3::uuid RETURNING cell_key,filter_bucket_key`,
 [g.id,l.warehouseId,l.skuId,formatScaled(after,4),l.quantity])).rows[0]??unavailable();
  const nz=Number(after!==0n)-Number(before!==0n),neg=Number(after<0n)-Number(before<0n);
  const changed=await session.query(`UPDATE ${r}.inventory_stock_standard_cell SET quantity=quantity+$4::numeric,
 nonzero_count=nonzero_count+$5,negative_count=negative_count+$6 WHERE generation_id=$1::uuid AND cell_key=$2 AND filter_bucket_key=$3 RETURNING cell_key`,
 [g.id,bucket.cell_key,bucket.filter_bucket_key,l.quantity,nz,neg]);
  if(changed.rowCount!==1)unavailable();
 }
 await session.query(`UPDATE ${r}.inventory_stock_generation SET change_seq=change_seq+1 WHERE id=$1::uuid`,[g.id]);
}
/** Preserve the original unitless legacy algebra; resolve only the affected original cells after its delta insert. */
export async function applyLegacyStockEffects(session:DataSession,r:string,identity:string,effects:readonly {warehouse:string;sku:string;quantity:bigint}[]):Promise<void> {
 const g=await active(session,r);if(!g?.enabled){
  await captureCurrentStockRebuildDirty(session,r,identity,effects.map(l=>({warehouseId:l.warehouse,skuId:l.sku})));return;
 }
 const s=g.binding.sourceSchema;if(!s)unavailable();
 const b=await resolveStockBasis(session,s,r);
 if(b.kind!=='OPENING'&&b.kind!=='SOURCE')unavailable();
 const ids=[...new Set(effects.map(l=>l.sku))],legs:ResolvedStockLeg[]=[];
 for(let offset=0;offset<ids.length;offset+=5000){
  const actual=(await session.query<{warehouse_id:string;sku_id:string;quantity:string}>(`WITH raw AS (${originalStockRowsSql(s,r,b)})
 SELECT warehouse_id,sku_id,quantity::text FROM raw WHERE sku_id=ANY($1::uuid[]) AND $2::text IS NOT NULL`,[ids.slice(offset,offset+5000),b.runId])).rows;
  for(const l of effects.filter(l=>ids.slice(offset,offset+5000).includes(l.sku))){
   if(!actual.some(a=>a.warehouse_id===l.warehouse&&a.sku_id===l.sku))unavailable();
   legs.push({warehouseId:l.warehouse,skuId:l.sku,quantity:formatScaled(l.quantity,4)});
  }
 }
 await applyCurrentStockEffects(session,s,r,b,identity,legs);
}
/** Finite lifecycle hooks; all authorization and the complete lock declaration stay with the original caller. */
export async function refreshStockRelationsForSkus(session:DataSession,s:string,r:string,skuIds:readonly string[]):Promise<void> {
 const products=(await session.query<{product_id:string}>(`SELECT DISTINCT product_id FROM (SELECT id,product_id FROM ${s}.variant UNION ALL SELECT id,product_id FROM ${r}.variant_overlay) v WHERE id=ANY($1::uuid[])`,[[...new Set(skuIds)]])).rows.map(row=>row.product_id);
 await refreshStandardSkuRelations(session,s,r,products);
 await invalidateBuildingStockRelations(session,r);
 await refreshStockOnlyRelationsForSkus(session,s,r,skuIds);
}
async function invalidateBuildingStockRelations(session:DataSession,r:string):Promise<void> {
 if(!await installed(session,r))return;
 await session.query(`UPDATE ${r}.inventory_stock_generation SET state='STALE',enabled=false,
 reconciliation=reconciliation||jsonb_build_object('invalidatedBy','CATALOG_OR_MAPPING_CHANGED') WHERE state='BUILDING'`);
}
async function refreshStockOnlyRelationsForSkus(session:DataSession,s:string,r:string,skuIds:readonly string[],publishVersion=true):Promise<void> {
 const g=await active(session,r);if(!g?.enabled)return;
 if(g.state!=='READY'||g.component_sha256!==currentStockComponentSha256()||g.maintenance_sha256!==currentStockMaintenanceSha256())unavailable();
 const e=await epochs(session,s),basis=await resolveStockBasis(session,s,r);
 if(e.mapping_updated_at!==g.mapping_updated_at||e.source_epoch!==g.source_epoch||!sameBasis(basis,g.binding))unavailable();
 const ids=[...new Set(skuIds)];if(ids.length===0)return;
 for(let i=0;i<ids.length;i+=5000){const part=ids.slice(i,i+5000);await prepareStockRelations(session,s,r,g.id,part);
  await session.query(`UPDATE ${r}.inventory_stock_member m SET product_code=coalesce(po.code,p.code),display_search=jsonb_build_object(
 'productId',v.product_id,'productCode',coalesce(po.code,p.code),'productName',coalesce(pp.body->>'name',po.body->>'name',p.name))::text
 FROM ${r}.inventory_stock_relation v LEFT JOIN ${s}.product p ON p.id=v.product_id
 LEFT JOIN ${r}.product_overlay po ON po.id=v.product_id LEFT JOIN ${r}.product_profile_overlay pp ON pp.product_id=v.product_id
 WHERE m.generation_id=$1::uuid AND v.generation_id=m.generation_id AND m.sku_id=v.sku_id AND m.sku_id=ANY($2::uuid[])`,[g.id,part]);
  await rebuildStandardCells(session,r,g.id,part);}
 if(publishVersion){const version=await currentCatalogVersion(session,s,r);
 await session.query(`UPDATE ${r}.inventory_stock_generation SET catalog_version=$2,change_seq=change_seq+1 WHERE id=$1::uuid`,[g.id,version]);}
}
export async function refreshStockRelationsForProducts(session:DataSession,s:string,r:string,productIds:readonly string[]):Promise<void> {
 await refreshStandardSkuRelations(session,s,r,productIds);
 await maintainCurrentStockCatalogForProducts(session,s,r,productIds);
}
/** The existing master writer already prepared the complete standard catalog.
 * Refresh only its exact affected products, then publish the same transaction's catalog version.
 * An empty affected set is a proven metadata-only change, never a source rebind.
 */
export async function maintainCurrentStockCatalogForProducts(session:DataSession,s:string,r:string,productIds:readonly string[]):Promise<void> {
 if(productIds.length>5000||productIds.some(id=>!uuid(id)))conflict();
 await invalidateBuildingStockRelations(session,r);
 const g=await active(session,r);if(!g?.enabled)return;
 const e=await epochs(session,s),basis=await resolveStockBasis(session,s,r);
 if(g.state!=='READY'||g.maintenance_sha256!==currentStockMaintenanceSha256()||g.component_sha256!==currentStockComponentSha256()
 ||e.mapping_updated_at!==g.mapping_updated_at||e.source_epoch!==g.source_epoch||!sameBasis(basis,g.binding))unavailable();
 for(let offset=0;offset<productIds.length;offset+=5000){
  let cursor='00000000-0000-0000-0000-000000000000';
  for(;;){const ids=(await session.query<{id:string}>(`SELECT sku_id id FROM ${r}.standard_sku_relation
 WHERE product_id=ANY($1::uuid[]) AND sku_id>$2::uuid ORDER BY sku_id LIMIT 1000`,[productIds.slice(offset,offset+5000),cursor])).rows.map(x=>x.id);
   if(!ids.length)break;await refreshStockOnlyRelationsForSkus(session,s,r,ids,false);cursor=ids.at(-1)!;
  }
 }
 const coherent=(await session.query<{ok:boolean}>(`SELECT NOT EXISTS(SELECT 1 FROM ${r}.standard_sku_relation original FULL JOIN
 (SELECT * FROM ${r}.inventory_stock_relation WHERE generation_id=$1::uuid) current USING(sku_id)
 WHERE original.sku_id IS NULL OR current.sku_id IS NULL OR ROW(current.product_id,current.options,current.standard_group,current.standard_fit,current.standard_code,current.standard_size,current.mapping_status,current.mapping_revision,current.mapping_sha256)
 IS DISTINCT FROM ROW(original.product_id,original.options,original.standard_group,original.standard_fit,original.standard_code,original.standard_size,original.mapping_status,original.mapping_revision,original.mapping_sha256)) ok`,[g.id])).rows[0]?.ok;
 if(coherent!==true)unavailable();
 await session.query(`UPDATE ${r}.inventory_stock_generation SET catalog_version=$2,change_seq=change_seq+1 WHERE id=$1::uuid`,[g.id,await currentCatalogVersion(session,s,r)]);
}
/** Runtime-new SKU empty stock is a maintained qualification, not a physical zero member.
 * Its original product/SKU/barcode guards run in prepareStockRelations once at the metadata write.
 * Finite point/product reads consume runtime_zero_eligible; inventory never expands absent warehouses.
 */
export async function maintainNormalRuntimeEmptyStock(session:DataSession,s:string,r:string,productId:string):Promise<number> {
 schema(s);schema(r);if(!uuid(productId))conflict();
 const g=await readCurrentStockBinding(session,r,s);if(!g||g.binding.kind!=='FORMAL'||!g.binding.activated)return 0;
 return 0;
}
export async function currentStockBasisChanged(session:DataSession,s:string,r:string):Promise<void> {
 schema(s);if(!await installed(session,r))return;
 // A changed basis is authoritative immediately; no old generation can be re-stamped or re-enabled.
 // Normal reads remain not-ready until a fresh locked or fully caught-up new generation is verified.
 await session.query(`UPDATE ${r}.inventory_stock_generation SET state='STALE',enabled=false,
 reconciliation=reconciliation||jsonb_build_object('invalidatedBy','BASIS_CHANGED') WHERE active OR state='BUILDING'`);
}
export async function currentStockSourceChanged(session:DataSession,s:string,r:string):Promise<void> {
 schema(s);await refreshStandardSkuRelations(session,s,r);
 if(!await installed(session,r))return;
 // Native historical-body imports change provenance, never add a quantity contribution.
 await session.query(`UPDATE ${r}.inventory_stock_generation SET state='STALE',enabled=false,
 reconciliation=reconciliation||jsonb_build_object('invalidatedBy','SOURCE_CHANGED') WHERE active OR state='BUILDING'`);
}

/** Point reads retain original warehouse/SKU identity and the legacy quantity algebra. */
export async function readCurrentStockPointBalance(session:DataSession,r:string,warehouse:string,sku:string):Promise<string|null> {
 const g=await readCurrentStockBinding(session,r);if(!g||g.binding.kind==='NON_FINAL')return null;
 const rows=(await session.query<{quantity:string}>(`SELECT CASE WHEN m.sku_id IS NOT NULL THEN m.quantity::text ELSE '0.0000' END quantity
 FROM ${r}.inventory_stock_relation v LEFT JOIN ${r}.inventory_stock_member m
 ON m.generation_id=v.generation_id AND m.warehouse_id=$2::uuid AND m.sku_id=v.sku_id
 WHERE v.generation_id=$1::uuid AND v.sku_id=$3::uuid
 AND (m.sku_id IS NOT NULL OR ${currentStockZeroQualificationSql(r,'v','$2::uuid',g.binding.sourceSchema)})`,[g.id,warehouse,sku])).rows;
 if(rows.length>1)unavailable();
 if(!rows.length){
  const identity=(await session.query<{reason:string}>(`SELECT CASE WHEN v.zero_eligible THEN 'WAREHOUSE_ZERO_NOT_ADMITTED'
 WHEN v.origin='RUNTIME' THEN 'RUNTIME_ZERO_NOT_PROVEN' ELSE coalesce(domain.inventory_zero_status,'SKU_QUANTITY_IDENTITY_NOT_PREPARED') END reason
 FROM ${r}.inventory_stock_relation v LEFT JOIN ${r}.standard_sku_relation domain ON domain.sku_id=v.sku_id
 WHERE v.generation_id=$1::uuid AND v.sku_id=$2::uuid`,[g.id,sku])).rows[0];
  throw new SecurityError('INVENTORY_QUANTITY_MISSING',503,'此仓库、原规格缺少可靠库存数量',{warehouseId:warehouse,skuId:sku,reason:identity?.reason??'STOCK_RELATION_MISSING'});
 }
 return formatScaled(rows.reduce((n,row)=>n+parseScaled(row.quantity,4,false),0n),4);
}
/** T45 supplies its already approved single-key CAS, on this same locked transaction.
 * Large mapping payloads stay on its native maintenance client, outside ActionSession.
 * Only normalized display ownership changes; member quantity is checked before/after.
 */
export async function maintainApprovedStockMapping(session:DataSession,s:string,r:string,
 expected:{generationId:string;readVersion:string;updatedAt:string|null;valueMd5:string;nextPackSha256:string;nextRevision:string},
 writeApprovedSourceKey:()=>Promise<void>):Promise<{generationId:string;readVersion:string;mappingUpdatedAt:string|null;quantityUnchanged:true}> {
 schema(s);schema(r);
 const g=await readCurrentStockBinding(session,r,s)??conflict();
 if(g.id!==expected.generationId||currentStockReadVersion(g)!==expected.readVersion
 ||!/^[a-f0-9]{32}$/.test(expected.valueMd5)||!/^[a-f0-9]{64}$/.test(expected.nextPackSha256)||!expected.nextRevision)conflict();
 const prior=(await session.query<{updated_at:string;md5:string}>(`SELECT updated_at::text,md5(value::text) FROM ${s}.system_setting
 WHERE key='inventory.standard-size-mappings' FOR UPDATE`)).rows[0]??conflict();
 if(prior.updated_at!==expected.updatedAt||prior.md5!==expected.valueMd5)conflict();
 const signature=async():Promise<string> => (await session.query<{signature:string}>(`SELECT encode(sha256(convert_to(coalesce(
 string_agg(jsonb_build_array(warehouse_id,sku_id,quantity)::text,'|' ORDER BY warehouse_id,sku_id),''),'UTF8')),'hex') signature
 FROM ${r}.inventory_stock_member WHERE generation_id=$1::uuid`,[g.id])).rows[0]?.signature??unavailable();
 const before=await signature();
 await writeApprovedSourceKey();
 const next=(await session.query<{updated_at:string;pack:string;revision:string}>(`SELECT updated_at::text,value->>'packSha256' pack,value->>'revision' revision
 FROM ${s}.system_setting WHERE key='inventory.standard-size-mappings'`)).rows[0]??conflict();
 if(next.updated_at===prior.updated_at||next.pack!==expected.nextPackSha256||next.revision!==expected.nextRevision)conflict();
 await refreshStandardSkuRelations(session,s,r);
 await invalidateBuildingStockRelations(session,r);
 // A whole package changes every relation's provenance, including unchanged mappings.
 await prepareStockRelations(session,s,r,g.id);
 await rebuildStandardCells(session,r,g.id);
 if(await signature()!==before)unavailable();
 await session.query(`UPDATE ${r}.inventory_stock_generation SET mapping_updated_at=$2,catalog_version=$3,change_seq=change_seq+1
 WHERE id=$1::uuid AND active AND state='READY'`,[g.id,next.updated_at,await currentCatalogVersion(session,s,r)]);
 const current=await readCurrentStockBinding(session,r,s)??unavailable();
 return {generationId:g.id,readVersion:currentStockReadVersion(current),mappingUpdatedAt:next.updated_at,quantityUnchanged:true};
}





export interface StockRebuildProgress {generationId:string;state:'BUILDING'|'READY'|'STALE';phase:string;processed:number;remainingDirty:number}
/** Begin only the short capture window; do not scan balances or certify an old disabled generation. */
export async function beginCurrentStockRebuild(session:DataSession,s:string,r:string,maintenance:StockMaintenanceAdmission):Promise<string> {
 if(!await installed(session,r)||!await maintenanceInstalled(session,r))unavailable();
 await assertStockMaintenanceLocks(session,maintenance,1500);
 const basis=await resolveStockBasis(session,s,r),e=await epochs(session,s),catalog=await currentCatalogVersion(session,s,r),id=randomUUID();
 if(!basis.activated||basis.kind==='NON_FINAL'||basis.kind==='FORMAL'&&!await readStandardSkuRelationBinding(session,s,r,true))unavailable();
 const zeroCoverage=await maintainedZeroCoverage(session,s,r,basis);
 await session.query(`INSERT INTO ${r}.inventory_stock_generation(id,state,component_sha256,binding,mapping_updated_at,source_epoch,
 maintenance_sha256,catalog_version,reconciliation) VALUES($1::uuid,'BUILDING',$2,$3::jsonb,$4,$5,$6,$7,$8::jsonb)`,
 [id,currentStockComponentSha256(),JSON.stringify(basis),e.mapping_updated_at,e.source_epoch,currentStockMaintenanceSha256(),catalog,
 JSON.stringify({maintenanceContract:maintainedStockContract,buildMode:'DIRTY_KEY_REBUILD_V1',phase:'RELATIONS',relationCursor:null,memberCursor:null,
 scannedRelations:0,scannedMembers:0,unlistedZeroPolicy:zeroCoverage.policy,zeroWarehouseIds:zeroCoverage.warehouseIds,writeSeamsSha256:maintenance.closedWriteSeamsSha256,quantityKeysVerified:false,allCommittedEffectsBound:false})]);
 await assertStockMaintenanceLocks(session,maintenance,1500);return id;
}
async function buildingStock(session:DataSession,s:string,r:string,id:string):Promise<StockBinding|null> {
 if(!uuid(id))conflict();
 const g=(await session.query<StockBinding>(`SELECT ${bindingColumns} FROM ${r}.inventory_stock_generation g
 WHERE id=$1::uuid FOR NO KEY UPDATE`,[id])).rows[0]??unavailable();
 if(g.state==='STALE')return null;
 if(g.state!=='BUILDING'||g.enabled||g.maintenance_sha256!==currentStockMaintenanceSha256()||g.component_sha256!==currentStockComponentSha256()
 ||g.reconciliation?.['maintenanceContract']!==maintainedStockContract||g.reconciliation?.['buildMode']!=='DIRTY_KEY_REBUILD_V1')conflict();
 const e=await epochs(session,s),basis=await resolveStockBasis(session,s,r),catalog=await currentCatalogVersion(session,s,r);
 if(e.mapping_updated_at!==g.mapping_updated_at||e.source_epoch!==g.source_epoch||!sameBasis(basis,g.binding)||catalog!==g.catalog_version
 ||g.binding.kind==='FORMAL'&&!await readStandardSkuRelationBinding(session,s,r,true)){
  await session.query(`UPDATE ${r}.inventory_stock_generation SET state='STALE',enabled=false,
 reconciliation=reconciliation||jsonb_build_object('invalidatedBy','BUILD_DEPENDENCY_CHANGED') WHERE id=$1::uuid`,[id]);return null;
 }
 return g;
}
async function stockDirtyCount(session:DataSession,r:string,id:string):Promise<number> {
 const n=(await session.query<{n:number}>(`SELECT count(*)::integer n FROM ${r}.inventory_stock_rebuild_dirty WHERE generation_id=$1::uuid`,[id])).rows[0]?.n;
 if(!Number.isSafeInteger(n)||(n??-1)<0)unavailable();return n!;
}
/** Replace the finite original-key balances from the same authoritative view used by fresh initialization.
 * This never adds an effect. CAS retries re-read absolute balances, so no quantity can be doubled.
 */
async function refreshBuildingStockKeys(session:DataSession,s:string,r:string,g:StockBinding,keys:readonly InventoryStockKey[]):Promise<void> {
 if(!keys.length)return;if(keys.length>200)conflict();
 const skus=[...new Set(keys.map(k=>k.skuId))];await prepareStockRelations(session,s,r,g.id,skus);
 const params=[g.id,g.binding.runId,keys.map(k=>k.warehouseId),keys.map(k=>k.skuId)] as const;
 const missing=(await session.query<{bad:boolean}>(`WITH raw AS (${originalStockRowsSql(s,r,g.binding)}),
 keys AS (SELECT * FROM unnest($3::uuid[],$4::uuid[]) k(warehouse_id,sku_id))
 SELECT EXISTS(SELECT 1 FROM raw x JOIN keys USING(warehouse_id,sku_id)
 GROUP BY warehouse_id,sku_id HAVING count(*)<>1 OR bool_or(quantity IS NULL))
 OR EXISTS(SELECT 1 FROM ${r}.inventory_stock_member m JOIN keys k USING(warehouse_id,sku_id)
 WHERE m.generation_id=$1::uuid AND NOT EXISTS(SELECT 1 FROM raw x WHERE x.warehouse_id=m.warehouse_id AND x.sku_id=m.sku_id)) bad`,params)).rows[0]?.bad;
 if(missing!==false)unavailable();
 await session.query(`WITH authoritative AS (${originalStockRowsSql(s,r,g.binding)}), keys AS (
 SELECT * FROM unnest($3::uuid[],$4::uuid[]) k(warehouse_id,sku_id)
 ), raw AS (SELECT a.* FROM authoritative a JOIN keys k USING(warehouse_id,sku_id)), members AS (
 SELECT $1::uuid generation_id,c.warehouse_id,c.sku_id,
 coalesce(c.binding #>> '{display,productId}',v.product_id::text)::uuid product_id,
 coalesce(c.binding #>> '{display,productId}',v.product_id::text,'sku:'||c.sku_id::text) product_key,
 coalesce(c.binding #>> '{display,productCode}',po.code,p.code) product_code,c.quantity,
 CASE WHEN c.binding ? 'display' THEN (c.binding->'display')::text ELSE jsonb_build_object('productId',v.product_id,
 'productCode',coalesce(po.code,p.code),'productName',coalesce(pp.body->>'name',po.body->>'name',p.name),
 'warehouseName',coalesce(wm.body->>'name',wo.name,w.name))::text END display_search,
 jsonb_build_object('binding',coalesce(c.binding,jsonb_build_object('identityKind','POST_ACTIVATION_BUSINESS_SKU',
 'sourceQuantityKey',jsonb_build_array(coalesce(wm.body->>'code',w.code,c.warehouse_id::text),c.sku_id::text),
 'display',jsonb_build_object('productId',v.product_id,'productCode',coalesce(po.code,p.code),'productName',coalesce(pp.body->>'name',po.body->>'name',p.name),
 'warehouseName',coalesce(wm.body->>'name',wo.name,w.name)))),'basis',c.basis) basis_ref
 FROM raw c LEFT JOIN ${r}.inventory_stock_relation v ON v.generation_id=$1::uuid AND v.sku_id=c.sku_id
 LEFT JOIN ${s}.product p ON p.id=v.product_id LEFT JOIN ${r}.product_overlay po ON po.id=v.product_id LEFT JOIN ${r}.product_profile_overlay pp ON pp.product_id=v.product_id
 LEFT JOIN ${s}.warehouse w ON w.id=c.warehouse_id LEFT JOIN ${r}.master_reference_overlay wo ON wo.kind='warehouses' AND wo.id=c.warehouse_id
 LEFT JOIN ${r}.master_data_entity wm ON wm.kind='warehouses' AND wm.id=c.warehouse_id::text
 ), ${allocationCtes(r,'members')}
 INSERT INTO ${r}.inventory_stock_member(generation_id,warehouse_id,sku_id,product_id,product_key,product_code,color_id,
 cell_key,cell_tuple,filter_bucket_key,display_search,quantity,basis_ref)
 SELECT generation_id,warehouse_id,sku_id,product_id,product_key,product_code,next_color,next_key,next_tuple,next_bucket,display_search,quantity,basis_ref FROM allocated
 ON CONFLICT(generation_id,warehouse_id,sku_id) DO UPDATE SET quantity=excluded.quantity,basis_ref=excluded.basis_ref,
 product_id=excluded.product_id,product_key=excluded.product_key,product_code=excluded.product_code,display_search=excluded.display_search`,params);
 await rebuildStandardCells(session,r,g.id,skus);
}
/** One genuine RR READ WRITE transaction per call. The worker persists its job separately via the existing owner. */
export async function advanceCurrentStockRebuild(session:DataSession,s:string,r:string,id:string,size=200):Promise<StockRebuildProgress> {
 await assertStockRebuildSnapshot(session);
 if(!Number.isSafeInteger(size)||size<1||size>200)conflict();
 const g=await buildingStock(session,s,r,id);if(!g)return {generationId:id,state:'STALE',phase:'STALE',processed:0,remainingDirty:0};
 const progress=g.reconciliation!,phase=String(progress['phase']);let processed=0,next={...progress};
 if(phase==='RELATIONS'){
  const cursor=progress['relationCursor'];if(cursor!==null&&(typeof cursor!=='string'||!uuid(cursor)))conflict();
  const rows=(await session.query<{id:string}>(`SELECT sku_id id FROM ${r}.standard_sku_relation
 WHERE ($1::uuid IS NULL OR sku_id>$1::uuid) ORDER BY sku_id LIMIT $2`,[cursor as string|null,size])).rows;
  if(rows.length)await prepareStockRelations(session,s,r,id,rows.map(row=>row.id));
  processed=rows.length;next={...next,relationCursor:rows.at(-1)?.id??cursor,scannedRelations:Number(progress['scannedRelations'])+processed,
   ...(rows.length<size?{phase:'MEMBERS'}:{})};
 }else if(phase==='MEMBERS'){
  const cursor=progress['memberCursor'];if(cursor!==null&&(!Array.isArray(cursor)||cursor.length!==2||cursor.some(v=>typeof v!=='string'||!uuid(v))))conflict();
  const rows=(await session.query<{warehouseId:string;skuId:string}>(`WITH raw AS (${originalStockRowsSql(s,r,g.binding)})
 SELECT warehouse_id "warehouseId",sku_id "skuId" FROM raw WHERE $1::uuid IS NOT NULL
 AND ($3::uuid IS NULL OR (warehouse_id,sku_id)>($3::uuid,$4::uuid)) ORDER BY warehouse_id,sku_id LIMIT $5`,
 [id,g.binding.runId,Array.isArray(cursor)?cursor[0] as string:null,Array.isArray(cursor)?cursor[1] as string:null,size])).rows;
  if(rows.length)await refreshBuildingStockKeys(session,s,r,g,rows);
  processed=rows.length;const last=rows.at(-1);next={...next,memberCursor:last?[last.warehouseId,last.skuId]:cursor,
   scannedMembers:Number(progress['scannedMembers'])+processed,...(rows.length<size?{phase:'CATCHUP'}:{})};
 }else if(phase!=='CATCHUP')conflict();
 await session.query(`UPDATE ${r}.inventory_stock_generation SET reconciliation=$2::jsonb,change_seq=change_seq+1
 WHERE id=$1::uuid AND state='BUILDING'`,[id,JSON.stringify(next)]);
 return {generationId:id,state:'BUILDING',phase:String(next['phase']),processed,remainingDirty:await stockDirtyCount(session,r,id)};
}
/** Error recovery retains original evidence and dirty rows, but releases the one-BUILDING slot.
 * The native worker must resolve commit-unknown against its durable job before choosing this operation.
 */
export async function failCurrentStockRebuild(session:DataSession,s:string,r:string,id:string,maintenance:StockMaintenanceAdmission,
 reason:'REBUILD_FAILED'|'DEPENDENCY_CHANGED'|'OWNER_CANCELLED'):Promise<void> {
 schema(s);schema(r);if(!uuid(id)||!['REBUILD_FAILED','DEPENDENCY_CHANGED','OWNER_CANCELLED'].includes(reason))conflict();
 await assertStockMaintenanceLocks(session,maintenance,1500);
 const g=(await session.query<StockBinding>(`SELECT ${bindingColumns} FROM ${r}.inventory_stock_generation g WHERE id=$1::uuid FOR UPDATE`,[id])).rows[0]??unavailable();
 if(g.active||g.enabled||g.maintenance_sha256!==currentStockMaintenanceSha256()||g.reconciliation?.['writeSeamsSha256']!==maintenance.closedWriteSeamsSha256)conflict();
 if(g.state==='BUILDING')await session.query(`UPDATE ${r}.inventory_stock_generation SET state='STALE',enabled=false,
 reconciliation=reconciliation||jsonb_build_object('invalidatedBy',$2::text) WHERE id=$1::uuid`,[id,reason]);
 else if(g.state!=='STALE')conflict();
 await assertStockMaintenanceLocks(session,maintenance,1500);
}
/** A dirty revision is deleted only with the exact revision read before absolute recomputation.
 * A concurrent writer either leaves the row dirty or raises RR serialization failure; both updates roll back together.
 */
export async function catchUpCurrentStockRebuild(session:DataSession,s:string,r:string,id:string,size=200):Promise<StockRebuildProgress> {
 await assertStockRebuildSnapshot(session);
 return catchUpBuildingStock(session,s,r,id,size);
}
async function assertStockRebuildSnapshot(session:DataSession):Promise<void> {
 if(!(session instanceof ActionSession))conflict();
 const ok=(await session.query<{ok:boolean}>(`SELECT current_setting('transaction_read_only')='off'
 AND current_setting('transaction_isolation')='repeatable read' ok`)).rows[0]?.ok;
 if(ok!==true)conflict();
}
async function catchUpBuildingStock(session:DataSession,s:string,r:string,id:string,size=200):Promise<StockRebuildProgress> {
 if(!Number.isSafeInteger(size)||size<1||size>200)conflict();
 const g=await buildingStock(session,s,r,id);if(!g)return {generationId:id,state:'STALE',phase:'STALE',processed:0,remainingDirty:0};
 if(g.reconciliation?.['phase']!=='CATCHUP')conflict();
 const keys=(await session.query<InventoryStockKey&{revision:string}>(`SELECT warehouse_id "warehouseId",sku_id "skuId",dirty_revision::text revision
 FROM ${r}.inventory_stock_rebuild_dirty WHERE generation_id=$1::uuid ORDER BY warehouse_id,sku_id LIMIT $2`,[id,size])).rows;
 if(keys.length){
  await refreshBuildingStockKeys(session,s,r,g,keys);
  await session.query(`DELETE FROM ${r}.inventory_stock_rebuild_dirty d USING jsonb_to_recordset($2::jsonb)
 k("warehouseId" uuid,"skuId" uuid,revision bigint) WHERE d.generation_id=$1::uuid AND d.warehouse_id=k."warehouseId"
 AND d.sku_id=k."skuId" AND d.dirty_revision=k.revision`,[id,JSON.stringify(keys)]);
 }
 return {generationId:id,state:'BUILDING',phase:'CATCHUP',processed:keys.length,remainingDirty:await stockDirtyCount(session,r,id)};
}
/** Last short lock verifies all current original keys and every derived cell before switching atomically. */
export async function finalizeCurrentStockRebuild(session:DataSession,s:string,r:string,id:string,maintenance:StockMaintenanceAdmission):Promise<StockRebuildProgress> {
 await assertStockMaintenanceLocks(session,maintenance,1500);
 const g=await buildingStock(session,s,r,id);if(!g)return {generationId:id,state:'STALE',phase:'STALE',processed:0,remainingDirty:0};
 if(g.reconciliation?.['phase']!=='CATCHUP'||g.reconciliation?.['writeSeamsSha256']!==maintenance.closedWriteSeamsSha256)conflict();
 const caught=await catchUpBuildingStock(session,s,r,id);if(caught.remainingDirty!==0)conflict();
 const check=(await session.query<{ok:boolean;data:Record<string,unknown>;mismatches:Record<string,unknown>}>(currentStockVerificationSql(s,r,g.binding,await currentStockRuntimeZeroReady(session,s,r,id)),[id,g.binding.runId])).rows[0];
 if(check?.ok!==true)unavailable();
 const receipt={...check.data,buildMode:'DIRTY_KEY_REBUILD_V1',phase:'READY',finalTransaction:check.data['checkedTransaction'],
 writeSeamsSha256:maintenance.closedWriteSeamsSha256,catalogVersion:g.catalog_version};
 await session.query(`UPDATE ${r}.inventory_stock_generation SET state='READY',reconciliation=reconciliation||$2::jsonb WHERE id=$1::uuid`,[id,JSON.stringify(receipt)]);
 await assertStockMaintenanceLocks(session,maintenance,1500);await publishStockGeneration(session,s,r,id,true,maintenance);await assertStockMaintenanceLocks(session,maintenance,1500);
 return {generationId:id,state:'READY',phase:'READY',processed:caught.processed,remainingDirty:0};
}

/** One quantity/identity/cell verifier for fresh build, final cutover and the native owner's isolated counterexamples.
 * A numeric grand total is never a substitute for original warehouse/SKU equality.
 */
export function currentStockVerificationSql(s:string,r:string,b:StockBasis,runtimeZeroReady:boolean):string {
 schema(s);schema(r);if(typeof runtimeZeroReady!=='boolean'||runtimeZeroReady&&(b.kind!=='FORMAL'||!b.activated))conflict();
 return `WITH raw AS MATERIALIZED (${originalStockRowsSql(s,r,b)}),
 actual AS MATERIALIZED (SELECT * FROM ${r}.inventory_stock_member WHERE generation_id=$1::uuid),
 difference AS (SELECT coalesce(x.warehouse_id,y.warehouse_id) warehouse_id,coalesce(x.sku_id,y.sku_id) sku_id
 FROM raw x FULL JOIN actual y USING(warehouse_id,sku_id)
 WHERE x.sku_id IS NULL OR y.sku_id IS NULL OR x.quantity IS DISTINCT FROM y.quantity
 OR coalesce(x.basis->>'reconciliationDifference','0')::numeric<>0),
 relation_difference AS (
 SELECT coalesce(v.sku_id,z.sku_id) sku_id FROM (SELECT original.*,original.sku_id id FROM ${r}.standard_sku_relation original) v FULL JOIN
 (SELECT * FROM ${r}.inventory_stock_relation WHERE generation_id=$1::uuid) z USING(sku_id)
 WHERE v.sku_id IS NULL OR z.sku_id IS NULL OR ROW(v.product_id,v.origin,v.options,v.standard_group,v.standard_fit,v.standard_code,v.standard_size,v.mapping_status,v.mapping_revision,v.mapping_sha256)
 IS DISTINCT FROM ROW(z.product_id,z.origin,z.options,z.standard_group,z.standard_fit,z.standard_code,z.standard_size,z.mapping_status,z.mapping_revision,z.mapping_sha256)
 OR z.zero_eligible IS DISTINCT FROM (v.inventory_zero_status='ELIGIBLE')
 OR z.runtime_zero_eligible IS DISTINCT FROM (${runtimeZeroReady?normalRuntimeZeroEligibilitySql(s,r):'false'})),
 ${allocationCtes(r,'actual')},
 member_cells AS (SELECT next_key cell_key,next_bucket filter_bucket_key,next_tuple cell_tuple,
 warehouse_id,product_id,product_key,min(product_code) product_code,next_color color_id,
 standard_group,standard_fit,standard_code,standard_size,unmapped_sku_id,display_search,
 sum(quantity) quantity,count(*) n,count(*) FILTER(WHERE quantity<>0) nz,count(*) FILTER(WHERE quantity<0) neg
 FROM allocated GROUP BY generation_id,next_key,next_bucket,next_tuple,warehouse_id,product_id,product_key,next_color,
 standard_group,standard_fit,standard_code,standard_size,unmapped_sku_id,display_search),
 cells AS (SELECT * FROM ${r}.inventory_stock_standard_cell WHERE generation_id=$1::uuid),
 cell_difference AS (SELECT 1 FROM member_cells m FULL JOIN cells c USING(cell_key,filter_bucket_key)
 WHERE ROW(m.cell_tuple,m.warehouse_id,m.product_id,m.product_key,m.product_code,m.color_id,
 m.standard_group,m.standard_fit,m.standard_code,m.standard_size,m.unmapped_sku_id,m.display_search,m.quantity,m.n,m.nz,m.neg)
 IS DISTINCT FROM ROW(c.cell_tuple,c.warehouse_id,c.product_id,c.product_key,c.product_code,c.color_id,
 c.standard_group,c.standard_fit,c.standard_code,c.standard_size,c.unmapped_sku_id,c.display_search,c.quantity,c.member_count,c.nonzero_count,c.negative_count)),
 member_identity_difference AS (
 SELECT m.sku_id FROM actual m LEFT JOIN ${r}.inventory_stock_relation v ON v.generation_id=m.generation_id AND v.sku_id=m.sku_id
 LEFT JOIN allocated a ON a.generation_id=m.generation_id AND a.warehouse_id=m.warehouse_id AND a.sku_id=m.sku_id
 WHERE v.sku_id IS NULL OR m.product_id IS DISTINCT FROM v.product_id
 OR m.product_key IS DISTINCT FROM coalesce(v.product_id::text,'sku:'||m.sku_id::text)
 OR m.color_id IS DISTINCT FROM (v.options #>> '{COLOR,id}')
 OR m.cell_key IS DISTINCT FROM a.next_key OR m.filter_bucket_key IS DISTINCT FROM a.next_bucket
 OR m.cell_tuple IS DISTINCT FROM jsonb_build_array(m.warehouse_id,m.product_id,v.options #>> '{COLOR,id}',v.standard_group,v.standard_fit,v.standard_code,v.standard_size,
 CASE WHEN v.standard_group IS NULL OR v.standard_fit IS NULL OR v.standard_code IS NULL OR v.standard_size IS NULL
 OR v.options #>> '{COLOR,id}' IS NULL OR m.product_id IS NULL THEN m.sku_id END))
, checks AS (SELECT NOT EXISTS(SELECT 1 FROM difference) AND NOT EXISTS(SELECT 1 FROM raw GROUP BY warehouse_id,sku_id HAVING count(*)<>1)
 AND NOT EXISTS(SELECT 1 FROM relation_difference) AND NOT EXISTS(SELECT 1 FROM member_identity_difference)
 AND NOT EXISTS(SELECT 1 FROM cell_difference)
 AND NOT EXISTS(SELECT 1 FROM cells GROUP BY cell_key HAVING count(DISTINCT cell_tuple)<>1) ok)
 SELECT checks.ok,
 jsonb_build_object('contractVersion','INVENTORY_UNIT_FREE_V1','maintenanceContract','${maintainedStockContract}',
 'checkedTransaction',txid_current()::text,'quantityKeysVerified',checks.ok,'allCommittedEffectsBound',checks.ok,
 'memberCount',(SELECT count(*) FROM actual),'nonzeroCount',(SELECT count(*) FROM actual WHERE quantity<>0),'negativeCount',(SELECT count(*) FROM actual WHERE quantity<0),
 'quantityFingerprint',(SELECT md5(coalesce(string_agg(jsonb_build_array(warehouse_id,sku_id,quantity)::text,'|' ORDER BY warehouse_id,sku_id),'')) FROM actual)) data,
 jsonb_build_object('originalKeyMismatches',(SELECT count(*) FROM difference),'relationMismatches',(SELECT count(*) FROM relation_difference),
 'memberIdentityMismatches',(SELECT count(*) FROM member_identity_difference),'derivedCellMismatches',(SELECT count(*) FROM cell_difference)) mismatches FROM checks`;
}
