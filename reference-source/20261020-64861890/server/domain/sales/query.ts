import type {VerifiedNativeIncrementProjection} from '../imports/current-source-body.js';
import {readConfirmedDocument,readConfirmedHistorySummary,confirmedHistoricalBody} from '../documents/document-read.js';
import type {AuthorizedContext} from '../../security/service.js';
import {ActionSession,type DataSession,type SqlValue} from '../../database/session.js';
import {createHash} from 'node:crypto';
import {canonicalJson} from '../idempotency/index.js';
import {authorizeDocument} from '../../security/policies.js';
import {scopeFromBody} from '../../security/repository.js';
import {identifier, invalid, object, SecurityError} from '../../security/errors.js';
import {parseBusinessDay} from '../transactions/decimal.js';
import {saleHasAssociations, saleWarehouseOriginSelection, resolveSaleWarehousePolicy} from './returns.js';
import {documentListQuery,documentListMaintenanceAllowed,documentListMutationSql,documentListBasisSql,documentListFacts,DOCUMENT_LIST_PROJECTOR_SHA,type DocumentListConfig,type DocumentListProduct,type VerifiedDocumentListFacts} from '../documents/list-model.js';
import {readMaintainedDocumentList} from '../documents/list-query.js';

interface SaleReadRecord {id:string;document_type:string;current_revision:number;source_identity:unknown;body:Record<string,unknown>}
interface SaleRow extends SaleReadRecord,Record<string,unknown> {version:number;original_imported:boolean}
interface SaleReadProjection {body:Record<string,unknown>;legacy_readonly?:true;auditAllowed?:false;read_projection?:Record<string,unknown>}
// Current detail is independent of deferred full historical snapshots. History
// remains opt-in and keeps its explicit readiness errors, never an empty fallback.
export async function saleDetail(context:AuthorizedContext,id:string,includeHistory=false):Promise<SaleRow> {
  const confirmed=await readConfirmedDocument(context,id,'SALE');
  return {...confirmed,warehouse_policy:confirmed['warehouse_policy'],association_protected:await saleHasAssociations(context,id),...(includeHistory?{history:await saleHistory(context,id,{projection:'summary'})}:{})};
}
export interface SaleHistoryOptions {projection?:'summary';revision?:number}
export async function saleHistory(context:AuthorizedContext,id:string,options:SaleHistoryOptions={}):Promise<Record<string,unknown>[]> {
  if(options.revision===undefined||options.projection==='summary'){const confirmed=await readConfirmedHistorySummary(context,id,'SALE');return options.revision===undefined?confirmed:confirmed.filter(row=>row['revision']===options.revision);}
  const {repo,session,actor}=context;
  const current=await repo.document(id);
  await authorizeDocument(actor,current,'sales.history',repo);
  const confirmed=await readConfirmedDocument(context,id,'SALE');
  const project=async(body:Record<string,unknown>,revision:unknown,identity:unknown):Promise<SaleReadProjection>=>({body:confirmedHistoricalBody(confirmed,Number(revision),body,identity),
    ...(confirmed['legacy_readonly']===true?{legacy_readonly:true,auditAllowed:false,read_projection:object(confirmed['read_projection'])}:{})});
  const revisions=(await session.query<{body:Record<string,unknown>} & Record<string,unknown>>(`SELECT r.revision,r.original_imported,r.body AS body,r.actor_id,r.created_at,d.source_identity AS _read_source_identity
    FROM ${repo.runtime}.revision r JOIN ${repo.runtime}.document d ON d.id=r.document_id
    WHERE r.document_id=$1::uuid${options.revision!==undefined?' AND r.revision=$2::int':''} ORDER BY r.revision`,options.revision!==undefined?[id,options.revision]:[id])).rows;
  const visible=async(body:Record<string,unknown>):Promise<boolean>=>{
    try{await authorizeDocument(actor,scopeFromBody('SALE',body),'sales.history',repo);return true;}
    catch(error){if(error instanceof SecurityError&&['SCOPE','FORBIDDEN'].includes(error.code))return false;throw error;}
  };
  const visibleRevisions:typeof revisions=[];
  for(const revision of revisions){
    Object.assign(revision,await project(revision.body,revision['revision'],revision['_read_source_identity']));delete revision['_read_source_identity'];
    if(await visible(revision.body))visibleRevisions.push(revision);
  }
  const versions=(await session.query<{body:Record<string,unknown>;previous_body:Record<string,unknown>|null} & Record<string,unknown>>(`SELECT h.*,o.name actor_name,r.body AS body,r.original_imported,d.source_identity AS _read_source_identity,
    (SELECT p.body FROM ${repo.runtime}.revision p WHERE p.document_id=h.document_id AND p.revision=h.revision-1) previous_body,
    (SELECT jsonb_agg(jsonb_build_object('id',p.id,'reason',p.reason,'reversedEffectIdentity',p.reversed_effect_identity) ORDER BY p.id)
      FROM ${repo.runtime}.posting p WHERE p.document_id=h.document_id AND p.actor_id=h.actor_id AND p.request_key=h.request_key
      AND (h.operation='approve' AND p.reason='REVISION_APPROVAL' OR h.operation='unapprove' AND p.reason<>'REVISION_APPROVAL')) postings
    FROM ${repo.runtime}.version_history h JOIN ${repo.runtime}.revision r ON r.document_id=h.document_id AND r.revision=h.revision
    JOIN ${repo.runtime}.document d ON d.id=h.document_id
    LEFT JOIN ${repo.runtime}.operator o ON o.id=h.actor_id WHERE h.document_id=$1::uuid${options.revision!==undefined?' AND h.revision=$2::int':''} ORDER BY h.version`,options.revision!==undefined?[id,options.revision]:[id])).rows;
  // Imported revision 1 may have no operational version_history. Expose it without fabricating actor/auditor.
  const imported=visibleRevisions.filter(r=>r['original_imported']&&!versions.some(v=>v['revision']===r['revision']&&v['operation']==='import'));
  const visibleVersions:Record<string,unknown>[]=[];
  for(const version of versions){
    const identity=version['_read_source_identity'];delete version['_read_source_identity'];
    Object.assign(version,await project(version.body,version['revision'],identity));
    if(!await visible(version.body))continue;
    const previous=version.previous_body?(await project(version.previous_body,Number(version['revision'])-1,identity)).body:null;
    visibleVersions.push({...version,previous_body:previous&&await visible(previous)?previous:null});
  }
  const result:Record<string,unknown>[]=[...imported.map(r=>({...r,operation:'import',version:null,actor_name:null,previous_body:null,
    imported_at:r['created_at'],created_at:object(r.body['header'])['created_at']??null})),...visibleVersions];
  return result;
}

// The T32 importer stores the approved archive unchanged. Its committed endpoint
// binding supplies current read identities, never identities for a new posting.
const saleSourceSchema='T32-APPROVED-CURRENT-SOURCE-BINDING-v1';
const saleSourceContract='ac2a22a713120323626f01e2e96e570082f3f0bce88db9dda59c23ac7ac86188';
const saleSourceBound="coalesce(d.source_identity ? 'currentSourceBinding',false)";
const saleSourceInvalid=():never=>{throw new SecurityError('CURRENT_SOURCE_READ_INVALID',409,'原销货来源无法安全读取');};
const saleSourceDigest=(v:unknown):string=>createHash('sha256').update(canonicalJson(v)).digest('hex');
const saleSourceObject=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:saleSourceInvalid();

/** Candidate scope and immutable source proof. Invalid members remain in the
 * count and reject the request; filtering must not silently discard bad rows. */
