import {createHash} from 'node:crypto';
import {canonicalJson} from '../idempotency/index.js';
import type {DataSession} from '../../database/session.js';
import type {AuthorizedContext} from '../../security/service.js';
import type {DocumentScope,SecurityRepository,Role} from '../../security/repository.js';
import {identifier,SecurityError} from '../../security/errors.js';
import {scopeFromBody,withTransferCreationScope} from '../../security/repository.js';
import {authorizeDocument} from '../../security/policies.js';
import {readStandardSkuState,readStandardSkuRows} from '../products/standard-sku-read.js';
import type {DocumentListProduct,ListType} from './list-model.js';

export const DOCUMENT_BUSINESS_CONTRACT='DOCUMENT_CONFIRMED_BUSINESS_V1';
export const DOCUMENT_PAYLOAD_CONTRACT='DOCUMENT_PUBLIC_PAYLOAD_V3';
export const DOCUMENT_CHUNK_CONTRACT='DOCUMENT_BUSINESS_CHUNK_V1';
export const DOCUMENT_CHUNK_PREFIX='__business_v1:';
type Json=Record<string,unknown>;
export interface ConfirmedBody extends Json {header:Json;lines:Json[];fundsRecords?:Json[]}
export interface ConfirmedDocumentDetail extends Json {
 id:string;document_type:ListType;version:number;current_revision:number;status:string;body:ConfirmedBody;
 original_imported:boolean;source_identity:unknown;
 creator:{id:string;name?:string|null}|null;transfer_creator_hall_id:string|null;transfer_creator_account_id:string|null;transfer_creator_role:Role|null;
}
export type ConfirmedSourceKind='NATIVE_RUNTIME'|'IMPORTED_RUNTIME'|'APPROVED_CURRENT_SOURCE';
export interface ConfirmedBusiness {
 contractVersion:typeof DOCUMENT_BUSINESS_CONTRACT;detail:ConfirmedDocumentDetail;sourceKind:ConfirmedSourceKind;
 legacyReadonly:boolean;warehouses:string[];scopeHeader:Json;
}
export interface BusinessManifest extends Json {
 contractVersion:typeof DOCUMENT_BUSINESS_CONTRACT;id:string;type:ListType;version:number;revision:number;
 snapshotKey:string;parts:number;bytes:number;scope:Json;
}
const record=(v:unknown):Json=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Json:{};
const clone=<T>(v:T):T=>v===undefined?v:JSON.parse(JSON.stringify(v)) as T;
const invalid=(reason:string):never=>{throw new SecurityError('READ_MODEL_NOT_READY',503,'单据业务资料尚未同步，请稍后重试',{readiness:reason});};
const sameJson=(a:unknown,b:unknown):boolean=>{try{return canonicalJson(a)===canonicalJson(b);}catch{return false;}};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const detailFields=['number','business_day','created_at','updated_at','baseline_was_included','current_effect_active','active_effect_identity','active_effect_revision',
 'original_auditor','original_audited_at','source_imported','legacy_readonly','auditAllowed','read_projection','warehouse_policy',
 'warehouse_origin_revision','warehouse_origin_imported','warehouse_origin_has_imported','warehouse_origin_native_create'] as const;

/** Called after the original complete maintenance verifier, never by an HTTP
 * request. This codec creates no authority and does not alter source facts. */
