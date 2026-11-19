import {queryMaintainedInventory} from './current-stock-sql.js';
import {readStandardSkuState,standardRead} from '../products/standard-sku-read.js';
import {readLedgerPage} from './trace.js';
import type {AuthorizedContext} from '../../security/service.js';
import type {InventoryFilters,LedgerFilters} from './query.js';
import {SecurityError} from '../../security/errors.js';
import {HistoryError} from './history-plan.js';
import {activeCurrentExportRun,type CurrentExportRun} from './current-export-store.js';
import {inventorySkuDisplaySql} from './sku-display-sql.js';
import {parseScaled} from '../transactions/decimal.js';
import {activeFormalBaselineRun,formalSourceIncrementComponentReady} from './formal-current-baseline.js';
import {assertSingleCurrentBasis as assertSingleBasis,formalCurrentRun as formal,currentDisplaySql as projectionSql,currentInventoryScope} from './current-read-sql.js';

export interface CurrentExportReadRow {
  source_key:string;warehouse_id:string;sku_id:string;quantity:string;confirmed_opening:string;source_net:string;
  endpoint_count:number;proof:Record<string,unknown>;
}
/** Shared application-level readback uses the same quantity projection and admitted source keys as the inventory page. */
export async function readCurrentExportApplicationRows(context:AuthorizedContext,after:string|null,limit=1000):Promise<CurrentExportReadRow[]> {
  if (!Number.isSafeInteger(limit)||limit<1||limit>2000) throw new HistoryError('CURRENT_EXPORT_READ_LIMIT_REQUIRED');
  const {session,repo}=context,run=await activeFormalBaselineRun(session,repo.runtime)??await activeCurrentExportRun(session,repo.runtime);
  if (!run) throw new HistoryError('CURRENT_EXPORT_BASELINE_REQUIRED');await assertSingleBasis(session,repo.runtime);
  return (await session.query<CurrentExportReadRow>(`SELECT source_key,warehouse_id,sku_id,quantity::text,confirmed_opening::text,source_net::text,endpoint_count,proof
    FROM ${projectionSql(repo.source,repo.runtime,run)} projection WHERE run_id=$1 AND ($2::text IS NULL OR source_key>$2)
    ORDER BY source_key LIMIT $3`,[run.id,after,limit])).rows;
}
export async function queryCurrentExportInventory(context:AuthorizedContext,f:InventoryFilters,run:CurrentExportRun):Promise<Record<string,unknown>> {
  const {session,repo}=context;await assertSingleBasis(session,repo.runtime);
  const maintained=await queryMaintainedInventory(context,f,{kind:formal(run)?'FORMAL':'NON_FINAL',runId:run.id});if(maintained!==null)return maintained;
  const scoped=f.warehouseId!==null||f.skuId!==null||f.productId!==null||!!f.q||f.unit!==null||f.nonzero;
  const projection=projectionSql(repo.source,repo.runtime,run,scoped?currentInventoryScope(repo.source,repo.runtime,run):'true'),dataClass=formal(run)?'USER_APPROVED_FORMAL_BASELINE':'NON_FINAL',
    kind=formal(run)?'APPROVED_FORMAL_CURRENT_BASELINE':'CURRENT_EXPORT_CALIBRATION';
  if (f.view==='standard') return queryCurrentExportStandardInventory(context,f,run);
  const row=(await session.query<{data:Record<string,unknown>}>(`WITH matches AS (
    SELECT * FROM ${projection} projection WHERE run_id=$1
      AND ($2::uuid IS NULL OR warehouse_id=$2::uuid) AND ($3::uuid IS NULL OR sku_id=$3::uuid)
      AND ($4::text IS NULL OR proof #>> '{binding,display,productId}'=$4)
      AND ($5='' OR position(lower($5) in lower(proof #>> '{binding,display}'))>0)
      AND $6::text IS NULL AND (NOT $7::boolean OR quantity<>0)
    ), slice AS (SELECT * FROM matches ORDER BY warehouse_id,sku_id LIMIT $8 OFFSET $9)
    SELECT jsonb_build_object('view',$10::text,'items',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'warehouseId',warehouse_id,'skuId',sku_id,'quantity',quantity::text,
      'warehouseCode',proof #>> '{binding,sourceQuantityKey,0}','warehouseName',proof #>> '{binding,display,warehouseName}',
      'productId',proof #>> '{binding,display,productId}','productCode',proof #>> '{binding,display,productCode}',
      'productName',proof #>> '{binding,display,productName}','original',proof #> '{binding,display,original}',
      'sourceQuantityKey',proof #> '{binding,sourceQuantityKey}','identityKind',proof #>> '{binding,identityKind}',
      'sourceMissing',coalesce(proof->>'kind'='POST_ACTIVATION_NEW_QUANTITY_KEY',false),'unitConflict',false,'basis',jsonb_build_object('kind','${kind}','runId',run_id,
        'openingQuantity',confirmed_opening::text,'selectedSourceNet',source_net::text,'currentDelta',current_delta::text,'difference','0.0000','reconciled',true),
      'quantityMethod','DERIVED_FROM_TARGET_INVENTORY','historicalTimelineCompletenessClaimed',false,'dataClass','${dataClass}')
      ORDER BY warehouse_id,sku_id) FROM slice),'[]'::jsonb),'total',(SELECT count(*)::integer FROM matches),
      'originalCellCount',(SELECT count(*)::integer FROM matches),'page',$9::integer/$8::integer+1,'size',$8::integer,
      'quantityTotal',coalesce((SELECT sum(quantity)::text FROM matches),'0.0000'),
      'reconciled',true,'sourceQuantityPolicy','USER_CONFIRMED_CURRENT_EXPORT_TARGET_CALIBRATION',
      'quantityMethod','DERIVED_FROM_TARGET_INVENTORY','dataClass','${dataClass}','historicalTimelineCompletenessClaimed',false) data`,
    [run.id,f.warehouseId,f.skuId,f.productId,f.q,f.unit,f.nonzero,f.size,(f.page-1)*f.size,f.view])).rows[0]?.data;
  if (!row) throw new SecurityError('INVENTORY_READ_FAILED',503,'当前导出校准库存无法回读');return row;
}