function saleReadScopeSql(runtime:string,source:string,includeMembers=false,materializeScope=false,documentSet?:string):string {
 return saleSourceScopeSql(runtime,source,includeMembers,materializeScope,documentSet,"current_setting('transaction_read_only')='on' AND\n    current_setting('transaction_isolation') IN ('repeatable read','serializable')");
}
function saleSourceScopeSql(runtime:string,source:string,includeMembers:boolean,materializeScope:boolean,documentSet:string|undefined,verificationContextSql:string):string {
  const b="d.source_identity->'currentSourceBinding'";
  const array=(v:string):string=>`CASE WHEN jsonb_typeof(${v})='array' THEN ${v} ELSE '[]'::jsonb END`;
  const uuid=(v:string):string=>`${v} ~* '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'`;
  const uuidValue=(v:string):string=>`CASE WHEN ${uuid(v)} THEN CASE WHEN (${v})::uuid::text=${v} THEN (${v})::uuid END END`;
  const memberValid=`coalesce(
    batch.status='COMMITTED' AND batch.importer_version='${saleSourceSchema}' AND batch.sha256=${b}->>'approvalManifestSha256' AND
    raw->>'namespace'='CURRENT_SOURCE_ROW_OBSERVATION' AND raw->>'approvalManifestSha256'=batch.sha256 AND
    raw->'readonly'='true'::jsonb AND raw->'auditAllowed'='false'::jsonb AND
    raw#>>'{binding,schemaVersion}'='T32-CURRENT-SOURCE-ENDPOINT-BINDING-PLAN-v1' AND
    raw#>>'{binding,mode}'='BOUND_READONLY_CURRENT_DOCUMENT' AND raw#>'{binding,readonly}'='true'::jsonb AND raw#>'{binding,auditAllowed}'='false'::jsonb AND
    raw#>>'{binding,sourceEndpointId}'=m->>'sourceEndpointId' AND raw#>>'{binding,lineId}'=m->>'lineId' AND
    raw#>>'{binding,sourceFamily}'='SALE' AND raw#>>'{binding,specNamespace}'=m->>'specNamespace' AND
    raw#>'{binding,originalHistoricalSkuId}' IS NOT DISTINCT FROM m->'originalHistoricalSkuId' AND
    raw#>'{binding,quantityMapping}'=m->'quantityMapping' AND
    raw#>>'{binding,document,sourceGroupKey}'=${b}->>'sourceGroupKey' AND raw#>>'{binding,document,archiveRevision}'=r.revision::text AND
    raw#>>'{binding,document,documentProofSha256}'=${b}->>'documentProofSha256' AND raw#>>'{binding,document,bodySha256}' ~ '^[a-f0-9]{64}$' AND
    raw#>>'{observation,schemaVersion}'='T32-CURRENT-SOURCE-ROW-v1' AND
    raw#>>'{observation,endpoint,sourceFamily}'='SALE' AND raw#>>'{observation,endpoint,lineId}'=m->>'lineId' AND
    raw#>>'{observation,endpoint,sourceEndpointId}'=m->>'sourceEndpointId' AND
    m->>'lineId' ~ '^[a-zA-Z0-9_-]{1,128}$' AND
    m->>'sourceEndpointId'=encode(sha256(convert_to('["'||(m->>'lineId')||'","SALE"]'||chr(10),'UTF8')),'hex') AND
    raw#>'{observation,endpoint,quantityDimensionKey}'=m#>'{quantityMapping,sourceQuantityKey}' AND
    jsonb_array_length(${array("m#>'{quantityMapping,sourceQuantityKey}'")})=3 AND
    raw#>>'{observation,endpoint,measurementUnit}'=m#>>'{quantityMapping,sourceQuantityKey,2}' AND
    m#>'{quantityMapping,currentIdentityPromotedAsHistorical}'='false'::jsonb AND
    m#>>'{quantityMapping,runtimeWarehouseKey}'='WAREHOUSE:'||(m#>>'{quantityMapping,sourceQuantityKey,0}') AND
    ${uuid("m#>>'{quantityMapping,runtimeWarehouseId}'")} AND ${uuid("m#>>'{quantityMapping,runtimeSkuId}'")} AND
    (m->>'specNamespace'='ORIGINAL_HISTORY' AND m#>>'{quantityMapping,identityKind}'='CONFIRMED_HISTORICAL_SKU' AND
      m->>'originalHistoricalSkuId'=m#>>'{quantityMapping,runtimeSkuId}' AND m->>'originalHistoricalSkuId'=m#>>'{quantityMapping,sourceQuantityKey,1}' AND
      m->>'originalHistoricalSkuId'=m#>>'{quantityMapping,sourceHistoricalOriginalSkuId}' OR
      m->>'specNamespace' IN ('CURRENT_OBSERVED','CURRENT_CORRECTED') AND m->'originalHistoricalSkuId'='null'::jsonb AND
      m#>'{quantityMapping,sourceHistoricalOriginalSkuId}'='null'::jsonb AND
      m#>>'{quantityMapping,identityKind}'=CASE WHEN m->>'specNamespace'='CURRENT_OBSERVED' THEN 'CURRENT_TPLUS_SOURCE_SPEC_OBSERVATION' ELSE 'T03_CORRECTED_CURRENT_SPEC' END) AND
    line->>'source_line_id'=m->>'lineId' AND line->'sku_id' IS NOT DISTINCT FROM m->'originalHistoricalSkuId' AND
    line->>'unit'=m#>>'{quantityMapping,sourceQuantityKey,2}' AND
    line->'originalFields'=raw#>'{observation,originalFields}' AND line->>'originalFieldsSha256'=raw#>>'{observation,originalFieldsSha256}' AND
    line->'source_quantity'=line#>'{originalFields,fields,数量}' AND
    line->'amount'=coalesce(line#>'{originalFields,fields,含税金额}',line#>'{originalFields,fields,金额}') AND
    (NOT (line ? 'warehouse_id') OR line->>'warehouse_id'=m#>>'{quantityMapping,runtimeWarehouseId}') AND
    ${materializeScope?'sku_entities=1':`(SELECT count(*) FROM (
      SELECT id FROM ${source}.variant WHERE id=${uuidValue("m#>>'{quantityMapping,runtimeSkuId}'")}
      UNION ALL SELECT id FROM ${runtime}.variant_overlay WHERE id=${uuidValue("m#>>'{quantityMapping,runtimeSkuId}'")}) sku_entities)=1`},false)`;
  const proof=`coalesce(r.original_imported AND jsonb_typeof(r.body->'header')='object' AND r.body#>>'{header,business_type}'='SALE' AND
    ${b}->>'schemaVersion'='${saleSourceSchema}' AND ${b}->>'contractSha256'='${saleSourceContract}' AND
    ${b}->>'mode'='BOUND_READONLY_CURRENT_DOCUMENT' AND ${b}->'readonly'='true'::jsonb AND ${b}->'auditAllowed'='false'::jsonb AND
    ${b}->'historicalStateTimelineConfirmed'='false'::jsonb AND ${b}->'historicalStateAtExactCutoffConfirmed'='false'::jsonb AND
    ${b}->>'statusSemantic'='CURRENT_IMPORTED_READONLY_CONTAINER' AND ${b}#>>'{groupingEvidence,kind}'='CONFIRMED_COMPLETE_CURRENT_EXPORT_GROUP' AND
    ${b}->>'approvalManifestSha256' ~ '^[a-f0-9]{64}$' AND ${b}->>'documentProofSha256' ~ '^[a-f0-9]{64}$' AND ${b}->>'sourceGroupKey'<>'' AND
    ${b}#>>'{target,schemas,runtime}'='${runtime.slice(1,-1)}' AND ${b}#>>'{target,schemas,source}'='${source.slice(1,-1)}' AND
    ${b}#>>'{target,database}'=current_database() AND ${verificationContextSql} AND
    jsonb_typeof(r.body->'lines')='array' AND jsonb_typeof(${b}->'bindings')='array' AND
    jsonb_array_length(${array("r.body->'lines'")}) BETWEEN 1 AND 10000 AND
    n=jsonb_array_length(${array("r.body->'lines'")}) AND n=jsonb_array_length(${array(`${b}->'bindings'`)}) AND
    endpoints=n AND line_ids=n AND body_hashes=1 AND warehouses=1 AND members_valid AND
    (NOT (r.body->'header' ? 'source_warehouse_id') OR r.body#>>'{header,source_warehouse_id}'=warehouse_id),false)`;
  const scopeSelection=`CASE WHEN ${saleSourceBound} THEN warehouse_id ELSE r.body#>>'{header,source_warehouse_id}' END warehouse_id,
      NOT (${saleSourceBound}) OR ${proof} source_valid,body_sha${includeMembers?',source_members':''}`;
  if(documentSet){
    // Same member bag and proof, grouped by the immutable document key. The
    // source/variant relations can be joined once for the matching document set
    // instead of rebuilding a correlated proof relation for every document.
    // No aggregate state survives this statement or its read-only snapshot.
    return `sale_source_lines AS MATERIALIZED (
      SELECT d.id document_id,line->>'source_line_id' line_id,line
      FROM ${documentSet} d CROSS JOIN LATERAL jsonb_array_elements(${array("d.body->'lines'")}) line WHERE ${saleSourceBound}
    ), sale_source_members AS (
      SELECT d.id document_id,d.source_identity,d.current_revision revision,m,line,observed.*,
        ((source_sku.id IS NOT NULL)::int+(overlay_sku.id IS NOT NULL)::int) sku_entities
      FROM ${documentSet} d CROSS JOIN LATERAL jsonb_array_elements(${array(`${b}->'bindings'`)}) m
      LEFT JOIN sale_source_lines source_lines ON source_lines.document_id=d.id AND source_lines.line_id=m->>'lineId'
      LEFT JOIN ${source}.variant source_sku ON source_sku.id=${uuidValue("m#>>'{quantityMapping,runtimeSkuId}'")}
      LEFT JOIN ${runtime}.variant_overlay overlay_sku ON overlay_sku.id=${uuidValue("m#>>'{quantityMapping,runtimeSkuId}'")}
      LEFT JOIN LATERAL (SELECT sr.raw_value raw,batch.status,batch.importer_version,batch.sha256 FROM ${source}.source_record sr
        JOIN ${source}.import_batch batch ON batch.id=sr.batch_id AND batch.sha256=${b}->>'approvalManifestSha256'
        WHERE sr.source_key=m->>'sourceEndpointId' AND sr.source_type='CURRENT_SOURCE_ROW_OBSERVATION') observed ON true
      WHERE ${saleSourceBound}
    ), sale_proof_aggregates AS (
      SELECT document_id,count(*) member_count,count(DISTINCT m->>'sourceEndpointId') endpoint_count,count(DISTINCT m->>'lineId') line_id_count,
        count(DISTINCT raw#>>'{binding,document,bodySha256}') body_hash_count,count(DISTINCT m#>>'{quantityMapping,runtimeWarehouseId}') warehouse_count,
        min(m#>>'{quantityMapping,runtimeWarehouseId}') warehouse_id,min(raw#>>'{binding,document,bodySha256}') body_sha,
        bool_and(${memberValid.replaceAll('batch.','')}) members_valid${includeMembers?",jsonb_agg(jsonb_build_object('binding',m,'observation',raw)) source_members":''}
      FROM sale_source_members d CROSS JOIN LATERAL (SELECT d.revision) r GROUP BY document_id
    ), sale_scopes AS (
      SELECT d.id document_id,${scopeSelection}
      FROM ${documentSet} d CROSS JOIN LATERAL (SELECT d.body,d.original_imported) r
      LEFT JOIN sale_proof_aggregates a ON a.document_id=d.id
      CROSS JOIN LATERAL (SELECT coalesce(a.member_count,0) n,coalesce(a.endpoint_count,0) endpoints,coalesce(a.line_id_count,0) line_ids,
        coalesce(a.body_hash_count,0) body_hashes,coalesce(a.warehouse_count,0) warehouses) counts
    )`;
  }
  // The list scope joins the original line bag directly. Grouping and expanding
  // it again added a second set-returning function with an inflated row estimate.
  // Both variant ids are primary keys: two left joins preserve the exact 0/1/2
  // entity count, including rejection when both stores contain the same id.
  // Keep the selected-body/detail SQL unchanged.
  const sourceLines=materializeScope?`source_lines AS MATERIALIZED (
    SELECT line->>'source_line_id' line_id,line
    FROM jsonb_array_elements(${array("r.body->'lines'")}) line WHERE ${saleSourceBound}
  )`:`source_line_groups AS MATERIALIZED (
    SELECT line->>'source_line_id' line_id,jsonb_agg(line) line_rows
    FROM jsonb_array_elements(${array("r.body->'lines'")}) line WHERE ${saleSourceBound}
    GROUP BY line->>'source_line_id'
  )`;
  const lineJoin=materializeScope?`LEFT JOIN source_lines ON source_lines.line_id=m->>'lineId'`:`LEFT JOIN source_line_groups source_lines ON source_lines.line_id=m->>'lineId'
    LEFT JOIN LATERAL jsonb_array_elements(source_lines.line_rows) source_line(line) ON true`;
  return `CROSS JOIN LATERAL (WITH ${sourceLines}, members AS (
    SELECT m,line,observed.*${materializeScope?',((source_sku.id IS NOT NULL)::int+(overlay_sku.id IS NOT NULL)::int) sku_entities':''} FROM jsonb_array_elements(${array(`${b}->'bindings'`)}) m
    ${lineJoin}${materializeScope?`
    LEFT JOIN ${source}.variant source_sku ON source_sku.id=${uuidValue("m#>>'{quantityMapping,runtimeSkuId}'")}
    LEFT JOIN ${runtime}.variant_overlay overlay_sku ON overlay_sku.id=${uuidValue("m#>>'{quantityMapping,runtimeSkuId}'")}`:''}
    LEFT JOIN LATERAL (SELECT sr.raw_value raw,batch.status,batch.importer_version,batch.sha256 FROM ${source}.source_record sr
      JOIN ${source}.import_batch batch ON batch.id=sr.batch_id AND batch.sha256=${b}->>'approvalManifestSha256'
      WHERE sr.source_key=m->>'sourceEndpointId' AND sr.source_type='CURRENT_SOURCE_ROW_OBSERVATION') observed ON true
    WHERE ${saleSourceBound}), aggregates AS (SELECT count(*) n,count(DISTINCT m->>'sourceEndpointId') endpoints,count(DISTINCT m->>'lineId') line_ids,
      count(DISTINCT raw#>>'{binding,document,bodySha256}') body_hashes,count(DISTINCT m#>>'{quantityMapping,runtimeWarehouseId}') warehouses,
      min(m#>>'{quantityMapping,runtimeWarehouseId}') warehouse_id,min(raw#>>'{binding,document,bodySha256}') body_sha,
      bool_and(${memberValid.replaceAll('batch.','')}) members_valid
      ${includeMembers?",jsonb_agg(jsonb_build_object('binding',m,'observation',raw)) source_members":''} FROM members)${materializeScope?`, proved_scope AS MATERIALIZED (
    SELECT ${scopeSelection} FROM aggregates)`:''}
    SELECT ${materializeScope?'* FROM proved_scope':`${scopeSelection} FROM aggregates`}) sale_read_scope`;
}