export function confirmedBusiness(row:Json,summary:Json,warehouses:readonly string[],sourceKind:ConfirmedSourceKind):ConfirmedBusiness {
 const type=row['document_type'];if(type!=='SALE'&&type!=='TRANSFER')return invalid('INVALID_BUSINESS_TYPE');
 const body=record(row['body']),header=record(body['header']);
 if(body['header']===null||typeof body['header']!=='object'||Array.isArray(body['header']))return invalid('INVALID_CONFIRMED_HEADER');
 if(!Array.isArray(body['lines'])||body['lines'].some(l=>l===null||typeof l!=='object'||Array.isArray(l)))return invalid('INVALID_CONFIRMED_LINES');
 if(type==='SALE'&&!Array.isArray(body['fundsRecords']))return invalid('INVALID_CONFIRMED_SETTLEMENT');
 const version=Number(row['version']),revision=Number(row['current_revision']);
 if(!Number.isSafeInteger(version)||version<1||!Number.isSafeInteger(revision)||revision<1)return invalid('INVALID_CONFIRMED_VERSION');
 const detail:ConfirmedDocumentDetail={id:identifier(row['id'],true),document_type:type,version,current_revision:revision,status:String(row['status']),
  body:clone(body) as ConfirmedBody,original_imported:row['original_imported']===true,source_identity:clone(row['source_identity']??null),
  creator:typeof record(row['creator'])['id']==='string'?clone(row['creator']) as {id:string;name?:string|null}:null,
  transfer_creator_hall_id:typeof row['transfer_creator_hall_id']==='string'?row['transfer_creator_hall_id']:null,
  transfer_creator_account_id:typeof row['transfer_creator_account_id']==='string'?row['transfer_creator_account_id']:null,
  transfer_creator_role:['ADMIN','WAREHOUSE','SALESPERSON'].includes(String(row['transfer_creator_role']))?row['transfer_creator_role'] as Role:null};
 for(const key of detailFields)if(Object.hasOwn(row,key))detail[key]=clone(row[key]);
 const legacy=summary['legacy_readonly']===true;
 detail['legacy_readonly']=legacy;if(legacy){detail['auditAllowed']=false;detail['read_projection']=clone(body['readProjection']??row['read_projection']??{readonly:true,auditAllowed:false,identityKind:'CURRENT_DISPLAY_ONLY',historicalSkuEvidenceClaimed:false});}
 const scopeHeader:Json={};for(const key of ['hall_id','source_warehouse_id','source_from_warehouse_id','source_to_warehouse_id','return_warehouse_id','outgoing_warehouse_id'])if(Object.hasOwn(header,key))scopeHeader[key]=clone(header[key]);
 return {contractVersion:DOCUMENT_BUSINESS_CONTRACT,detail,sourceKind,legacyReadonly:legacy,warehouses:[...new Set(warehouses.map(w=>identifier(w,true)))],scopeHeader};
}

/** Immutable native revisions already hold their business body. Source-bound
 * archives do not: only the matching persisted confirmed snapshot is a business
 * read. Older archive snapshots require bounded preparation, never an HTTP
 * re-verification or a raw-body-as-clean fallback. */
export function confirmedHistoricalBody(current:ConfirmedDocumentDetail,revision:number,body:Json,sourceIdentity:unknown):ConfirmedBody {
 const identity=record(sourceIdentity);
 if(Object.hasOwn(identity,'currentSourceBinding')||Object.hasOwn(identity,'currentSourceIncrement')){
  if(revision!==current.current_revision)return invalid('HISTORICAL_CONFIRMED_SNAPSHOT_REQUIRED');
  return clone(current.body);
 }
 if(!Number.isSafeInteger(revision)||revision<1||!body['header']||typeof body['header']!=='object'||Array.isArray(body['header'])||!Array.isArray(body['lines'])||body['lines'].some(line=>!line||typeof line!=='object'||Array.isArray(line))||current.document_type==='SALE'&&!Array.isArray(body['fundsRecords']))return invalid('HISTORICAL_BUSINESS_BODY_INVALID');
 return clone(body) as ConfirmedBody;
}

/** Effective standard rows are already persisted by their sole owner. Preserve
 * historic line values and expose current standards in a separate field. */
