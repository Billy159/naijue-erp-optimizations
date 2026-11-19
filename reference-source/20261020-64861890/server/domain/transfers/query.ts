import type {VerifiedNativeIncrementProjection} from '../imports/current-source-body.js';
import {readConfirmedDocument,readConfirmedHistorySummary,confirmedHistoricalBody} from '../documents/document-read.js';
import type {AuthorizedContext} from '../../security/service.js';
import {projectNativeIncrementTransferBody,transferNativeIncrementSummarySql,projectTransferListMutationBodies,transferModelProjectionSql,transferModelReadProjectionSql,transferModelInputSql,transferModelWarehouseSql,type TransferReadRecord} from './current-source-read.js';
import {type DataSession,type SqlValue} from '../../database/session.js';
import {documentListQuery,documentListMaintenanceAllowed,documentListBasisSql,documentListFacts,DOCUMENT_LIST_PROJECTOR_SHA,type DocumentListConfig,type DocumentListProduct,type VerifiedDocumentListFacts} from '../documents/list-model.js';
import {readMaintainedDocumentList} from '../documents/list-query.js';
import {authorizeDocument} from '../../security/policies.js';
import {scopeFromBody,withTransferCreationScope,type Role,type DocumentScope} from '../../security/repository.js';
import {identifier,invalid,object,SecurityError} from '../../security/errors.js';
import {parseBusinessDay} from '../transactions/decimal.js';
import {transferFirstNormalPlanParts} from './current-source-read.js';
import type {DatabaseConfig} from '../../database/config.js';

interface TransferRow extends TransferReadRecord,Record<string,unknown> {id:string;body:Record<string,unknown>;version:number;transfer_creator_hall_id:string|null;transfer_creator_account_id:string|null;transfer_creator_role:Role|null;creator:{id:string}|null}
// Current detail does not implicitly require deferred historical preparation.
export async function transferDetail(context:AuthorizedContext,id:string,includeHistory=false):Promise<TransferRow> {
  const confirmed=await readConfirmedDocument(context,id,'TRANSFER');
  return {...confirmed,...(includeHistory?{history:await transferHistory(context,id,{projection:'summary'})}:{})};
}
export interface TransferHistoryOptions {projection?:'summary';revision?:number}
export async function transferHistory(context:AuthorizedContext,id:string,options:TransferHistoryOptions={}):Promise<Record<string,unknown>[]> {
  if(options.revision===undefined||options.projection==='summary'){const confirmed=await readConfirmedHistorySummary(context,id,'TRANSFER');return options.revision===undefined?confirmed:confirmed.filter(row=>row['revision']===options.revision);}
  const {repo,session,actor}=context;
  const current=await repo.document(id),confirmed=await readConfirmedDocument(context,id,'TRANSFER');
  await authorizeDocument(actor,current,'transfers.history',repo);
  const rows=(await session.query<TransferReadRecord & {previous_body:Record<string,unknown>|null;previous_revision:number|null;previous_original_imported:boolean|null} & Record<string,unknown>>(`SELECT h.*,h.document_id AS id,d.document_type,d.source_identity,r.revision AS current_revision,o.name actor_name,r.body,r.original_imported,
    previous.body AS previous_body,previous.revision AS previous_revision,previous.original_imported AS previous_original_imported,
    (SELECT jsonb_agg(jsonb_build_object('id',p.id,'reason',p.reason,'reversedEffectIdentity',p.reversed_effect_identity) ORDER BY p.id)
      FROM ${repo.runtime}.posting p WHERE p.document_id=h.document_id AND p.actor_id=h.actor_id AND p.request_key=h.request_key
      AND (h.operation='approve' AND p.reason='REVISION_APPROVAL' OR h.operation='unapprove' AND p.reason<>'REVISION_APPROVAL')) postings
    FROM ${repo.runtime}.version_history h JOIN ${repo.runtime}.document d ON d.id=h.document_id
    JOIN ${repo.runtime}.revision r ON r.document_id=h.document_id AND r.revision=h.revision
    LEFT JOIN ${repo.runtime}.revision previous ON previous.document_id=h.document_id AND previous.revision=coalesce(
      (SELECT prev.revision FROM ${repo.runtime}.version_history prev WHERE prev.document_id=h.document_id AND prev.version=h.version-1),h.revision-1)
    LEFT JOIN ${repo.runtime}.operator o ON o.id=h.actor_id WHERE h.document_id=$1::uuid${options.revision!==undefined?' AND h.revision=$2::int':''} ORDER BY h.version`,options.revision!==undefined?[id,options.revision]:[id])).rows;
  if(rows.length===0){
    const revision=(await session.query<{revision:number}>(`SELECT revision FROM ${repo.runtime}.revision WHERE document_id=$1::uuid AND revision=$2::int`,[id,options.revision!])).rows[0];
    if(revision){
      // Do not misrepresent a preserved archive as an empty operational trace,
      // nor substitute the current body for a missing historical snapshot.
      const identity=confirmed.source_identity??{};
      if(typeof identity==='object'&&(Object.hasOwn(identity,'currentSourceBinding')||Object.hasOwn(identity,'currentSourceIncrement')))confirmedHistoricalBody(confirmed,revision.revision,{},identity);
      throw new SecurityError('READ_MODEL_NOT_READY',503,'单据历史明细尚未准备，请稍后重试',{readiness:'HISTORICAL_OPERATION_TRACE_REQUIRED'});
    }
  }
  const visible=async(body:Record<string,unknown>):Promise<boolean>=>{
    try {await authorizeDocument(actor,withTransferCreationScope(scopeFromBody('TRANSFER',body),current),'transfers.history',repo);return true;}
    catch(error){if(error instanceof SecurityError&&['SCOPE','FORBIDDEN'].includes(error.code))return false;throw error;}
  };
  const allowed:Record<string,unknown>[]=[];
  for(const row of rows){
    const projected={body:confirmedHistoricalBody(confirmed,row.current_revision,row.body,row.source_identity),
      ...(confirmed['legacy_readonly']===true?{legacy_readonly:true,auditAllowed:false,read_projection:confirmed['read_projection']}:{})};
    if(!await visible(projected.body))continue;
    const previous=row.previous_body?{body:confirmedHistoricalBody(confirmed,row.previous_revision!,row.previous_body,row.source_identity)}:null;
    allowed.push({...row,...projected,previous_body:previous&&await visible(previous.body)?previous.body:null});
  }
  return allowed;
}