/** Selected-page proof uses the untouched archive and committed observations,
 * then generates only a private read projection. No source body is persisted. */
function saleListReadBody(row:SaleRow):Record<string,unknown> {
  const identity=row['source_identity'];
  if(!identity||typeof identity!=='object'||Array.isArray(identity)||!Object.hasOwn(identity,'currentSourceBinding'))return row.body;
  if(row['source_read_valid']!==true)return saleSourceInvalid();
  const b=saleSourceObject((identity as Record<string,unknown>)['currentSourceBinding']),body=saleSourceObject(row['source_read_body']);
  if(saleSourceDigest(body)!==row['source_read_body_sha'])return saleSourceInvalid();
  const header=saleSourceObject(body['header']),bindings=b['bindings'],members=row['source_read_members'],lines=body['lines'];
  if(!Array.isArray(bindings)||!Array.isArray(members)||!Array.isArray(lines)||!lines.length||bindings.length!==lines.length||members.length!==lines.length)return saleSourceInvalid();
  const originals=new Map<string,Record<string,unknown>>();
  for(const value of lines){const line=saleSourceObject(value),id=identifier(line['source_line_id']);if(originals.has(id))return saleSourceInvalid();originals.set(id,line);}
  const byLine=new Map<string,string>(),endpoints=new Set<string>();
  for(const value of members){
    const member=saleSourceObject(value),binding=saleSourceObject(member['binding']),raw=saleSourceObject(member['observation']);
    const full=saleSourceObject(raw['binding']),observation=saleSourceObject(raw['observation']),endpoint=saleSourceObject(observation['endpoint']);
    const lineId=identifier(binding['lineId']),endpointId=binding['sourceEndpointId'],mapping=saleSourceObject(binding['quantityMapping']);
    if(typeof endpointId!=='string'||endpoints.has(endpointId)||byLine.has(lineId)||
      createHash('sha256').update(JSON.stringify([lineId,'SALE'])+'\n').digest('hex')!==endpointId||
      saleSourceDigest(endpoint)!==full['sourceEndpointSha256']||saleSourceDigest(observation['originalFields'])!==observation['originalFieldsSha256'])return saleSourceInvalid();
    const original=originals.get(lineId);
    if(!original||saleSourceDigest(original['originalFields'])!==observation['originalFieldsSha256']||
      saleSourceDigest(full['quantityMapping'])!==saleSourceDigest(mapping))return saleSourceInvalid();
    identifier(mapping['runtimeSkuId'],true);
    byLine.set(lineId,identifier(mapping['runtimeWarehouseId'],true));endpoints.add(endpointId);
  }
  const warehouses=[...new Set(byLine.values())];if(warehouses.length!==1)return saleSourceInvalid();
  const warehouse=warehouses[0]!;
  if(Object.hasOwn(header,'source_warehouse_id')&&header['source_warehouse_id']!==warehouse)return saleSourceInvalid();
  return {...body,header:{...header,source_warehouse_id:warehouse},lines:lines.map(value=>{
    const line=saleSourceObject(value),id=identifier(line['source_line_id']),mapped=byLine.get(id)??saleSourceInvalid();
    if(Object.hasOwn(line,'warehouse_id')&&line['warehouse_id']!==mapped)return saleSourceInvalid();
    return {...line,warehouse_id:mapped};
  })};
}
/** One persisted archive/revision, in the same genuine guarded read snapshot.
 * Scope, detail/history and outputs share the list's immutable source proof. */