export async function withCurrentDocumentStandardsBatch(tx:DataSession,runtime:string,source:string,details:readonly ConfirmedDocumentDetail[]):Promise<ConfirmedDocumentDetail[]> {
 const state=await readStandardSkuState(tx,runtime,source),ids=[...new Set(details.flatMap(detail=>detail.body.lines.flatMap(line=>uuid(line['sku_id'])?[line['sku_id'].toLowerCase()]:[])))];
 const byId=new Map<string,Json>();
 for(let at=0;at<ids.length;at+=5000)for(const row of await readStandardSkuRows(tx,runtime,[],ids.slice(at,at+5000),state)){
  const id=String(row['id']);if(byId.has(id))return invalid('DUPLICATE_STANDARD_IDENTITY');byId.set(id,row);
 }
 return details.map(detail=>{
 const lines=detail.body.lines.map((line,index)=>{
  const raw=line['sku_id']??null,current=typeof raw==='string'?byId.get(raw.toLowerCase()):undefined;
  if(current&&uuid(line['product_id'])&&current['product_id']!==line['product_id'].toLowerCase())return invalid('STANDARD_PRODUCT_IDENTITY_MISMATCH');
  return {ordinal:index+1,rawSkuId:raw,originalIdentity:clone(record(line['readIdentity'])),
   current:current?clone(current):null,unknownReason:current?current['historicalUnmappedReason']??null:raw===null?'HISTORICAL_IDENTITY_UNRESOLVED':'NOT_IN_CURRENT_STANDARD_CATALOG'};
 });
 return {...detail,standardRead:{contractVersion:'STANDARD_SKU_READ_V1',catalogVersion:state.catalogVersion,documentVersion:detail.version,revision:detail.current_revision,readiness:'READY',lines}};
 });
}
export async function withCurrentDocumentStandards(tx:DataSession,runtime:string,source:string,detail:ConfirmedDocumentDetail):Promise<ConfirmedDocumentDetail> {
 return (await withCurrentDocumentStandardsBatch(tx,runtime,source,[detail]))[0]!;
}

function businessScope(business:ConfirmedBusiness):Json {
 const detail=business.detail;
 return {header:business.scopeHeader,warehouseIds:business.warehouses,sourceKind:business.sourceKind,legacyReadonly:business.legacyReadonly,
  creator:detail.creator??null,creatorHallId:detail.transfer_creator_hall_id??null,creatorAccountId:detail.transfer_creator_account_id??null,creatorRole:detail.transfer_creator_role??null,
  originalAuditor:detail['original_auditor']??null,originalAuditedAt:detail['original_audited_at']??null};
}

/** Bounded rows in the existing product JSON column; no table or DDL change.
 * Aggregate consumers must explicitly exclude this reserved member namespace. */