interface TransferSummaryScopeRow extends Record<string,unknown> {
  id:string;number:string;document_type:'TRANSFER';status:string;version:number;current_revision:number;
  business_day:string|null;created_at:string|null;updated_at:string|null;original_auditor:string|null;original_audited_at:string|null;
  transfer_creator_hall_id:string|null;transfer_creator_account_id:string|null;transfer_creator_role:Role|null;creator:{id:string;name:string|null}|null;
  from_id:string|null;to_id:string|null;warehouse_ids:unknown[];scope_proven:boolean;identity_proven:boolean;
  legacy_readonly:boolean;source_imported:boolean;
  read_snapshot_reusable?:boolean;
}
interface TransferSummaryRow extends TransferSummaryScopeRow {product_count:number;quantity_totals:Record<string,unknown>[];category_counts:Record<string,unknown>[]}
const importedUnknown="(d.baseline_was_included AND d.version=1 OR d.source_identity ? 'currentSourceBinding')";
const summaryUpdatedSql=`CASE WHEN ${importedUnknown} THEN CASE WHEN pg_input_is_valid(r.body#>>'{header,updated_at}','timestamp with time zone')
  THEN (r.body#>>'{header,updated_at}')::timestamptz END ELSE d.updated_at END`;
function summarySelection(runtime:string,modelBatch=false):string {
 const creator=modelBatch?"CASE WHEN creator.actor_id IS NULL THEN NULL::jsonb ELSE jsonb_build_object('id',creator.actor_id,'name',creator_operator.name) END":`(SELECT jsonb_build_object('id',v.actor_id,'name',o.name) FROM ${runtime}.revision v LEFT JOIN ${runtime}.operator o ON o.id=v.actor_id
    WHERE v.document_id=d.id AND v.revision=1 AND v.actor_id IS NOT NULL)`;
 return `d.id,d.number,d.document_type,d.status,d.version,d.current_revision,r.original_imported AS source_imported,
  d.transfer_creator_hall_id,d.transfer_creator_account_id,d.transfer_creator_role,d.original_auditor,d.original_audited_at,
  coalesce(nullif(r.body#>>'{header,business_date}',''),to_char(d.business_day,'YYYY-MM-DD')) business_day,
  CASE WHEN d.baseline_was_included OR d.source_identity ? 'currentSourceBinding' THEN r.body#>>'{header,created_at}' ELSE d.created_at::text END created_at,
  (${summaryUpdatedSql})::text updated_at,coalesce(d.source_identity ? 'currentSourceBinding',false) legacy_readonly,
  ${creator} creator`;
}
function summaryScope(row:TransferSummaryScopeRow):DocumentScope {
  if(row.scope_proven!==true||row.identity_proven!==true)throw new SecurityError('CURRENT_SOURCE_READ_INVALID',409,'单据摘要来源身份待核实，请读取完整单据');
  const scope=scopeFromBody('TRANSFER',{header:{source_from_warehouse_id:row.from_id,source_to_warehouse_id:row.to_id},lines:[]});
  if(!Array.isArray(row.warehouse_ids))return invalid();
  scope.warehouseIds=[...new Set([...scope.warehouseIds,...row.warehouse_ids.map(id=>identifier(id,true))])];
  return withTransferCreationScope({...scope,id:row.id,status:row.status,version:row.version},{creatorHallId:row.transfer_creator_hall_id,
    creatorId:row.creator?.id??null,creatorAccountId:row.transfer_creator_account_id,creatorRole:row.transfer_creator_role});
}
function summaryItem(row:TransferSummaryRow):Record<string,unknown> {
  return {projection:'summary',id:row.id,number:row.number,document_type:'TRANSFER',status:row.status,current_revision:row.current_revision,version:row.version,
    business_day:row.business_day,created_at:row.created_at,updated_at:row.updated_at,creator:row.creator,
    original_auditor:row.original_auditor,original_audited_at:row.original_audited_at,
    source_from_warehouse_id:row.from_id,source_to_warehouse_id:row.to_id,transfer_creator_hall_id:row.transfer_creator_hall_id,
    transfer_creator_account_id:row.transfer_creator_account_id,transfer_creator_role:row.transfer_creator_role,
    source_imported:row.source_imported,legacy_readonly:row.legacy_readonly,auditAllowed:row.legacy_readonly?false:null,
    sourceKind:row.legacy_readonly?'APPROVED_CURRENT_SOURCE':row.source_imported?'IMPORTED_RUNTIME':'NATIVE_RUNTIME',
    read_projection:row.legacy_readonly?{identityKind:'CURRENT_DISPLAY_ONLY',historicalSkuEvidenceClaimed:false,readonly:true,auditAllowed:false,
      historicalStateTimelineConfirmed:false,historicalStateAtExactCutoffConfirmed:false}:null,
    productCount:row.quantity_totals.some(x=>Number(x['unknown_count'])>0)?null:row.product_count,quantityTotals:row.quantity_totals,categoryCounts:row.category_counts,
    actions:{open:true,editRequiresDetail:true,auditRequiresDetail:true,sourceReadonly:row.legacy_readonly}};
}
/** Fixed batch input precedes every heavy projection relation. Read-only
 * diagnosis and genuine locked maintenance share this complete statement. */