/** Standard groups are display projections over the admitted original quantity cells, never replacement stock keys. */
async function queryCurrentExportStandardInventory(context:AuthorizedContext,f:InventoryFilters,run:CurrentExportRun):Promise<Record<string,unknown>> {
  const {session,repo}=context;
  const state=await standardRead(()=>readStandardSkuState(session,repo.runtime,repo.source));
  const scoped=f.warehouseId!==null||f.skuId!==null||f.productId!==null||!!f.q||f.unit!==null||f.nonzero;
  const projection=projectionSql(repo.source,repo.runtime,run,scoped?currentInventoryScope(repo.source,repo.runtime,run):'true'),dataClass=formal(run)?'USER_APPROVED_FORMAL_BASELINE':'NON_FINAL',
    kind=formal(run)?'APPROVED_FORMAL_CURRENT_BASELINE':'CURRENT_EXPORT_CALIBRATION';
  const row=(await session.query<{data:Record<string,unknown>}>(`WITH matches AS MATERIALIZED (
    SELECT * FROM ${projection} projection WHERE run_id=$1
      AND ($2::uuid IS NULL OR warehouse_id=$2::uuid) AND ($3::uuid IS NULL OR sku_id=$3::uuid)
      AND ($4::text IS NULL OR proof #>> '{binding,display,productId}'=$4)
      AND ($5='' OR position(lower($5) in lower(proof #>> '{binding,display}'))>0)
      AND $6::text IS NULL AND (NOT $7::boolean OR quantity<>0)
    ), ${inventorySkuDisplaySql(repo.source,repo.runtime,undefined,true)}, projected AS (
      SELECT c.*,c.proof #>> '{binding,display,productId}' product_id,v.options #>> '{COLOR,id}' color_id,
        v.standard_group,v.standard_fit,v.standard_size,v.standard_code,v.mapping_status,v.mapping_revision,v.mapping_pack_sha256
      FROM matches c LEFT JOIN skus v ON v.id=c.sku_id AND v.product_id::text=c.proof #>> '{binding,display,productId}'
    ), cells AS (
      SELECT *,CASE WHEN standard_group IS NULL OR standard_fit IS NULL OR standard_size IS NULL OR standard_code IS NULL
        OR color_id IS NULL OR product_id IS NULL THEN sku_id END unmapped_sku
      FROM projected
    ), display AS (
      SELECT warehouse_id,product_id,color_id,standard_group,standard_fit,standard_size,standard_code,unmapped_sku,
        sum(quantity) quantity,jsonb_build_array(warehouse_id,product_id,color_id,standard_group,standard_fit,standard_size,standard_code,unmapped_sku) group_key
      FROM cells GROUP BY warehouse_id,product_id,color_id,standard_group,standard_fit,standard_size,standard_code,unmapped_sku
    ), group_page AS MATERIALIZED (
      SELECT * FROM display ORDER BY warehouse_id,product_id,color_id,standard_group,standard_fit,standard_size,standard_code,unmapped_sku LIMIT $8 OFFSET $9
    ), page_cells AS (
      SELECT c.*,g.group_key FROM cells c JOIN group_page g ON jsonb_build_array(c.warehouse_id,c.product_id,c.color_id,c.standard_group,c.standard_fit,c.standard_size,c.standard_code,c.unmapped_sku)=g.group_key
    ), members AS (
      SELECT group_key,jsonb_agg(jsonb_build_object(
          'warehouseId',warehouse_id,'skuId',sku_id,'quantity',quantity::text,
          'warehouseCode',proof #>> '{binding,sourceQuantityKey,0}','warehouseName',proof #>> '{binding,display,warehouseName}',
          'productId',proof #>> '{binding,display,productId}','productCode',proof #>> '{binding,display,productCode}',
          'productName',proof #>> '{binding,display,productName}','original',proof #> '{binding,display,original}',
          'standard',jsonb_build_object('mappingStatus',coalesce(mapping_status,'UNMAPPED'),'group',standard_group,'fit',standard_fit,
            'size',standard_size,'code',standard_code,'mappingRevision',mapping_revision,'packSha256',mapping_pack_sha256),
          'sourceQuantityKey',proof #> '{binding,sourceQuantityKey}','identityKind',proof #>> '{binding,identityKind}',
          'sourceMissing',coalesce(proof->>'kind'='POST_ACTIVATION_NEW_QUANTITY_KEY',false),'unitConflict',false,'basis',jsonb_build_object('kind','${kind}','runId',run_id,
            'openingQuantity',confirmed_opening::text,'selectedSourceNet',source_net::text,'currentDelta',current_delta::text,'difference','0.0000','reconciled',true),
          'quantityMethod','DERIVED_FROM_TARGET_INVENTORY','historicalTimelineCompletenessClaimed',false,'dataClass','${dataClass}')
          ORDER BY sku_id) members FROM page_cells GROUP BY group_key
    ), slice AS (
      SELECT jsonb_build_object('warehouseId',warehouse_id,'productId',product_id,'colorId',color_id,
        'standard',jsonb_build_object('group',standard_group,'fit',standard_fit,'size',standard_size,'code',standard_code),
        'unmappedSkuId',unmapped_sku,'quantity',g.quantity::text,'members',m.members,
        'quantityMethod','DERIVED_FROM_TARGET_INVENTORY','historicalTimelineCompletenessClaimed',false,'dataClass','${dataClass}') item,
        warehouse_id,product_id,color_id,standard_group,standard_fit,standard_size,standard_code,unmapped_sku
      FROM group_page g JOIN members m ON m.group_key=g.group_key
    ) SELECT jsonb_build_object('view',$10::text,'items',coalesce((SELECT jsonb_agg(item
      ORDER BY warehouse_id,product_id,color_id,standard_group,standard_fit,standard_size,standard_code,unmapped_sku) FROM slice),'[]'::jsonb),
      'total',(SELECT count(*)::integer FROM display),'originalCellCount',(SELECT count(*)::integer FROM matches),
      'page',$9::integer/$8::integer+1,'size',$8::integer,
      'quantityTotal',coalesce((SELECT sum(quantity)::text FROM matches),'0.0000'),
      'reconciled',true,'sourceQuantityPolicy','USER_CONFIRMED_CURRENT_EXPORT_TARGET_CALIBRATION',
      'quantityMethod','DERIVED_FROM_TARGET_INVENTORY','dataClass','${dataClass}','historicalTimelineCompletenessClaimed',false) data`,
    [run.id,f.warehouseId,f.skuId,f.productId,f.q,f.unit,f.nonzero,f.size,(f.page-1)*f.size,f.view])).rows[0]?.data;
  if (!row) throw new SecurityError('INVENTORY_READ_FAILED',503,'当前导出校准库存无法回读');return {...row,catalogVersion:state.catalogVersion,standardRead:{contractVersion:'STANDARD_SKU_READ_V1',readiness:'READY'}};
}
export async function currentExportInventoryLedger(context:AuthorizedContext,f:LedgerFilters,run:CurrentExportRun):Promise<Record<string,unknown>> {
  if(formal(run))return formalBaselineLedger(context,f,run);
  const balance=await queryCurrentExportInventory(context,{...f,page:1,size:200,nonzero:false,q:'',productId:null},run);
  const data=await readLedgerPage(context,f,{prefix:`WITH events AS (
    SELECT 'calibration:'||source_key id,'CURRENT_EXPORT_CALIBRATION' kind,NULL::timestamptz time,NULL::uuid posting_id,NULL::uuid document_id,
      NULL::integer revision,NULL::numeric stock_delta,quantity,confirmed_opening,source_net,endpoint_count,proof source
    FROM ${context.repo.runtime}.inventory_current_export_projection WHERE run_id=$1 AND warehouse_id=$2::uuid AND sku_id=$3::uuid
  ), dated AS (SELECT * FROM events)`,params:[run.id,f.warehouseId,f.skuId],order:'id',item:`jsonb_build_object(
    'id',id,'kind',kind,'quantity',quantity::text,'confirmedOpening',confirmed_opening::text,'selectedSourceNet',source_net::text,
    'sourceEndpointCount',endpoint_count,'source',source,'time',NULL,'documentId',NULL,'revision',NULL,'historicalTimelineCompletenessClaimed',false)`});
  return {...data,balance,dataClass:'NON_FINAL',quantityMethod:'DERIVED_FROM_TARGET_INVENTORY',historicalTimelineCompletenessClaimed:false,dateFilteredTimelineAvailable:false};
}
/** Frozen Demo server/runtime/ledger.ts:11 uses business dates for source history, :29 posting times for new effects.
 * This formal branch contains only an undated baseline and post-activation effects; source history is not replayed.
 * All effective legs are included before filtering; the baseline is a balance anchor, not a dated event. */