export function encodeBusinessPayload(summary:Json,business:ConfirmedBusiness):{payload:Json;fragments:DocumentListProduct[]} {
 const detail=business.detail,text=JSON.stringify(business),bytes=Buffer.byteLength(text);
 if(bytes>134217728)return invalid('BUSINESS_DOCUMENT_TOO_LARGE');
 const snapshotKey=createHash('sha256').update(text).digest('hex'),pieces:string[]=[];
 for(let start=0;start<text.length;){let end=Math.min(start+100000,text.length);if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1]!)&&/[\uDC00-\uDFFF]/.test(text[end]!))end--;pieces.push(text.slice(start,end));start=end;}
 const scope=businessScope(business);
 const standards=record(detail['standardRead']);
 const unknownRelations=Array.isArray(standards['lines'])?standards['lines'].filter(line=>record(line)['unknownReason']!==null).length:detail.body.lines.length;
 const manifest:BusinessManifest={contractVersion:DOCUMENT_BUSINESS_CONTRACT,id:detail.id,type:detail.document_type,version:detail.version,revision:detail.current_revision,snapshotKey,parts:pieces.length,bytes,scope,unknownRelations,standardCatalogVersion:standards['catalogVersion']??null};
 const fragments=pieces.map((data,index):DocumentListProduct=>({key:DOCUMENT_CHUNK_PREFIX+index,productId:null,ordinal:index+1,quantity:null,giftQuantity:null,unknownCount:0,categoryKey:null,
  presentation:{contractVersion:DOCUMENT_CHUNK_CONTRACT,snapshotKey,part:index,parts:pieces.length,data}}));
 return {payload:{contractVersion:DOCUMENT_PAYLOAD_CONTRACT,summary:clone(summary),business:manifest},fragments};
}
export function decodeBusinessPayload(manifest:BusinessManifest,chunks:readonly Json[]):ConfirmedBusiness {
 if(!manifest||manifest.contractVersion!==DOCUMENT_BUSINESS_CONTRACT||!Number.isSafeInteger(manifest.parts)||manifest.parts<1||manifest.parts>4096||chunks.length!==manifest.parts)return invalid('BUSINESS_CHUNKS_MISSING');
 if(!uuid(manifest.id)||!['SALE','TRANSFER'].includes(manifest.type)||!Number.isSafeInteger(manifest.version)||manifest.version<1||!Number.isSafeInteger(manifest.revision)||manifest.revision<1||!Number.isSafeInteger(manifest.bytes)||manifest.bytes<1||manifest.bytes>134217728||typeof manifest.snapshotKey!=='string'||!/^([a-f0-9]{64})$/.test(manifest.snapshotKey))return invalid('BUSINESS_MANIFEST_INVALID');
 const pieces=chunks.map((chunk,index)=>{
  if(!chunk||typeof chunk!=='object'||Array.isArray(chunk)||chunk['contractVersion']!==DOCUMENT_CHUNK_CONTRACT||chunk['snapshotKey']!==manifest.snapshotKey||chunk['part']!==index||chunk['parts']!==manifest.parts||typeof chunk['data']!=='string')return invalid('BUSINESS_CHUNK_MISMATCH');return chunk['data'];
 });
 const text=pieces.join('');if(Buffer.byteLength(text)!==manifest.bytes)return invalid('BUSINESS_LENGTH_MISMATCH');
 if(createHash('sha256').update(text).digest('hex')!==manifest.snapshotKey)return invalid('BUSINESS_DIGEST_MISMATCH');
 let business:ConfirmedBusiness;try{business=JSON.parse(text) as ConfirmedBusiness;}catch{return invalid('BUSINESS_JSON_INVALID');}
 const detail=business?.detail;if(business?.contractVersion!==DOCUMENT_BUSINESS_CONTRACT||detail?.id!==manifest.id||detail.document_type!==manifest.type||detail.version!==manifest.version||detail.current_revision!==manifest.revision||!Array.isArray(detail.body?.lines)||!detail.body.header||typeof detail.body.header!=='object'||Array.isArray(detail.body.header)||detail.body.lines.some(line=>!line||typeof line!=='object'||Array.isArray(line))||detail.document_type==='SALE'&&(!Array.isArray(detail.body.fundsRecords)||detail.body.fundsRecords.some(line=>!line||typeof line!=='object'||Array.isArray(line))))return invalid('BUSINESS_VERSION_MISMATCH');
 if(!['NATIVE_RUNTIME','IMPORTED_RUNTIME','APPROVED_CURRENT_SOURCE'].includes(business.sourceKind)||typeof business.legacyReadonly!=='boolean'||!Array.isArray(business.warehouses)||business.warehouses.some(id=>!uuid(id))||new Set(business.warehouses).size!==business.warehouses.length||!sameJson(businessScope(business),manifest.scope))return invalid('BUSINESS_SCOPE_MISMATCH');
 return business;
}