function transferListFactsProjectionSql(runtime:string,source:string,projectionSql:string):string {
 return `WITH transfer_model_documents AS MATERIALIZED (
  SELECT d.*,r.body,r.original_imported,
    coalesce(d.source_identity ? 'currentSourceBinding',false) model_current_source,
    CASE WHEN jsonb_typeof(d.source_identity->'currentSourceBinding')='object'
      THEN (d.source_identity->'currentSourceBinding')-'bindings' ELSE d.source_identity->'currentSourceBinding' END model_source_binding_header,
    CASE WHEN jsonb_typeof(d.source_identity#>'{currentSourceBinding,bindings}')='array'
      THEN d.source_identity#>'{currentSourceBinding,bindings}' ELSE '[]'::jsonb END model_source_bindings,
    CASE WHEN jsonb_typeof(r.body->'lines')='array' THEN r.body->'lines' ELSE '[]'::jsonb END model_source_lines,
    CASE WHEN jsonb_typeof(r.body#>'{header,corroboratingCurrentExportRows,in}')='array'
      THEN r.body#>'{header,corroboratingCurrentExportRows,in}' ELSE '[]'::jsonb END model_source_in_lines,
    CASE WHEN jsonb_typeof(r.body#>'{header,corroboratingCurrentExportRows,out}')='array'
      THEN r.body#>'{header,corroboratingCurrentExportRows,out}' ELSE '[]'::jsonb END model_source_out_lines
  FROM ${runtime}.document d
  JOIN ${runtime}.revision r ON r.document_id=d.id AND r.revision=d.current_revision
  WHERE d.id=ANY($1::uuid[]) AND d.document_type='TRANSFER'
 ), ${transferModelInputSql(runtime,source)}
 SELECT ${summarySelection(runtime,true)},d.baseline_was_included,d.current_effect_active,d.active_effect_identity,d.active_effect_revision,d.source_identity,r.body,r.original_imported,
  ${documentListBasisSql()} model_basis_sha,to_char(d.business_day,'YYYY-MM-DD') model_business_day,d.created_at::text model_created_at,(${summaryUpdatedSql})::text model_updated_at,
  r.body#>>'{header,note}' model_note,r.body#>>'{header,source_party_id}' model_customer_id,r.body#>>'{header,source_employee_id}' model_salesperson_id,r.body#>>'{header,business_type}' model_business_type,
  (d.transfer_creator_role='SALESPERSON' AND d.transfer_creator_hall_id IS NOT NULL AND coalesce(creator.actor_id=d.transfer_creator_account_id,false)) model_creation_proven,
  transfer_summary.*,transfer_read_scope.from_id,transfer_read_scope.to_id
  FROM transfer_model_documents d CROSS JOIN LATERAL (SELECT d.body,d.original_imported,d.current_revision revision) r
  LEFT JOIN ${runtime}.revision creator ON creator.document_id=d.id AND creator.revision=1
  LEFT JOIN ${runtime}.operator creator_operator ON creator_operator.id=creator.actor_id
  LEFT JOIN transfer_model_observation_index transfer_model_source_index ON transfer_model_source_index.document_id=d.id
  CROSS JOIN transfer_model_catalog_index transfer_model_catalog_lookup
  ${transferModelWarehouseSql(runtime,source)} ${projectionSql} ORDER BY d.id`;
}
export function transferDocumentListReadProjectionSql(runtime:string,source:string):string {
 return transferListFactsProjectionSql(runtime,source,transferModelReadProjectionSql(runtime,source));
}
/** Fixed first-batch normal whole text for a class-owned EXPLAIN-only resource.
 * SQL generation is shared with execution, but no locked maintenance scope is
 * fabricated and this function never executes the returned projection. */