export async function projectSaleReadBody(session:DataSession,runtime:string,source:string,row:SaleReadRecord):Promise<SaleReadProjection> {
  const identity=row.source_identity;
  if(!identity||typeof identity!=='object'||Array.isArray(identity)||!Object.hasOwn(identity,'currentSourceBinding'))return {body:row.body};
  if(!(session instanceof ActionSession)||row.document_type!=='SALE'||!Number.isSafeInteger(row.current_revision)||row.current_revision<1)return saleSourceInvalid();
  const b=saleSourceObject((identity as Record<string,unknown>)['currentSourceBinding']),target=saleSourceObject(b['target']),schemas=saleSourceObject(target['schemas']);
  if(schemas['runtime']!==runtime.slice(1,-1)||schemas['source']!==source.slice(1,-1))return saleSourceInvalid();
  const proved=(await session.query<SaleRow>(`SELECT d.id,d.document_type,d.source_identity,r.revision AS current_revision,r.original_imported,r.body,
    sale_read_scope.source_valid source_read_valid,sale_read_scope.body_sha source_read_body_sha,sale_read_scope.source_members source_read_members,r.body source_read_body
    FROM ${runtime}.document d JOIN ${runtime}.revision r ON r.document_id=d.id
    ${saleReadScopeSql(runtime,source,true)} WHERE d.id=$1::uuid AND d.document_type='SALE' AND r.revision=$2::int`,[identifier(row.id,true),row.current_revision])).rows[0];
  if(!proved||proved.id!==row.id||proved.current_revision!==row.current_revision||proved.document_type!=='SALE'||proved['source_read_valid']!==true||
    saleSourceDigest(proved.source_identity)!==saleSourceDigest(identity)||saleSourceDigest(proved.body)!==saleSourceDigest(row.body))return saleSourceInvalid();
  const body=saleListReadBody(proved),members=proved['source_read_members'];
  if(!Array.isArray(members)||!Array.isArray(body['lines']))return saleSourceInvalid();
  const byLine=new Map<string,string>();
  for(const value of members){const binding=saleSourceObject(saleSourceObject(value)['binding']),mapping=saleSourceObject(binding['quantityMapping']);byLine.set(identifier(binding['lineId']),identifier(mapping['runtimeSkuId'],true));}
  const skus=[...new Set(byLine.values())];
  const entities=(await session.query<{id:string;product_id:string;product_count:string}>(`WITH effective AS (
    SELECT id,product_id FROM ${source}.variant WHERE id=ANY($1::uuid[]) UNION ALL
    SELECT id,product_id FROM ${runtime}.variant_overlay WHERE id=ANY($1::uuid[]))
    SELECT e.id::text,e.product_id::text,(SELECT count(*)::text FROM (
      SELECT id FROM ${source}.product WHERE id=e.product_id UNION ALL SELECT id FROM ${runtime}.product_overlay WHERE id=e.product_id) p) product_count FROM effective e`,[skus])).rows;
  const products=new Map<string,string>();
  for(const entity of entities){if(products.has(entity.id)||entity.product_count!=='1'||!byLine.size)return saleSourceInvalid();products.set(entity.id,identifier(entity.product_id,true));}
  if(products.size!==skus.length||skus.some(sku=>!products.has(sku)))return saleSourceInvalid();
  const metadata={readonly:true,auditAllowed:false,identityKind:'CURRENT_DISPLAY_ONLY',historicalSkuEvidenceClaimed:false,
    sourceGroupKey:b['sourceGroupKey'],approvalManifestSha256:b['approvalManifestSha256'],originalBodySha256:proved['source_read_body_sha']};
  return confirmedSaleReadProjection(row,body,byLine,products,metadata);
}