interface Carrier {manifest:BusinessManifest;generationId:string;readVersion:string;runtime:string;source:string;sourceBound:boolean}
async function carrier(repo:SecurityRepository,id:string,type:ListType):Promise<Carrier> {
 const documentId=identifier(id,true).toLowerCase();
 const {documentListConfig,readDocumentListStamp}=await import('./list-model.js'),c=documentListConfig(repo),stamp=await readDocumentListStamp(repo.session,c,type);
 const row=(await repo.session.query<{document_version:number;revision:number;source_read_valid:boolean;scope_proven:boolean;identity_proven:boolean;payload_contract:string;business:BusinessManifest|null;version:number;current_revision:number;source_bound:boolean}>(`SELECT s.document_version,s.revision,s.source_read_valid,s.scope_proven,s.identity_proven,
  s.public_payload->>'contractVersion' payload_contract,s.public_payload->'business' business,d.version,d.current_revision,(d.source_identity ?| ARRAY['currentSourceBinding','currentSourceIncrement']) source_bound FROM ${repo.runtime}.document d
  LEFT JOIN ${repo.runtime}.document_list_summary s ON s.generation_id=$1::uuid AND s.document_id=d.id
  WHERE d.id=$2::uuid AND d.document_type=$3`,[stamp.generationId,documentId,type])).rows[0];
 if(!row)throw new SecurityError('NOT_FOUND',404,'单据不存在');
 if(row.document_version!==row.version||row.revision!==row.current_revision||!row.source_read_valid||!row.scope_proven||!row.identity_proven||row.payload_contract!==DOCUMENT_PAYLOAD_CONTRACT||row.business?.contractVersion!==DOCUMENT_BUSINESS_CONTRACT||row.business.id!==documentId||row.business.type!==type||row.business.version!==row.version||row.business.revision!==row.current_revision)return invalid('BUSINESS_PROJECTION_STALE');
 return {manifest:row.business,generationId:stamp.generationId,readVersion:stamp.readVersion,runtime:c.runtime,source:c.source,sourceBound:row.source_bound===true};
}
export async function readConfirmedDocument(context:AuthorizedContext,id:string,type:ListType):Promise<ConfirmedDocumentDetail> {
 const current=await carrier(context.repo,id,type);
 const rows=(await context.session.query<{presentation_basis:Json}>(`SELECT presentation_basis FROM ${current.runtime}.document_list_product
  WHERE generation_id=$1::uuid AND document_id=$2::uuid AND left(product_key,${DOCUMENT_CHUNK_PREFIX.length})=$3 ORDER BY first_ordinal`,[current.generationId,id,DOCUMENT_CHUNK_PREFIX])).rows;
 const business=decodeBusinessPayload(current.manifest,rows.map(r=>r.presentation_basis));
 const detail=await withCurrentDocumentStandards(context.session,current.runtime,current.source,business.detail);
 if(detail.creator){
  const creator=(await context.session.query<{name:string|null}>(`SELECT name FROM ${current.runtime}.operator WHERE id=$1`,[detail.creator.id])).rows[0];
  detail.creator={id:detail.creator.id,name:creator?.name??null};
 }
 return {...detail,readVersion:current.readVersion,readContract:DOCUMENT_BUSINESS_CONTRACT};
}

/** Normal history is metadata first. Explicit revision tracing retains its
 * separate original proof path; this endpoint never rebuilds source bodies. */