export async function firstTransferModelNormalPlanStatement(session:DataSession,database:DatabaseConfig) {
 const parts=await transferFirstNormalPlanParts(session,database);
 return {text:parts.projectionSql===null?null:transferListFactsProjectionSql(parts.runtime,parts.source,parts.projectionSql),
  values:Object.freeze([parts.ids,DOCUMENT_LIST_PROJECTOR_SHA]),selectedCount:parts.ids.length,
  headerWitnessSha256:parts.headerWitnessSha256,session:parts.session};
}
export async function verifyTransferListFacts(session:DataSession,config:DocumentListConfig,ids:readonly string[]):Promise<VerifiedDocumentListFacts[]> {
 const {runtime,source}=config;if(!documentListMaintenanceAllowed(session,runtime,source))throw new SecurityError('FORBIDDEN',403,'单据维护验证范围无效');
 const rows=(await documentListQuery<TransferSummaryRow&TransferRow>(session,'TRANSFER_PROJECTION',transferListFactsProjectionSql(runtime,source,transferModelProjectionSql(session,runtime,source)),[ids,DOCUMENT_LIST_PROJECTOR_SHA])).rows;
 const scopes=rows.map(summaryScope);
 await projectTransferListMutationBodies(session,runtime,source,rows);
 const result:VerifiedDocumentListFacts[]=[];
 for(const [index,row] of rows.entries()){
  const scope=scopes[index]!;
  const products=(row['model_products'] as Record<string,unknown>[]).map((p):DocumentListProduct=>({key:JSON.stringify([p['sku'],p['unit'],p['display_fit'],p['category_id']]),productId:p['product_id']===null?null:identifier(p['product_id'],true),ordinal:Number(p['ordinal']),quantity:p['quantity']===null?null:String(p['quantity']),giftQuantity:'0',unknownCount:Number(p['unknown_count']),categoryKey:p['category_id']===null?null:String(p['category_id']),presentation:{fit:p['display_fit'],unit:p['unit']}}));
  result.push(documentListFacts(row,summaryItem(row),scope.warehouseIds,products));
 }
 return result;
}
/** Native receipts use their actual protected canonical contract; the old
 * observation projector remains unchanged for original Source containers. */
