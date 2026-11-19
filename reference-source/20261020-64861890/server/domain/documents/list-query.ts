import {DOCUMENT_PAYLOAD_CONTRACT,DOCUMENT_CHUNK_PREFIX,readConfirmedDocument} from './document-read.js';
import type {AuthorizedContext} from '../../security/service.js';
import type {SqlValue} from '../../database/session.js';
import {SecurityError,identifier} from '../../security/errors.js';
import {documentListConfig,documentListNotReady,readDocumentListStamp,type ListType} from './list-model.js';

/** Input is the existing server-validated predicate plan, never caller SQL. */
export interface DocumentListQuery {projection?:'summary';page:number;size:number;where:readonly string[];values:readonly SqlValue[];expectedReadVersion?:unknown}
function translatedWhere(context:AuthorizedContext,type:ListType,input:DocumentListQuery):string[] {
 const result:string[]=[];
 const map:Record<string,string>={hall_id:'s.hall_id::text',source_party_id:'s.customer_id',source_employee_id:'s.salesperson_id',note:'s.note',business_type:'s.business_type'};
 for(let predicate of input.where){
  if(type==='TRANSFER'&&predicate.includes('d.transfer_creator_hall_id=')){
   const hall=predicate.match(/d\.transfer_creator_hall_id=(\$\d+)::uuid/)?.[1];if(!hall)return documentListNotReady('POLICY_PLAN_MISMATCH');
   result.push(`((s.creation_proven AND s.creator_hall_id=${hall}::uuid AND s.creator_role='SALESPERSON') OR ${context.repo.runtime}.warehouse_linked_hall(s.from_warehouse_id::text,${hall}::text) OR ${context.repo.runtime}.warehouse_linked_hall(s.to_warehouse_id::text,${hall}::text))`);continue;
  }
  predicate=predicate.replaceAll('sale_read_scope.warehouse_id','s.warehouse_id::text').replaceAll('transfer_read_scope.from_id','s.from_warehouse_id::text').replaceAll('transfer_read_scope.to_id','s.to_warehouse_id::text');
  for(const [field,value] of Object.entries(map))predicate=predicate.replaceAll(`r.body->'header'->>'${field}'`,value);
  if(predicate.includes('r.body'))return documentListNotReady('FILTER_PLAN_MISMATCH');result.push(predicate);
 }
 return result;
}
const saleCategories=(r:string):string=>`LEFT JOIN LATERAL (
 WITH contributions AS (SELECT coalesce(nullif(original.body->>'canonicalCategoryId',''),p.source_category_key,'__unrecorded') id,
  coalesce(current.body->>'name',p.presentation_basis->>'sourceCategoryName','待确认分类') name,p.first_ordinal,p.quantity,p.unknown_count
  FROM ${r}.document_list_product p
  LEFT JOIN ${r}.product_master_overlay original ON original.kind='categories' AND original.id=p.source_category_key AND NOT original.deleted
  LEFT JOIN ${r}.product_master_overlay current ON current.kind='categories' AND current.id=coalesce(nullif(original.body->>'canonicalCategoryId',''),p.source_category_key) AND NOT current.deleted
  WHERE p.generation_id=s.generation_id AND p.document_id=s.document_id AND left(p.product_key,${DOCUMENT_CHUNK_PREFIX.length})<>'${DOCUMENT_CHUNK_PREFIX}' AND NOT coalesce((p.presentation_basis->>'gift')::bool,false)),
 categories AS (SELECT id,min(name) name,min(first_ordinal) ordinal,CASE WHEN sum(unknown_count)=0 THEN sum(quantity)::text END quantity
  FROM contributions GROUP BY id HAVING sum(quantity)<>0 OR sum(unknown_count)>0)
 SELECT count(*)::int category_count,(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY ordinal,id),'[]'::jsonb) FROM (SELECT * FROM categories ORDER BY ordinal,id LIMIT 3) c) categories FROM categories
) presentation ON true`;
const transferCategories=(r:string):string=>`LEFT JOIN LATERAL (
 SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY first_index,id),'[]'::jsonb) category_counts FROM (
 SELECT coalesce(min(current.id),'__pending') id,coalesce(current.body->>'name','待确认分类') name,
 count(DISTINCT (p.product_id,p.presentation_basis->>'fit'))::int count,min(p.first_ordinal) first_index
 FROM ${r}.document_list_product p
 LEFT JOIN ${r}.product_master_overlay original ON original.kind='categories' AND original.id=p.source_category_key AND NOT original.deleted
 LEFT JOIN ${r}.product_master_overlay current ON current.kind='categories' AND current.id=coalesce(nullif(original.body->>'canonicalCategoryId',''),p.source_category_key) AND NOT current.deleted AND current.body->'standard'='true'::jsonb
 WHERE p.generation_id=s.generation_id AND p.document_id=s.document_id AND left(p.product_key,${DOCUMENT_CHUNK_PREFIX.length})<>'${DOCUMENT_CHUNK_PREFIX}' AND p.quantity>0 GROUP BY coalesce(current.body->>'name','待确认分类')) c
) presentation ON true`;