export async function readConfirmedHistorySummary(context:AuthorizedContext,id:string,type:ListType):Promise<Json[]> {
 const current=await carrier(context.repo,id,type);
 const scope=context.documents.find(d=>d.id===id)??await context.repo.document(id);
 await authorizeDocument(context.actor,scope,type==='SALE'?'sales.history':'transfers.history',context.repo);
 const scopeBody=(body:string):string=>`jsonb_build_object('header',jsonb_build_object(
  'hall_id',${body}#>'{header,hall_id}','source_warehouse_id',${body}#>'{header,source_warehouse_id}',
  'source_from_warehouse_id',${body}#>'{header,source_from_warehouse_id}','source_to_warehouse_id',${body}#>'{header,source_to_warehouse_id}',
  'return_warehouse_id',${body}#>'{header,return_warehouse_id}','outgoing_warehouse_id',${body}#>'{header,outgoing_warehouse_id}'),
  'lines',coalesce((SELECT jsonb_agg(jsonb_build_object('warehouse_id',l->'warehouse_id','from_warehouse_id',l->'from_warehouse_id','to_warehouse_id',l->'to_warehouse_id'))
  FROM jsonb_array_elements(${body}->'lines') l),'[]'::jsonb))`;
 const historyTime=type==='SALE'?'h.created_at::text':`CASE WHEN ${current.manifest.scope['legacyReadonly']===true?'true':'false'} OR h.operation IN('import','source_import') THEN NULL::text ELSE h.created_at::text END`;
 const importedTime=type==='SALE'?"r.body#>>'{header,created_at}'":'NULL::text';
 // SALE can expose a saved imported revision directly; TRANSFER tracing uses
 // operational rows only. Source-bound traces also need every previous body
 // they actually include to match the sole persisted current snapshot.
 const traceExists=type==='SALE'?'true':`EXISTS(SELECT 1 FROM ${current.runtime}.version_history trace WHERE trace.document_id=r.document_id AND trace.revision=r.revision)`;
 const previousRevision=type==='SALE'?'trace.revision-1':`coalesce((SELECT prev.revision FROM ${current.runtime}.version_history prev WHERE prev.document_id=trace.document_id AND prev.version=trace.version-1),trace.revision-1)`;
 const detailAvailable=`(${traceExists}${current.sourceBound?` AND NOT EXISTS(SELECT 1 FROM ${current.runtime}.version_history trace JOIN ${current.runtime}.revision previous ON previous.document_id=trace.document_id AND previous.revision=${previousRevision} WHERE trace.document_id=r.document_id AND trace.revision=r.revision AND previous.revision<>${current.manifest.revision})`:''})`;
 const rows=(await context.session.query<Json>(`SELECT h.version,h.revision,h.operation,h.actor_id,o.name actor_name,
  ${historyTime} created_at,r.original_imported,${scopeBody('r.body')} scope_body,${detailAvailable} detail_available
  FROM ${current.runtime}.version_history h JOIN ${current.runtime}.revision r ON r.document_id=h.document_id AND r.revision=h.revision
  LEFT JOIN ${current.runtime}.operator o ON o.id=h.actor_id WHERE h.document_id=$1::uuid
  UNION ALL SELECT NULL::int,r.revision,'import',r.actor_id,NULL::text,${importedTime},r.original_imported,${scopeBody('r.body')},${detailAvailable}
  FROM ${current.runtime}.revision r WHERE r.document_id=$1::uuid AND r.original_imported
  AND NOT EXISTS(SELECT 1 FROM ${current.runtime}.version_history h WHERE h.document_id=r.document_id AND h.revision=r.revision AND h.operation='import')
  ORDER BY revision,version NULLS FIRST`,[id])).rows;
 const result:Json[]=[];
 for(const row of rows){
  let historical:DocumentScope;
  if(current.sourceBound){
   if(row['revision']!==current.manifest.revision)return invalid('HISTORICAL_SCOPE_REQUIRES_EXPLICIT_REVISION_TRACE');historical=scope;
  }else historical=withTransferCreationScope(scopeFromBody(type,row['scope_body']),scope);
  try{await authorizeDocument(context.actor,historical,type==='SALE'?'sales.history':'transfers.history',context.repo);}
  catch(error){if(error instanceof SecurityError&&['SCOPE','FORBIDDEN'].includes(error.code))continue;throw error;}
  result.push({projection:'summary',documentId:id,version:row['version'],revision:row['revision'],operation:row['operation'],actor_id:row['actor_id']??null,
   actor_name:row['actor_name']??null,created_at:row['created_at']??null,original_imported:row['original_imported'],detailAvailable:row['detail_available']===true,
   ...(current.manifest.scope['legacyReadonly']===true?{readonly:true,auditAllowed:false}:{})});
 }
 return result;
}
/** Scope is a bounded trusted stored header, never the full source/body and
 * never an alternative authorization path for commands. */
export async function readConfirmedDocumentScope(repo:SecurityRepository,id:string):Promise<DocumentScope|null> {
 const found=(await repo.session.query<{document_type:string}>(`SELECT document_type FROM ${repo.runtime}.document WHERE id=$1::uuid`,[identifier(id,true)])).rows[0];
 if(!found||!['SALE','TRANSFER'].includes(found.document_type))return null;
 const current=await carrier(repo,id,found.document_type as ListType);
 const {manifest}=current,s=record(manifest.scope),header=record(s['header']),creator=record(s['creator']),warehouseIds=s['warehouseIds'];
 if(!Array.isArray(warehouseIds))return invalid('BUSINESS_SCOPE_MISSING');
 const nullable=(v:unknown):string|null=>typeof v==='string'&&v?v:null;
 return {id:manifest.id,type:manifest.type,version:manifest.version,status:String((await repo.session.query<{status:string}>(`SELECT status FROM ${repo.runtime}.document WHERE id=$1::uuid`,[id])).rows[0]?.status??invalid('BUSINESS_SCOPE_MISSING')),
  storeId:nullable(header['hall_id']),creatorId:nullable(creator['id']),creatorHallId:nullable(s['creatorHallId']),creatorAccountId:nullable(s['creatorAccountId']),creatorRole:s['creatorRole'] as Role|null,
  warehouseIds:warehouseIds.map(w=>identifier(w,true)),header,originalAuditor:nullable(s['originalAuditor']),originalAuditedAt:s['originalAuditedAt']?new Date(String(s['originalAuditedAt'])):null};
}