export async function verifyNativeIncrementTransferFacts(session:DataSession,config:DocumentListConfig,id:string,version:number,revision:number,proof:VerifiedNativeIncrementProjection):Promise<VerifiedDocumentListFacts> {
 const {runtime,source}=config;if(!documentListMaintenanceAllowed(session,runtime,source))throw new SecurityError('FORBIDDEN',403,'单据维护验证范围无效');
 const value=await projectNativeIncrementTransferBody(session,runtime,source,id,version,revision,proof),summarySql=transferNativeIncrementSummarySql(session,runtime,source,value);
 const {approvedImportJsonParts,approvedImportJsonSql}=await import('../../database/document-import-access.js');
 const row=(await documentListQuery<TransferSummaryRow&TransferRow>(session,'TRANSFER_PROJECTION',`SELECT ${summarySelection(runtime,true)},
 d.baseline_was_included,d.current_effect_active,d.active_effect_identity,d.active_effect_revision,d.source_identity,r.body,r.original_imported,
 ${documentListBasisSql().replaceAll('r.body','origin.body')} model_basis_sha,to_char(d.business_day,'YYYY-MM-DD') model_business_day,d.created_at::text model_created_at,(${summaryUpdatedSql})::text model_updated_at,
 r.body#>>'{header,note}' model_note,r.body#>>'{header,source_party_id}' model_customer_id,r.body#>>'{header,source_employee_id}' model_salesperson_id,r.body#>>'{header,business_type}' model_business_type,
 (d.transfer_creator_role='SALESPERSON' AND d.transfer_creator_hall_id IS NOT NULL AND coalesce(creator.actor_id=d.transfer_creator_account_id,false)) model_creation_proven,
 transfer_summary.*,transfer_read_scope.from_id,transfer_read_scope.to_id
 FROM ${runtime}.document d JOIN ${runtime}.revision origin ON origin.document_id=d.id AND origin.revision=d.current_revision
 CROSS JOIN LATERAL (SELECT ${approvedImportJsonSql(5)} body,origin.original_imported,origin.revision) r
 LEFT JOIN ${runtime}.revision creator ON creator.document_id=d.id AND creator.revision=1
 LEFT JOIN ${runtime}.operator creator_operator ON creator_operator.id=creator.actor_id
 CROSS JOIN LATERAL (SELECT r.body#>>'{header,source_from_warehouse_id}' from_id,r.body#>>'{header,source_to_warehouse_id}' to_id) transfer_read_scope
 ${summarySql} WHERE d.id=$1::uuid AND d.version=$3 AND d.current_revision=$4 AND d.document_type='TRANSFER'`,[id,DOCUMENT_LIST_PROJECTOR_SHA,version,revision,approvedImportJsonParts(value.projection.body)])).rows[0];
 if(!row||row.id!==id||row.version!==version||row.current_revision!==revision)throw new SecurityError('CURRENT_SOURCE_READ_INVALID',409,'原生增量单据快照已变化');
 Object.assign(row,value.projection);row['source_read_body_sha']=value.originalBodySha256;
 const scope=summaryScope(row),products=(row['model_products'] as Record<string,unknown>[]).map((p):DocumentListProduct=>({key:JSON.stringify([p['sku'],p['unit'],p['display_fit'],p['category_id']]),productId:p['product_id']===null?null:identifier(p['product_id'],true),ordinal:Number(p['ordinal']),quantity:p['quantity']===null?null:String(p['quantity']),giftQuantity:'0',unknownCount:Number(p['unknown_count']),categoryKey:p['category_id']===null?null:String(p['category_id']),presentation:{fit:p['display_fit'],unit:p['unit']}}));
 return documentListFacts(row,summaryItem(row),scope.warehouseIds,products);
}
const pageNumber=(raw:unknown,fallback:number,max:number):number=>{
  if(raw===undefined)return fallback;
  if(!/^[1-9]\d*$/.test(String(raw))||!Number.isSafeInteger(Number(raw))||Number(raw)>max)return invalid();return Number(raw);
};
export async function transferList(context:AuthorizedContext,input:unknown):Promise<Record<string,unknown>> {
  const q=object(input),page=pageNumber(q['page'],1,1000000),size=pageNumber(q['size'],20,200);
  if(Object.keys(q).some(k=>!['type','page','size','filters','projection','number','expectedReadVersion'].includes(k)))return invalid();
  if(q['projection']!==undefined&&q['projection']!=='summary')return invalid();
  const summary=q['projection']==='summary';
  let f:Record<string,unknown>={};
  if(q['filters']!==undefined){if(typeof q['filters']!=='string'||q['filters'].length>8192)return invalid();try{f=object(JSON.parse(q['filters']));}catch{return invalid();}}
  if(Object.keys(f).some(k=>!['start','end','q','from','to','status'].includes(k)))return invalid();
  const values:SqlValue[]=[],where=["d.document_type='TRANSFER'"];
  const add=(expression:string,value:SqlValue):void=>{values.push(value);where.push(expression.replace('?',`$${values.length}`));};
  if(q['number']!==undefined){if(!summary||typeof q['number']!=='string'||!q['number']||q['number'].length>128)return invalid();add('d.number=?',q['number']);}
  for(const k of ['start','end'] as const)if(f[k]){try{parseBusinessDay(f[k]);}catch{return invalid();}add(`d.business_day ${k==='start'?'>=':'<='} ?::date`,String(f[k]));}
  if(f['start']&&f['end']&&String(f['start'])>String(f['end']))return invalid();
  if(f['q']){if(typeof f['q']!=='string'||f['q'].length>128)return invalid();add("position(lower(?) in lower(d.number||' '||coalesce(r.body->'header'->>'note','')))>0",f['q']);}
  for(const k of ['from','to'] as const){if(f[k]!==undefined){if(!Array.isArray(f[k])||(f[k] as unknown[]).length>100)return invalid();const ids=(f[k] as unknown[]).map(v=>identifier(v,true));if(ids.length)add(`transfer_read_scope.${k==='from'?'from':'to'}_id=ANY(?::text[])`,ids);}}
  if(f['status']!==undefined){if(!Array.isArray(f['status'])||(f['status'] as unknown[]).length>4)return invalid();const map:Record<string,string>={'已审核':'APPROVED','未审核':'UNAUDITED','已作废':'DELETED','APPROVED':'APPROVED','UNAUDITED':'UNAUDITED','DRAFT':'DRAFT','DELETED':'DELETED'};
    const states=(f['status'] as unknown[]).map(v=>map[String(v)]??invalid());if(states.length)add('d.status=ANY(?::text[])',states);}
  const {repo,actor}=context;
  if(actor.role==='SALESPERSON'){
    if(!actor.storeId)throw new SecurityError('SCOPE',403,'营业厅归属未知');
    values.push(actor.storeId);const hall=`$${values.length}`;
    where.push(`((d.transfer_creator_hall_id=${hall}::uuid AND d.transfer_creator_role='SALESPERSON'
      AND EXISTS(SELECT 1 FROM ${repo.runtime}.revision first WHERE first.document_id=d.id AND first.revision=1 AND first.actor_id=d.transfer_creator_account_id)) OR ${repo.runtime}.warehouse_linked_hall(transfer_read_scope.from_id,${hall}::text)
      OR ${repo.runtime}.warehouse_linked_hall(transfer_read_scope.to_id,${hall}::text))`);
  }
  if(!summary&&q['expectedReadVersion']!==undefined)return invalid();
  return readMaintainedDocumentList(context,'TRANSFER',{...(q['projection']==='summary'?{projection:'summary' as const}:{}),page,size,where,values,expectedReadVersion:q['expectedReadVersion']});
}