/** Headers, narrow trusted summary and current policy only. All source/SKU/body
 * verification belongs to same-transaction maintenance, not ordinary list GET. */
export async function readMaintainedDocumentList(context:AuthorizedContext,type:ListType,input:DocumentListQuery):Promise<Record<string,unknown>> {
 const {session,repo,actor}=context,c=documentListConfig(repo),stamp=await readDocumentListStamp(session,c,type,input.expectedReadVersion);
 if(context.listScope?.type!==type)return documentListNotReady('OPERATION_SCOPE_MISMATCH');
 if(actor.role==='SALESPERSON'&&(!actor.storeId||type==='SALE'&&context.listScope.storeId!==actor.storeId))throw new SecurityError('SCOPE',403,'营业厅读取范围无效');
 const where=translatedWhere(context,type,input),values:SqlValue[]=[...input.values];values.push(stamp.generationId);const generation=`$${values.length}`;
 // Dynamic warehouse existence is checked inside the already-authorized
 // matching relation, not by scanning every generation member before policy.
 const order=type==='SALE'||input.projection!=='summary'?'business_day DESC NULLS LAST,created_at DESC,document_id':'updated_at DESC NULLS LAST,number,document_id';
 const limit=`$${values.length+1}`,offset=`$${values.length+2}`;
 const data=(await session.query<{total:string;ids:string[];valid:boolean;scope_valid:boolean;statistics:Record<string,unknown>|null}>(`WITH authorized AS MATERIALIZED (
 SELECT s.document_id,s.business_day,s.created_at,s.updated_at,s.number,s.quantity,s.gross,s.adjustment,
 s.document_version,d.version actual_version,s.revision,d.current_revision actual_revision,s.source_read_valid,s.scope_proven,s.identity_proven,
 s.public_payload->>'contractVersion' contract,
 NOT EXISTS(SELECT 1 FROM ${repo.runtime}.document_list_warehouse w
 LEFT JOIN ${repo.source}.warehouse original ON original.id=w.warehouse_id
 LEFT JOIN ${repo.runtime}.master_data_entity current ON current.kind='warehouses' AND current.id=w.warehouse_id::text
 WHERE w.generation_id=s.generation_id AND w.document_id=s.document_id AND original.id IS NULL AND current.id IS NULL) warehouse_valid FROM ${repo.runtime}.document_list_summary s JOIN ${repo.runtime}.document d ON d.id=s.document_id
 WHERE s.generation_id=${generation}::uuid AND ${where.join(' AND ')}),
 page AS MATERIALIZED (SELECT document_id,row_number() OVER(ORDER BY ${order}) ordinal FROM authorized ORDER BY ${order} LIMIT ${limit} OFFSET ${offset})
 SELECT coalesce(bool_and(warehouse_valid),true) scope_valid,coalesce(bool_and(document_version=actual_version AND revision=actual_revision AND source_read_valid AND scope_proven AND identity_proven AND contract IS NOT DISTINCT FROM '${DOCUMENT_PAYLOAD_CONTRACT}'),true) valid,
 count(*)::text total,coalesce((SELECT jsonb_agg(document_id ORDER BY ordinal) FROM page),'[]'::jsonb) ids,
 ${type==='SALE'?`jsonb_build_object('quantity',CASE WHEN count(quantity)=count(*) THEN coalesce(sum(quantity),0)::text END,
 'gross',CASE WHEN count(gross)=count(*) THEN coalesce(sum(gross),0)::text END,
 'adjustment',CASE WHEN count(adjustment)=count(*) THEN coalesce(sum(adjustment),0)::text END,
 'due',CASE WHEN count(gross)=count(*) AND count(adjustment)=count(*) THEN coalesce(sum(gross-adjustment),0)::text END)`:'NULL::jsonb'} statistics FROM authorized`,[...values,input.size,(input.page-1)*input.size])).rows[0];
 if(data&&data.scope_valid!==true)throw new SecurityError('SCOPE',403,'仓库未获授权或来源未知');
 if(!data||data.valid!==true||!/^\d+$/.test(data.total)||!Array.isArray(data.ids)||data.ids.length>input.size||new Set(data.ids).size!==data.ids.length)return documentListNotReady('INVALID_PAGE_PROOF');
 const total=Number(data.total);if(!Number.isSafeInteger(total))return documentListNotReady('COUNT_OUT_OF_RANGE');
 const pageIds=data.ids.map(id=>identifier(id,true));
 if(input.projection!=='summary'){
  // The legacy default projection is a full DTO, not a summary. Hydrate only
  // the SQL-authorized finite page from durable confirmed business records.
  const items=[];for(const id of pageIds)items.push(await readConfirmedDocument(context,id,type));
  return {items,total,page:input.page,size:input.size,readVersion:stamp.readVersion,readContract:'DOCUMENT_CONFIRMED_BUSINESS_V1'};
 }
 const rows=pageIds.length?(await session.query<Record<string,unknown>>(`SELECT s.document_id,s.customer_id,s.salesperson_id,s.quantity,s.gift_quantity,s.incoming_quantity,s.outgoing_quantity,s.gross,s.adjustment,s.due,s.product_count,
 s.public_payload->'summary' public_payload,
 CASE WHEN s.public_payload#>'{summary,creator}' IS NULL OR s.public_payload#>'{summary,creator}'='null'::jsonb THEN NULL::jsonb
 ELSE jsonb_build_object('id',s.public_payload#>>'{summary,creator,id}','name',o.name) END creator,
 ${type==='SALE'?'presentation.category_count,presentation.categories':'presentation.category_counts'}
 FROM ${repo.runtime}.document_list_summary s
 LEFT JOIN ${repo.runtime}.operator o ON o.id::text=s.public_payload#>>'{summary,creator,id}'
 ${type==='SALE'?saleCategories(repo.runtime):transferCategories(repo.runtime)}
 WHERE s.generation_id=$1::uuid AND s.document_id=ANY($2::uuid[])`,[stamp.generationId,pageIds])).rows:[];
 const byId=new Map(rows.map(row=>[String(row['document_id']),row]));if(rows.length!==pageIds.length||byId.size!==pageIds.length)return documentListNotReady('PAGE_MISSING');
 const items=pageIds.map(id=>{
  const row=byId.get(id)!;const payload={...(row['public_payload'] as Record<string,unknown>)};delete payload['note'];delete payload['_businessType'];
  const text=(key:string):string|null=>row[key]===null?null:String(row[key]);
  return {...payload,creator:row['creator'],...(type==='SALE'?{customerId:text('customer_id'),salespersonId:text('salesperson_id'),quantity:text('quantity'),giftQuantity:text('gift_quantity'),incomingQuantity:text('incoming_quantity'),outgoingQuantity:text('outgoing_quantity'),gross:text('gross'),adjustment:text('adjustment'),amount:text('due'),categories:row['categories'],categoryCount:row['category_count']}:{productCount:row['product_count'],categoryCounts:row['category_counts']})};
 });
 return {projection:'summary',readContract:'DOCUMENT_CONFIRMED_BUSINESS_V1',items,total,page:input.page,size:input.size,readVersion:stamp.readVersion,...(type==='SALE'?{statistics:{scope:'ALL_MATCHED_AUTHORIZED_SALES',documents:total,...data.statistics}}:{})};
}