/** Pure assembly after the original canonical/member/entity verification. */
function confirmedSaleReadProjection(row:SaleReadRecord,body:Record<string,unknown>,byLine:ReadonlyMap<string,string>,products:ReadonlyMap<string,string>,metadata:Record<string,unknown>):SaleReadProjection {
  const originals=new Map((row.body['lines'] as unknown[]).map(value=>{const line=saleSourceObject(value);return [identifier(line['source_line_id']),line] as const;}));
  const lines=(body['lines'] as unknown[]).map(value=>{
    const line=saleSourceObject(value),lineId=identifier(line['source_line_id']),sku=byLine.get(lineId)??saleSourceInvalid(),product=products.get(sku)??saleSourceInvalid();
    if(Object.hasOwn(line,'product_id')&&line['product_id']!==product)return saleSourceInvalid();
    return {...line,source_id:lineId,sku_id:sku,product_id:product,sourceFacts:structuredClone(originals.get(lineId)??saleSourceInvalid()),
      readIdentity:{kind:'CURRENT_DISPLAY_ONLY',historicalSkuEvidenceClaimed:false,originalHistoricalSkuId:line['sku_id'],sourceLineId:lineId}};
  });
  return {body:{...body,lines,sourceFacts:structuredClone(row.body),readProjection:metadata},legacy_readonly:true,auditAllowed:false,read_projection:metadata};
}

const numericSql=(value:string):string=>`coalesce(${value} ~ '^[-+]?[0-9]+([.][0-9]+)?$',false)`;
const saleStatsSql=(body:string):string=>`LEFT JOIN LATERAL (SELECT
 CASE WHEN jsonb_typeof(${body}->'lines')='array' AND count(quantity)=count(*) THEN coalesce(sum(quantity),0)::text END quantity,
 CASE WHEN jsonb_typeof(${body}->'lines')='array' AND count(quantity)=count(*) THEN coalesce(sum(CASE WHEN gift THEN quantity ELSE 0 END),0)::text END gift_quantity,
 CASE WHEN jsonb_typeof(${body}->'lines')='array' AND count(quantity)=count(*) THEN coalesce(sum(CASE WHEN quantity<0 AND NOT gift THEN abs(quantity) ELSE 0 END),0)::text END incoming_quantity,
 CASE WHEN jsonb_typeof(${body}->'lines')='array' AND count(quantity)=count(*) THEN coalesce(sum(CASE WHEN quantity>0 AND NOT gift THEN quantity ELSE 0 END),0)::text END outgoing_quantity,
 CASE WHEN jsonb_typeof(${body}->'lines')='array' AND count(amount)=count(*) THEN coalesce(sum(amount),0)::text END gross
 FROM (SELECT CASE WHEN ${numericSql("line->>'source_quantity'")} THEN (line->>'source_quantity')::numeric END quantity,
 CASE WHEN ${numericSql("line->>'amount'")} THEN (line->>'amount')::numeric END amount,coalesce(line->>'gift'='true',false) gift
 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(${body}->'lines')='array' THEN ${body}->'lines' ELSE '[]'::jsonb END) line) original_lines) sale_stats ON true`;
function saleCategoriesSql(runtime:string,source:string,modelProducts=false):string{
 const uuidValue=(v:string):string=>`CASE WHEN ${v} ~* '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' THEN CASE WHEN (${v})::uuid::text=${v} THEN (${v})::uuid END END`;
 return `LEFT JOIN LATERAL (
 WITH category_rows AS (SELECT coalesce(nullif(original_category.body->>'canonicalCategoryId',''),pp.body->>'categoryId',po.body->>'categoryId',c.code,'__unrecorded') id,
 coalesce(cm.body->>'name',c.name,'待确认分类') name,line.ordinal,${modelProducts?"identity.product_id,line.value->>'sku_id' sku_id,line.value->>'source_line_id' source_line_id,coalesce(line.value->>'gift'='true',false) gift,":''}
 CASE WHEN ${numericSql("line.value->>'source_quantity'")} THEN (line.value->>'source_quantity')::numeric END quantity
 FROM jsonb_array_elements(r.body->'lines') WITH ORDINALITY line(value,ordinal)
 LEFT JOIN LATERAL (SELECT CASE WHEN count(DISTINCT product_id)=1 THEN min(product_id::text)::uuid END product_id FROM (
 SELECT product_id FROM ${source}.variant WHERE id=${uuidValue("line.value->>'sku_id'")}
 UNION ALL SELECT product_id FROM ${runtime}.variant_overlay variant WHERE variant.id=${uuidValue("line.value->>'sku_id'")}
 AND NOT EXISTS(SELECT 1 FROM ${source}.variant original WHERE original.id=variant.id)) actual_original_sku) identity ON true
 LEFT JOIN ${source}.product product ON product.id=identity.product_id LEFT JOIN ${runtime}.product_overlay po ON po.id=identity.product_id
 LEFT JOIN ${source}.category c ON c.id=product.category_id
 LEFT JOIN ${runtime}.product_profile_overlay pp ON pp.product_id=product.id
 LEFT JOIN ${runtime}.product_master_overlay original_category ON original_category.kind='categories' AND original_category.id=coalesce(pp.body->>'categoryId',po.body->>'categoryId',c.code) AND NOT original_category.deleted
 LEFT JOIN ${runtime}.product_master_overlay cm ON cm.kind='categories' AND cm.id=coalesce(nullif(original_category.body->>'canonicalCategoryId',''),pp.body->>'categoryId',po.body->>'categoryId',c.code) AND NOT cm.deleted
 ${modelProducts?'':"WHERE line.value->>'gift' IS DISTINCT FROM 'true'"}), categories AS (
 SELECT id,min(name) name,min(ordinal) ordinal,CASE WHEN count(quantity)=count(*) THEN sum(quantity)::text END quantity
 FROM category_rows ${modelProducts?'WHERE NOT gift ':''}GROUP BY id HAVING sum(quantity)<>0 OR count(quantity)<>count(*))
 SELECT (SELECT count(*) FROM categories)::int category_count,
 (SELECT coalesce(jsonb_agg(to_jsonb(first_categories) ORDER BY ordinal),'[]'::jsonb) FROM (SELECT * FROM categories ORDER BY ordinal,id LIMIT 3) first_categories) categories${modelProducts?",(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'ordinal',ordinal,'product_id',product_id,'sku_id',sku_id,'source_line_id',source_line_id,'gift',gift,'quantity',quantity::text) ORDER BY ordinal),'[]'::jsonb) FROM category_rows) model_products":''}) sale_categories ON true`;}

/** The normal maintenance and the fixed read-only diagnostic use this exact
 * projector. Scope is the complete requested document set, never a raw LIMIT.
 * Historical provenance is scanned once for that set; every source member and
 * the unchanged canonical-body proof remain present. */