export function formalLedgerStatement(runtime:string,f:LedgerFilters,runId:string,increment:boolean):import('./ledger-projection.js').LedgerStatement {
  if(!/^"[a-z][a-z0-9_]{0,62}"$/.test(runtime))throw new SecurityError('INVENTORY_READ_FAILED',503,'库存流水 schema 无效');
  const r=runtime;
  return {prefix:`WITH anchor AS MATERIALIZED (
    SELECT quantity,confirmed_opening+source_net baseline_quantity FROM ${r}.inventory_formal_baseline_projection
    WHERE run_id=$1 AND warehouse_id=$2::uuid AND sku_id=$3::uuid
  ), events AS (
    SELECT 'baseline:'||c.run_id id,'APPROVED_FORMAL_BASELINE' kind,0 phase,'baseline:'||c.run_id event_key,0 line_index,
      NULL::timestamptz time,NULL::text business_day,NULL::uuid posting_id,NULL::uuid document_id,NULL::integer revision,
      NULL::text actor_id,NULL::numeric stock_delta,c.confirmed_opening+c.source_net quantity,
      c.proof||jsonb_build_object('runId',c.run_id) source
    FROM ${r}.inventory_formal_baseline_cell c WHERE c.run_id=$1 AND c.warehouse_id=$2::uuid AND c.sku_id=$3::uuid
    UNION ALL SELECT 'posting:'||m.posting_id||':'||m.leg_index,'REAL_POST_ACTIVATION_MOVEMENT',1,'posting:'||m.posting_id,m.leg_index,
      p.created_at,coalesce(nullif(v.body #>> '{header,business_date}',''),nullif(v.body #>> '{header,businessDate}','')),
      m.posting_id,p.document_id,p.revision,p.actor_id,m.quantity,m.quantity,m.proof
    FROM ${r}.inventory_formal_baseline_movement m LEFT JOIN ${r}.posting p ON p.id=m.posting_id
      LEFT JOIN ${r}.revision v ON v.document_id=p.document_id AND v.revision=p.revision
    WHERE m.run_id=$1 AND m.warehouse_id=$2::uuid AND m.sku_id=$3::uuid
    ${increment?`UNION ALL SELECT 'source-increment:'||h.id||':'||l.ordinal,'FORMAL_SOURCE_INCREMENT',1,'source-increment:'||h.id,l.ordinal,
      h.created_at,NULL::text,NULL::uuid,NULL::uuid,NULL::integer,h.actor_id,l.quantity,l.quantity,
      jsonb_build_object('runId',h.run_id,'receiptId',h.id,'sourceIdentityKey',h.source_identity_key,
        'sourceDocumentId',h.document_id,'approvalSha256',h.approval_sha256,'originalLeg',l.proof)
    FROM ${r}.inventory_formal_source_increment_leg l JOIN ${r}.inventory_formal_source_increment h ON h.id=l.receipt_id
    WHERE h.run_id=$1 AND l.warehouse_id=$2::uuid AND l.sku_id=$3::uuid`:''}
  ), time_groups AS (
    SELECT time,count(DISTINCT event_key) event_count FROM events WHERE phase=1 AND time IS NOT NULL GROUP BY time
  ), calculated AS (
    SELECT e.*,(SELECT baseline_quantity FROM anchor)+sum(coalesce(stock_delta,0)) OVER(
      ORDER BY phase,time NULLS LAST,event_key,line_index ROWS UNBOUNDED PRECEDING) period_after,
      count(*) FILTER(WHERE phase=1 AND time IS NULL) OVER() missing_times
    FROM events e
  ), explained AS (
    SELECT c.*,CASE WHEN phase=0 THEN 'BASELINE_NOT_EVENT' WHEN missing_times>0 THEN 'MISSING_POSTING_TIME'
      WHEN g.event_count>1 THEN 'SAME_TIMESTAMP_ORDER_UNPROVEN' ELSE NULL END balance_reason
    FROM calculated c LEFT JOIN time_groups g ON g.time=c.time
  ), dated AS (
    SELECT * FROM explained WHERE phase=0 OR time IS NULL OR
      (($4::date IS NULL OR (time AT TIME ZONE 'Asia/Shanghai')::date>=$4::date)
      AND ($5::date IS NULL OR (time AT TIME ZONE 'Asia/Shanghai')::date<=$5::date))
  )`,params:[runId,f.warehouseId,f.skuId,f.start,f.end],order:'phase DESC,time DESC NULLS LAST,event_key DESC,line_index DESC',item:`jsonb_build_object(
    'id',id,'kind',kind,'time',time,'timeDisplay',to_char(time AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD HH24:MI:SS'),
    'timeBasis',CASE WHEN phase=0 THEN 'NOT_AN_EVENT' WHEN kind='FORMAL_SOURCE_INCREMENT' THEN 'IMPORT_RECORDED_AT' ELSE 'POSTING_RECORDED_AT' END,
    'actorName',(SELECT o.name FROM ${r}.operator o WHERE o.id=actor_id),'businessDay',business_day,'postingId',posting_id,'documentId',document_id,'revision',revision,'actorId',actor_id,
    'quantity',quantity::text,'stockDelta',stock_delta::text,'source',source,'balanceReason',balance_reason,
    'before',CASE WHEN balance_reason IS NULL THEN (period_after-stock_delta)::text ELSE NULL END,
    'after',CASE WHEN phase=0 THEN quantity::text WHEN balance_reason IS NULL THEN period_after::text ELSE NULL END)`,
    extra:`, 'reconstructedQuantity',(SELECT baseline_quantity+(SELECT coalesce(sum(stock_delta),0) FROM events) FROM anchor)::text,
      'currentQuantity',(SELECT quantity::text FROM anchor),'effectiveLegCount',(SELECT count(*)::integer FROM events WHERE phase=1),
      'expectedLegCount',(SELECT count(*)::integer FROM ${r}.inventory_formal_baseline_movement
        WHERE run_id=$1 AND warehouse_id=$2::uuid AND sku_id=$3::uuid)${increment?`+(SELECT count(*)::integer
        FROM ${r}.inventory_formal_source_increment_leg l JOIN ${r}.inventory_formal_source_increment h ON h.id=l.receipt_id
        WHERE h.run_id=$1 AND l.warehouse_id=$2::uuid AND l.sku_id=$3::uuid)`:''}`};
}

/** Fail closed even if a missing leg happens to be zero; compare the exact original key, never only a product total. */
export function assertFormalLedgerBalance(data:Record<string,unknown>,balance:Record<string,unknown>,f:LedgerFilters):void {
  const cells=balance['items'];
  const invalid=()=>new SecurityError('INVENTORY_LEDGER_INCOMPLETE',503,'该原规格与仓库的库存流水不完整，请重试');
  if(!Array.isArray(cells)||cells.length!==1)throw invalid();
  const cell=cells[0] as Record<string,unknown>;
  if(cell['warehouseId']!==f.warehouseId||cell['skuId']!==f.skuId||!Number.isSafeInteger(data['effectiveLegCount'])
    ||data['effectiveLegCount']!==data['expectedLegCount'])throw invalid();
  try {
    const quantity=parseScaled(cell['quantity'],4);
    if(parseScaled(data['reconstructedQuantity'],4)!==quantity||parseScaled(data['currentQuantity'],4)!==quantity)throw invalid();
    if(!Array.isArray(data['items']))throw invalid();
    for(const row of data['items'] as Record<string,unknown>[]){
      if(row['kind']==='APPROVED_FORMAL_BASELINE'){
        if(row['time']!==null||row['stockDelta']!==null||row['before']!==null||parseScaled(row['after'],4)!==parseScaled(row['quantity'],4))throw invalid();
      }else if(row['balanceReason']===null){
        if(parseScaled(row['before'],4)+parseScaled(row['stockDelta'],4)!==parseScaled(row['after'],4))throw invalid();
      }else if(!['MISSING_POSTING_TIME','SAME_TIMESTAMP_ORDER_UNPROVEN'].includes(String(row['balanceReason']))||row['before']!==null||row['after']!==null)throw invalid();
    }
  }catch{throw invalid();}
}
async function formalBaselineLedger(context:AuthorizedContext,f:LedgerFilters,run:CurrentExportRun):Promise<Record<string,unknown>> {
  const {repo,session}=context;
  const balance=await queryCurrentExportInventory(context,{...f,page:1,size:200,nonzero:false,q:'',productId:null},run);
  const increment=await formalSourceIncrementComponentReady(session,repo.runtime);
  const data=await readLedgerPage(context,f,formalLedgerStatement(repo.runtime,f,run.id,increment));
  assertFormalLedgerBalance(data,balance,f);
  return {...data,balance,dataClass:'USER_APPROVED_FORMAL_BASELINE',quantityMethod:'DERIVED_FROM_TARGET_INVENTORY',historicalTimelineCompletenessClaimed:false,
    dateFilteredTimelineAvailable:true,timelineScope:'POST_ACTIVATION_ONLY',dateFilterBasis:'RECORDED_AT_ASIA_SHANGHAI',
    postActivationDateFilterApplied:!!(f.start||f.end),stockAnchor:run.id,historicalLedgerAddedAgain:false};
}