function saleListFactsProjectionSql(runtime:string,source:string,verificationContextSql:string):string {
 const adjustment="coalesce(r.body#>>'{header,adjustment}',r.body#>>'{header,source_payload,rounding}','0')";
 return `WITH sale_model_documents AS MATERIALIZED (
  SELECT d.*,r.body,r.original_imported FROM ${runtime}.document d
  JOIN ${runtime}.revision r ON r.document_id=d.id AND r.revision=d.current_revision
  WHERE d.id=ANY($1::uuid[]) AND d.document_type='SALE'
 ), sale_model_history AS MATERIALIZED (
  SELECT ir.document_id,bool_or(ir.original_imported) source_imported,
   bool_or(ir.original_imported AND ir.body#>>'{header,source_payload,legacy_immediate}'='true') legacy_immediate,
   array_agg(DISTINCT ir.body#>>'{header,source_document_id}') FILTER(WHERE ir.original_imported AND ir.body#>>'{header,source_document_id}' IS NOT NULL) source_document_ids
  FROM ${runtime}.revision ir JOIN sale_model_documents chosen ON chosen.id=ir.document_id GROUP BY ir.document_id
 ), sale_model_legacy AS MATERIALIZED (
  SELECT coalesce(array_agg(legacy.id::text),ARRAY[]::text[]) ids FROM ${source}.business_document legacy WHERE legacy.type='RETURN_EXCHANGE'
 ), ${saleSourceScopeSql(runtime,source,true,true,'sale_model_documents',verificationContextSql)}
 SELECT d.*,r.body,r.original_imported,${saleWarehouseOriginSelection(runtime)},
  (coalesce((ARRAY[d.id::text,d.source_identity->>'source_document_id',d.source_identity->>'documentId']||coalesce(history.source_document_ids,ARRAY[]::text[]))&&legacy.ids,false) OR coalesce(history.legacy_immediate,false)) legacy_readonly,
  coalesce(history.source_imported,false) source_imported,
  CASE WHEN creator.actor_id IS NULL THEN NULL::jsonb ELSE jsonb_build_object('id',creator.actor_id,'name',creator_operator.name) END creator,
  ${documentListBasisSql()} model_basis_sha,to_char(d.business_day,'YYYY-MM-DD') model_business_day,d.created_at::text model_created_at,d.updated_at::text model_updated_at,
  r.body#>>'{header,note}' model_note,r.body#>>'{header,source_party_id}' model_customer_id,r.body#>>'{header,source_employee_id}' model_salesperson_id,r.body#>>'{header,business_type}' model_business_type,
  false model_creation_proven,sale_read_scope.source_valid source_read_valid,sale_read_scope.body_sha source_read_body_sha,
  sale_read_scope.source_members source_read_members,CASE WHEN ${saleSourceBound} THEN r.body ELSE NULL::jsonb END source_read_body,
  sale_stats.*,sale_categories.*,CASE WHEN ${numericSql(adjustment)} THEN (${adjustment})::numeric::text END adjustment,
  CASE WHEN ${numericSql(adjustment)} AND sale_stats.gross IS NOT NULL THEN (sale_stats.gross::numeric-(${adjustment})::numeric)::text END due
  FROM sale_model_documents d CROSS JOIN LATERAL (SELECT d.body,d.original_imported,d.current_revision revision) r
  LEFT JOIN sale_model_history history ON history.document_id=d.id CROSS JOIN sale_model_legacy legacy
  LEFT JOIN ${runtime}.revision creator ON creator.document_id=d.id AND creator.revision=1
  LEFT JOIN ${runtime}.operator creator_operator ON creator_operator.id=creator.actor_id
  JOIN sale_scopes sale_read_scope ON sale_read_scope.document_id=d.id
  ${saleStatsSql('r.body')} ${saleCategoriesSql(runtime,source,true)} ORDER BY d.id`;
}
/** Fixed SELECT only: the owner supplies bounded UUID parameters through the
 * original admitted APP/RR read factory. No caller SQL or writable capability. */
export function saleDocumentListReadProjectionSql(runtime:string,source:string):string {
 if(![runtime,source].every(name=>/^"[a-z][a-z0-9_]{0,62}"$/.test(name)))throw new SecurityError('VALIDATION',400,'单据投影读取目标无效');
 return saleListFactsProjectionSql(runtime,source,"current_setting('transaction_read_only')='on' AND current_setting('transaction_isolation') IN ('repeatable read','serializable')");
}

/** Private maintenance projector; ordinary list/detail consumers cannot grant
 * the same-session capability or choose this verification context. */
export async function verifySaleListFacts(session:DataSession,config:DocumentListConfig,ids:readonly string[]):Promise<VerifiedDocumentListFacts[]> {
 const {runtime,source}=config;if(!documentListMaintenanceAllowed(session,runtime,source))throw new SecurityError('FORBIDDEN',403,'单据维护验证范围无效');
 const rows=(await documentListQuery<SaleRow>(session,'SALE_PROJECTION',saleListFactsProjectionSql(runtime,source,documentListMutationSql(session,runtime,source)),[ids,DOCUMENT_LIST_PROJECTOR_SHA])).rows;
 const currentSkus=[...new Set(rows.flatMap(row=>Array.isArray(row['source_read_members'])?(row['source_read_members'] as Record<string,unknown>[]).map(m=>identifier(saleSourceObject(saleSourceObject(m['binding'])['quantityMapping'])['runtimeSkuId'],true)):[]))];
 const currentProducts=new Map<string,string>();
 for(let at=0;at<currentSkus.length;at+=5000){
  const found=(await documentListQuery<{id:string;product_id:string;product_count:string}>(session,'SALE_SKU_IDENTITY',`WITH effective AS(SELECT id,product_id FROM ${source}.variant WHERE id=ANY($1::uuid[]) UNION ALL SELECT id,product_id FROM ${runtime}.variant_overlay WHERE id=ANY($1::uuid[]))
   SELECT e.id::text,e.product_id::text,(SELECT count(*)::text FROM(SELECT id FROM ${source}.product WHERE id=e.product_id UNION ALL SELECT id FROM ${runtime}.product_overlay WHERE id=e.product_id) products) product_count FROM effective e`,[currentSkus.slice(at,at+5000)])).rows;
  for(const product of found){if(currentProducts.has(product.id)||product.product_count!=='1')return saleSourceInvalid();currentProducts.set(product.id,identifier(product.product_id,true));}
 }
 if(currentProducts.size!==currentSkus.length)return saleSourceInvalid();
 return rows.map(row=>{
  const originalBody=row.body;row.body=saleListReadBody(row);if(row['source_read_valid']!==true)throw new SecurityError('CURRENT_SOURCE_READ_INVALID',409,'销货来源身份待核实');
  if(row['source_identity']&&typeof row['source_identity']==='object'&&Object.hasOwn(row['source_identity'],'currentSourceBinding'))row['legacy_readonly']=true;
  const sourceSkus=new Map<string,string>();for(const m of Array.isArray(row['source_read_members'])?row['source_read_members'] as Record<string,unknown>[]:[]){const b=saleSourceObject(m['binding']);sourceSkus.set(String(b['lineId']),String(saleSourceObject(b['quantityMapping'])['runtimeSkuId']));}
  if(row['legacy_readonly']===true&&row['source_identity']&&typeof row['source_identity']==='object'&&Object.hasOwn(row['source_identity'],'currentSourceBinding')){
   const binding=saleSourceObject((row['source_identity'] as Record<string,unknown>)['currentSourceBinding']);
   const metadata={readonly:true,auditAllowed:false,identityKind:'CURRENT_DISPLAY_ONLY',historicalSkuEvidenceClaimed:false,sourceGroupKey:binding['sourceGroupKey'],approvalManifestSha256:binding['approvalManifestSha256'],originalBodySha256:row['source_read_body_sha']};
   row.body=confirmedSaleReadProjection({...row,body:originalBody},row.body,sourceSkus,currentProducts,metadata).body;
   row['auditAllowed']=false;row['read_projection']=metadata;
  }
  row['warehouse_policy']=resolveSaleWarehousePolicy(row);
  const products=(row['model_products'] as Record<string,unknown>[]).map((p):DocumentListProduct=>{
   const currentSku=sourceSkus.get(String(p['source_line_id']));return {key:'line:'+String(p['ordinal']),productId:currentSku?currentProducts.get(currentSku)??saleSourceInvalid():p['product_id']===null?null:identifier(p['product_id'],true),ordinal:Number(p['ordinal']),
   quantity:p['quantity']===null?null:String(p['quantity']),giftQuantity:p['gift']===true?p['quantity']===null?null:String(p['quantity']):'0',unknownCount:p['quantity']===null?1:0,categoryKey:String(p['id']),presentation:{sourceCategoryName:p['name'],gift:p['gift']===true,sourceSkuId:p['sku_id'],currentSkuId:currentSku??null}};});
  return documentListFacts(row,saleSummary(row),scopeFromBody('SALE',row.body).warehouseIds,products);
 });
}
/** Protected native increment receipts are verified independently of the old
 * ROW_OBSERVATION namespace, then use the same confirmed SALE assembly/stats. */
export async function verifyNativeIncrementSaleFacts(session:DataSession,config:DocumentListConfig,id:string,version:number,revision:number,proof:VerifiedNativeIncrementProjection):Promise<VerifiedDocumentListFacts> {
 const {runtime,source}=config;if(!documentListMaintenanceAllowed(session,runtime,source))throw new SecurityError('FORBIDDEN',403,'单据维护验证范围无效');
 const {claimNativeIncrementProjection}=await import('../imports/current-source-body.js'),material=await claimNativeIncrementProjection(proof,session,runtime,source,id,version,revision);
 const raw=material.document;if(raw['document_type']!=='SALE'||raw['original_imported']!==true||raw['id']!==id||raw['version']!==version||raw['current_revision']!==revision)return saleSourceInvalid();
 const original:SaleRow={...raw,id,document_type:'SALE',version,current_revision:revision,original_imported:true,body:saleSourceObject(raw['body']),source_identity:raw['source_identity']};
 const body=saleSourceObject(original.body),header=saleSourceObject(body['header']),lines=body['lines'];
 if(!Array.isArray(lines)||!lines.length||!Array.isArray(body['fundsRecords'])||material.bindings.length!==lines.length)return saleSourceInvalid();
 const originals=new Map<string,Record<string,unknown>>();for(const value of lines){const line=saleSourceObject(value),key=identifier(line['source_line_id']);if(originals.has(key))return saleSourceInvalid();originals.set(key,line);}
 const skusByLine=new Map<string,string>(),warehousesByLine=new Map<string,string>(),endpoints=new Set<string>();
 for(const binding of material.bindings){const lineId=identifier(binding['lineId']),mapping=saleSourceObject(binding['quantityMapping']),line=originals.get(lineId),dimensions=mapping['sourceQuantityKey'];
  if(binding['sourceFamily']!=='SALE'||binding['sourceEndpointId']!==createHash('sha256').update(JSON.stringify([lineId,'SALE'])+'\n').digest('hex')||endpoints.has(String(binding['sourceEndpointId']))||skusByLine.has(lineId)
   ||!line||line['sku_id']!==binding['originalHistoricalSkuId']||saleSourceDigest(line['originalFields'])!==line['originalFieldsSha256']||mapping['currentIdentityPromotedAsHistorical']!==false
   ||!Array.isArray(dimensions)||dimensions.length!==3||line['unit']!==dimensions[2])return saleSourceInvalid();
  const sku=identifier(mapping['runtimeSkuId'],true),warehouse=identifier(mapping['runtimeWarehouseId'],true);
  if(Object.hasOwn(line,'warehouse_id')&&line['warehouse_id']!==warehouse)return saleSourceInvalid();
  skusByLine.set(lineId,sku);warehousesByLine.set(lineId,warehouse);endpoints.add(String(binding['sourceEndpointId']));
 }
 const warehouses=[...new Set(warehousesByLine.values())];if(warehouses.length!==1||skusByLine.size!==originals.size||Object.hasOwn(header,'source_warehouse_id')&&header['source_warehouse_id']!==warehouses[0])return saleSourceInvalid();
 const skus=[...new Set(skusByLine.values())],products=new Map<string,string>();
 for(let at=0;at<skus.length;at+=5000){const entities=(await session.query<{id:string;product_id:string;product_count:string}>(`WITH effective AS(SELECT id,product_id FROM ${source}.variant WHERE id=ANY($1::uuid[]) UNION ALL SELECT id,product_id FROM ${runtime}.variant_overlay WHERE id=ANY($1::uuid[]))
  SELECT e.id::text,e.product_id::text,(SELECT count(*)::text FROM(SELECT id FROM ${source}.product WHERE id=e.product_id UNION ALL SELECT id FROM ${runtime}.product_overlay WHERE id=e.product_id) products) product_count FROM effective e`,[skus.slice(at,at+5000)])).rows;
  for(const entity of entities){if(products.has(entity.id)||entity.product_count!=='1')return saleSourceInvalid();products.set(entity.id,identifier(entity.product_id,true));}}
 if(products.size!==skus.length||skus.some(sku=>!products.has(sku)))return saleSourceInvalid();
 const binding=saleSourceObject(saleSourceObject(original.source_identity)['currentSourceBinding']),metadata={readonly:true,auditAllowed:false,identityKind:'CURRENT_DISPLAY_ONLY',historicalSkuEvidenceClaimed:false,
  sourceGroupKey:binding['sourceGroupKey'],approvalManifestSha256:binding['approvalManifestSha256'],originalBodySha256:material.originalBodySha256,nativeIncrementReceipt:true,originalArchiveRevision:material.originalArchiveRevision,runtimeRevision:material.runtimeRevision};
 const scoped={...body,header:{...header,source_warehouse_id:warehouses[0]},lines:lines.map(value=>{const line=saleSourceObject(value);return {...line,warehouse_id:warehousesByLine.get(identifier(line['source_line_id']))};})},projection=confirmedSaleReadProjection(original,scoped,skusByLine,products,metadata);
 const {approvedImportJsonParts,approvedImportJsonSql}=await import('../../database/document-import-access.js'),adjustment="coalesce(r.body#>>'{header,adjustment}',r.body#>>'{header,source_payload,rounding}','0')";
 const row=(await documentListQuery<SaleRow>(session,'SALE_PROJECTION',`SELECT d.*,r.body,r.original_imported,${saleWarehouseOriginSelection(runtime)},true legacy_readonly,true source_imported,
 CASE WHEN creator.actor_id IS NULL THEN NULL::jsonb ELSE jsonb_build_object('id',creator.actor_id,'name',creator_operator.name) END creator,
 ${documentListBasisSql().replaceAll('r.body','origin.body')} model_basis_sha,to_char(d.business_day,'YYYY-MM-DD') model_business_day,d.created_at::text model_created_at,d.updated_at::text model_updated_at,
 r.body#>>'{header,note}' model_note,r.body#>>'{header,source_party_id}' model_customer_id,r.body#>>'{header,source_employee_id}' model_salesperson_id,r.body#>>'{header,business_type}' model_business_type,
 false model_creation_proven,true source_read_valid,sale_stats.*,sale_categories.*,CASE WHEN ${numericSql(adjustment)} THEN (${adjustment})::numeric::text END adjustment,
 CASE WHEN ${numericSql(adjustment)} AND sale_stats.gross IS NOT NULL THEN (sale_stats.gross::numeric-(${adjustment})::numeric)::text END due
 FROM ${runtime}.document d JOIN ${runtime}.revision origin ON origin.document_id=d.id AND origin.revision=d.current_revision
 CROSS JOIN LATERAL (SELECT ${approvedImportJsonSql(5)} body,origin.original_imported,origin.revision) r
 LEFT JOIN ${runtime}.revision creator ON creator.document_id=d.id AND creator.revision=1 LEFT JOIN ${runtime}.operator creator_operator ON creator_operator.id=creator.actor_id
 ${saleStatsSql('r.body')} ${saleCategoriesSql(runtime,source,true)} WHERE d.id=$1::uuid AND d.version=$3 AND d.current_revision=$4 AND d.document_type='SALE'`,[id,DOCUMENT_LIST_PROJECTOR_SHA,version,revision,approvedImportJsonParts(projection.body)])).rows[0];
 if(!row||row.id!==id||row.version!==version||row.current_revision!==revision)return saleSourceInvalid();
 Object.assign(row,projection);row['source_read_body_sha']=material.originalBodySha256;row['warehouse_policy']=resolveSaleWarehousePolicy(row);
 const contributions=(row['model_products'] as Record<string,unknown>[]).map((p):DocumentListProduct=>({key:'line:'+String(p['ordinal']),productId:p['product_id']===null?null:identifier(p['product_id'],true),ordinal:Number(p['ordinal']),quantity:p['quantity']===null?null:String(p['quantity']),giftQuantity:p['gift']===true?p['quantity']===null?null:String(p['quantity']):'0',unknownCount:p['quantity']===null?1:0,categoryKey:String(p['id']),presentation:{sourceCategoryName:p['name'],gift:p['gift']===true,sourceSkuId:originals.get(String(p['source_line_id']))?.['sku_id']??null,currentSkuId:skusByLine.get(String(p['source_line_id']))??null}}));
 return documentListFacts(row,saleSummary(row),scopeFromBody('SALE',row.body).warehouseIds,contributions);
}
function saleSummary(row:SaleRow):Record<string,unknown>{
 const h=object(row.body['header']),payload=h['source_payload'],facts=payload&&typeof payload==='object'&&!Array.isArray(payload)?payload as Record<string,unknown>:{};
 return {projection:'summary',id:row.id,number:row['number'],document_type:'SALE',status:row['status'],version:row.version,current_revision:row['current_revision'],
 business_day:h['business_date']??facts['date']??null,created_at:row['baseline_was_included']||row['source_imported']?h['created_at']??null:row['created_at'],updated_at:row['updated_at'],legacy_readonly:row['legacy_readonly'],
 storeId:h['hall_id']??null,warehouseId:h['source_warehouse_id']??null,customerId:h['source_party_id']??null,salespersonId:h['source_employee_id']??null,
 businessType:h['business_type']==='RETURN_EXCHANGE'?'退货/换货':'销售',creator:row['creator']??null,
 quantity:row['quantity'],giftQuantity:row['gift_quantity'],incomingQuantity:row['incoming_quantity'],outgoingQuantity:row['outgoing_quantity'],
 gross:row['gross'],adjustment:row['adjustment'],amount:row['due'],categories:row['categories'],categoryCount:row['category_count']};
}

const pageNumber=(v:unknown,fallback:number,max:number):number=>{
  if(v===undefined)return fallback;if(!/^[1-9]\d*$/.test(String(v))||!Number.isSafeInteger(Number(v))||Number(v)>max)return invalid();return Number(v);
};
export async function saleList(context:AuthorizedContext,input:unknown):Promise<Record<string,unknown>> {
  const q=object(input),page=pageNumber(q['page'],1,1000000),size=pageNumber(q['size'],20,200);
  if(Object.keys(q).some(k=>!['type','page','size','filters','storeId','projection','expectedReadVersion'].includes(k)))return invalid();
  if(q['projection']!==undefined&&q['projection']!=='summary')return invalid();
  let filters:Record<string,unknown>={};
  if(q['filters']!==undefined){if(typeof q['filters']!=='string'||q['filters'].length>8192)return invalid();try{filters=object(JSON.parse(q['filters']));}catch{return invalid();}}
  if(Object.keys(filters).some(k=>!['start','end','q','number','exactNumber','warehouseId','storeId','customerId','salespersonId','warehouse','warehouses','store','stores','customer','customers','salesperson','salespeople','status','businessType'].includes(k)))return invalid();
  // Prove the same full matching set in one relation; keep every member and
  // group by document identity before count, warehouse filters and statistics.
  const values:SqlValue[]=[],where=["d.document_type='SALE'"];
  const add=(sql:string,value:SqlValue):void=>{values.push(value);where.push(sql.replace('?',`$${values.length}`));};
  if(context.listScope?.type!=='SALE')return invalid();
  if(context.listScope.storeId)add("r.body->'header'->>'hall_id'=?::text",context.listScope.storeId);
  if(filters['exactNumber']!==undefined){const number=filters['exactNumber'];if(typeof number!=='string'||!number.length||number.length>128)return invalid();add('d.number=?::text',number);}
  for(const k of ['start','end'] as const)if(filters[k]){try{parseBusinessDay(filters[k]);}catch{return invalid();}add(`d.business_day ${k==='start'?'>=':'<='} ?::date`,String(filters[k]));}
  if(filters['start']&&filters['end']&&String(filters['start'])>String(filters['end']))return invalid();
  const search=filters['q']??filters['number'];
  if(search){if(typeof search!=='string'||search.length>128)return invalid();add("position(lower(?) in lower(d.number||' '||coalesce(r.body->'header'->>'note','')))>0",search);}
  const fieldMap:Record<string,string>={warehouseId:'source_warehouse_id',storeId:'hall_id',customerId:'source_party_id',salespersonId:'source_employee_id',warehouse:'source_warehouse_id',warehouses:'source_warehouse_id',store:'hall_id',stores:'hall_id',customer:'source_party_id',customers:'source_party_id',salesperson:'source_employee_id',salespeople:'source_employee_id'};
  for(const [key,field] of Object.entries(fieldMap))if(filters[key]!==undefined){if(!Array.isArray(filters[key])||(filters[key] as unknown[]).length>100)return invalid();const ids=(filters[key] as unknown[]).map(v=>identifier(v));if(ids.length)add(`${field==='source_warehouse_id'?'sale_read_scope.warehouse_id':`r.body->'header'->>'${field}'`}=ANY(?::text[])`,ids);}
  if(filters['status']!==undefined){if(!Array.isArray(filters['status'])||(filters['status'] as unknown[]).length>4)return invalid();
    const map:Record<string,string>={'已审核':'APPROVED','未审核':'UNAUDITED','已作废':'DELETED',APPROVED:'APPROVED',UNAUDITED:'UNAUDITED',DRAFT:'DRAFT',DELETED:'DELETED'};
    const states=(filters['status'] as unknown[]).map(v=>map[String(v)]??invalid());if(states.length)add('d.status=ANY(?::text[])',states);
  }
  if(filters['businessType']!==undefined){const types=filters['businessType'];if(!Array.isArray(types)||types.some(x=>!['销售','退货/换货','SALE','RETURN_EXCHANGE'].includes(String(x))))return invalid();
    if(types.length)add("coalesce(r.body->'header'->>'business_type','SALE')=ANY(?::text[])",types.map(v=>v==='销售'?'SALE':v==='退货/换货'?'RETURN_EXCHANGE':String(v)));
  }
  if(q['projection']!=='summary'&&q['expectedReadVersion']!==undefined)return invalid();
  return readMaintainedDocumentList(context,'SALE',{...(q['projection']==='summary'?{projection:'summary' as const}:{}),page,size,where,values,expectedReadVersion:q['expectedReadVersion']});
}
