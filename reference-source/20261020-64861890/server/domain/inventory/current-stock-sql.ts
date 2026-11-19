import {originalSourceGroupCodeSql} from './sku-display-sql.js';
import {activeFormalBaselineRun,approvedUnlistedZeroPolicy,approvedUnlistedSkuIdentitySql,formalSourceIncrementComponentReady,formalSourceChangesSql,formalSourceReadVersionSql} from './formal-current-baseline.js';
import {assertSingleCurrentBasis} from './current-read-sql.js';
import type {DataSession} from '../../database/session.js';
import type {AuthorizedContext} from '../../security/service.js';
import {SecurityError,identifier} from '../../security/errors.js';
import type {InventoryPageInput} from './page-query.js';
import {readCurrentStockBinding,requireCurrentStockBinding,currentStockReadVersion,currentStockZeroQualificationSql,type StockBinding} from './current-stock.js';
import {inventoryStandardRelationMetadataSql,projectMaintainedPageMetadata,type PageMetadataRaw} from './page-metadata.js';

const failed=():never=>{throw new SecurityError('INVENTORY_READ_FAILED',503,'库存资料暂未就绪，请稍后重试');};
export function currentStockReadSource(g:StockBinding):Record<string,unknown> {
 return {kind:g.binding.kind==='FORMAL'?'APPROVED_FORMAL_CURRENT_BASELINE':g.binding.kind==='NON_FINAL'?'CURRENT_EXPORT_CALIBRATION':g.binding.kind,
 runId:g.binding.runId,dataClass:g.binding.kind==='FORMAL'?'USER_APPROVED_FORMAL_BASELINE':g.binding.kind==='NON_FINAL'?'NON_FINAL':'ORIGINAL_BASIS',
 quantityMethod:'DERIVED_FROM_TARGET_INVENTORY',historicalTimelineCompletenessClaimed:false,
 ...(g.reconciliation?.['unlistedZeroPolicy']?{unlistedZeroPolicy:g.reconciliation['unlistedZeroPolicy']}:{})};
}
/** The same product/filter predicates as V1; only the maintained quantity carrier changes. */
export function currentStockScopeSql(s:string,r:string,rows:string):string {
 const body=(a:string)=>`CASE WHEN jsonb_typeof(${a})='object' THEN ${a} ELSE '{}'::jsonb END`;
 const any=(key:string,column:string)=>`(coalesce(jsonb_array_length($2::jsonb->'${key}'),0)=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text($2::jsonb->'${key}') wanted(value) WHERE wanted.value=${column}))`;
 return `category_rows AS (
 SELECT c.code,coalesce(cm.body->>'parent',parent.code) parent FROM ${s}.category c LEFT JOIN ${s}.category parent ON parent.id=c.parent_id
 LEFT JOIN ${r}.product_master_overlay cm ON cm.kind='categories' AND cm.id=c.code
 UNION SELECT cm.id,cm.body->>'parent' FROM ${r}.product_master_overlay cm WHERE cm.kind='categories' AND NOT cm.deleted
 AND NOT EXISTS(SELECT 1 FROM ${s}.category c WHERE c.code=cm.id)
 ), category_scope(code) AS (
 SELECT value FROM jsonb_array_elements_text($2::jsonb->'categories') UNION SELECT c.code FROM category_rows c JOIN category_scope p ON c.parent=p.code
 ), product_meta AS MATERIALIZED (
 SELECT p.id::text id,p.code,p.name,c.code category_code,p.counterparty_id::text supplier_id,
 ${body('ps.source_payload')}||${body('pp.body')} body
 FROM ${s}.product p LEFT JOIN ${s}.category c ON c.id=p.category_id LEFT JOIN ${r}.product_profile_overlay pp ON pp.product_id=p.id
 LEFT JOIN LATERAL(SELECT source_payload FROM ${s}.tplus_product_source ps WHERE ps.product_id=p.id
 AND ps.batch_id=(SELECT batch_id FROM ${s}.tplus_import_run WHERE status='COMMITTED' ORDER BY committed_at DESC NULLS LAST,started_at DESC LIMIT 1)) ps ON true
 UNION ALL SELECT p.id::text,p.code,coalesce(pp.body->>'name',p.body->>'name',p.code),p.body->>'categoryId',p.body->>'supplierId',${body('p.body')}||${body('pp.body')}
 FROM ${r}.product_overlay p LEFT JOIN ${r}.product_profile_overlay pp ON pp.product_id=p.id WHERE NOT EXISTS(SELECT 1 FROM ${s}.product old WHERE old.id=p.id)
 ), candidate_matches AS MATERIALIZED (
 SELECT c.* FROM ${rows} c LEFT JOIN product_meta meta ON meta.id=c.product_id::text WHERE c.generation_id=$1::uuid
 AND ${any('warehouses','c.warehouse_id::text')} 
 AND (NOT ($2::jsonb->>'nonzero')::boolean OR ${rows.endsWith('inventory_stock_standard_cell')?'c.nonzero_count>0':'c.quantity<>0'})
 AND ((coalesce(jsonb_array_length($2::jsonb->'products'),0)+coalesce(jsonb_array_length($2::jsonb->'codes'),0))=0
 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text($2::jsonb->'products') x WHERE x=c.product_id::text)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text($2::jsonb->'codes') x WHERE x=c.product_code))
 AND (coalesce(jsonb_array_length($2::jsonb->'categories'),0)=0 OR coalesce(nullif(meta.body->>'categoryId',''),meta.category_code) IN(SELECT code FROM category_scope))
 AND ${any('supplierId',"coalesce(nullif(meta.body->>'supplierId',''),meta.supplier_id)")}
 AND (coalesce(jsonb_array_length($2::jsonb->'fitId'),0)=0 OR EXISTS(SELECT 1 FROM ${r}.inventory_stock_relation v
 WHERE v.generation_id=c.generation_id AND v.product_id=c.product_id AND ${any('fitId','v.fit_id')}))
 AND (coalesce(jsonb_array_length($2::jsonb->'seasons'),0)=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text($2::jsonb->'seasons') wanted(value)
 WHERE CASE WHEN jsonb_typeof(meta.body->'seasons')='array' THEN (meta.body->'seasons') ? wanted.value ELSE position(wanted.value in coalesce(meta.body->>'season',''))>0 END))
 AND ($2::jsonb->>'q'='' OR position(lower($2::jsonb->>'q') in lower(coalesce(meta.code,c.product_code,'')||' '||coalesce(meta.body->>'name',meta.name,'')||' '||coalesce(meta.body->>'barcodeItemCode','')))>0
 OR c.product_id IS NULL AND position(lower($2::jsonb->>'q') in lower(c.display_search))>0)
 ), occupied_coordinates AS MATERIALIZED (
 SELECT c.product_key,c.product_id,c.warehouse_id,c.color_id,bool_or(${rows.endsWith('inventory_stock_standard_cell')?'c.nonzero_count>0':'c.quantity<>0'}) has_stock
 FROM candidate_matches c GROUP BY c.product_key,c.product_id,c.warehouse_id,c.color_id
 ), quantity_issues AS MATERIALIZED (
 SELECT c.*,domain.sku_id,
 CASE WHEN v.sku_id IS NULL THEN 'STOCK_RELATION_MISSING'
 WHEN v.zero_eligible THEN 'WAREHOUSE_ZERO_NOT_ADMITTED' ELSE coalesce(domain.inventory_zero_status,'SKU_ZERO_NOT_ADMITTED') END reason
 FROM occupied_coordinates c JOIN ${r}.standard_sku_relation domain ON domain.product_id=c.product_id
 AND domain.options #>> '{COLOR,id}'=c.color_id
 LEFT JOIN ${r}.inventory_stock_relation v ON v.generation_id=$1::uuid AND v.sku_id=domain.sku_id
 WHERE NOT ($2::jsonb->>'nonzero')::boolean
 AND NOT EXISTS(SELECT 1 FROM ${r}.inventory_stock_member actual WHERE actual.generation_id=$1::uuid
 AND actual.warehouse_id=c.warehouse_id AND actual.sku_id=domain.sku_id)
 AND NOT ${currentStockZeroQualificationSql(r,'v','c.warehouse_id',s)}
 ), issue_coordinates AS MATERIALIZED (SELECT DISTINCT product_key,warehouse_id,color_id FROM quantity_issues),
 visible_coordinates AS MATERIALIZED (
 SELECT c.* FROM occupied_coordinates c LEFT JOIN issue_coordinates issue ON issue.product_key=c.product_key
 AND issue.warehouse_id=c.warehouse_id AND issue.color_id=c.color_id
 WHERE c.product_id IS NULL OR c.color_id IS NULL OR c.has_stock OR issue.product_key IS NOT NULL
 ), matches AS MATERIALIZED (SELECT c.* FROM candidate_matches c JOIN visible_coordinates v ON v.product_key=c.product_key
 AND v.warehouse_id=c.warehouse_id AND v.color_id IS NOT DISTINCT FROM c.color_id)`;
}
function memberDto(a:string,g:StockBinding,r:string):string {
 const src=currentStockReadSource(g);
 return `jsonb_build_object('warehouseId',${a}.warehouse_id,'skuId',${a}.sku_id,'quantity',${a}.quantity::text,
 'warehouseCode',${a}.basis_ref #>> '{binding,sourceQuantityKey,0}','warehouseName',${a}.basis_ref #>> '{binding,display,warehouseName}',
 'productId',${a}.product_id,'productCode',${a}.product_code,'productName',${a}.basis_ref #>> '{binding,display,productName}',
 'original',coalesce(${a}.basis_ref #> '{binding,display,original}',jsonb_build_object('color',v.options->'COLOR','size',v.options->'SIZE',
 'fit',jsonb_build_object('id',v.fit_id,'name',v.fit_id||'版'))),'sourceQuantityKey',${a}.basis_ref #> '{binding,sourceQuantityKey}',
 'unitConflict',false,'identityKind',${a}.basis_ref #>> '{binding,identityKind}','sourceMissing',coalesce((${a}.basis_ref #>> '{basis,sourceMissing}')::boolean,false),
 'basis',coalesce(${a}.basis_ref->'basis','{}'::jsonb)||jsonb_build_object('kind','${src['kind']}','runId','${g.binding.runId.replaceAll("'","''")}',
 'difference','0.0000','reconciled',true),'quantityMethod','DERIVED_FROM_TARGET_INVENTORY','historicalTimelineCompletenessClaimed',false,
 'dataClass','${src['dataClass']}','standard',jsonb_build_object('group',v.standard_group,'fit',v.standard_fit,'size',v.standard_size,'code',v.standard_code,
 'mappingStatus',v.mapping_status,'mappingRevision',v.mapping_revision,'packSha256',v.mapping_sha256,
 'registeredCodeEmpty',v.standard_code='' AND EXISTS(SELECT 1 FROM ${r}.standard_sku_relation registered WHERE registered.sku_id=v.sku_id AND registered.standard_group_id IS NOT NULL AND registered.standard_size_id IS NOT NULL AND registered.mapping_status IN('CONFIRMED_SOURCE','CONFIRMED_RUNTIME','CONFIRMED_AUTHORITY'))))`;
}
async function metadata(context:AuthorizedContext,g:StockBinding,data:Record<string,unknown>):Promise<Record<string,unknown>> {
 const products=data['productIds'] as string[],skus=(data['skuIds']??[]) as string[];let raw:PageMetadataRaw|undefined;
 for(let offset=0;offset<Math.max(1,skus.length);offset+=5000){
  const part=(await context.session.query<{data:PageMetadataRaw}>(inventoryStandardRelationMetadataSql(context.repo.source,context.repo.runtime),
  [products,skus.slice(offset,offset+5000)])).rows[0]?.data;
  if(!part)return failed();
  if(typeof part.catalogVersion!=='string'||!Array.isArray(part.products)||!Array.isArray(part.skus)||raw&&raw.catalogVersion!==part.catalogVersion)return failed();
  if(!raw)raw=part;else{raw.products.push(...part.products);raw.skus.push(...part.skus);}
 }
 if(!raw||raw.catalogVersion!==g.catalog_version)return failed();
 return {...data,...projectMaintainedPageMetadata(raw,products,skus),capabilities:{
 pageProductMetadata:'INVENTORY_PAGE_PRODUCT_METADATA_V1',pageSkuMetadata:'CURRENT_PAGE_DISPLAY_ONLY',completeProductDetails:false,
 ...(data['contractVersion']==='INVENTORY_UNIT_FREE_SUMMARY_V1'?{members:'ON_DEMAND'}:{})}};
}
/** A compact proof covers only missing original contributions in occupied display coordinates.
 * Actual member counts/references stay unchanged; no balance or ledger member is invented. */
export function knownEmptyPageCoverageSql(s:string,r:string,g:StockBinding,input:InventoryPageInput):string {
 if(input.view!=='standard'||input.filters.nonzero||!input.filters.warehouses.length
 ||g.binding.kind!=='FORMAL'||!g.binding.activated||!g.enabled||g.state!=='READY')return '';
 return `coverage_products AS (SELECT DISTINCT product_id FROM page_cells WHERE product_id IS NOT NULL),
 coverage_coordinates AS (SELECT c.* FROM visible_coordinates c JOIN coverage_products p USING(product_id)),
 coverage_members AS MATERIALIZED (
 SELECT c.product_id,c.warehouse_id,c.color_id,v.sku_id,v.standard_group,v.standard_fit,v.standard_code,v.standard_size,v.source_fingerprint,
 m.sku_id IS NOT NULL present,${currentStockZeroQualificationSql(r,'v','c.warehouse_id',s)} qualified_zero
 FROM coverage_coordinates c JOIN ${r}.inventory_stock_relation v ON v.generation_id=$1::uuid AND v.product_id=c.product_id
 AND v.options #>> '{COLOR,id}'=c.color_id
 JOIN ${r}.standard_sku_relation registered ON registered.sku_id=v.sku_id
 LEFT JOIN ${r}.inventory_stock_member m ON m.generation_id=v.generation_id AND m.sku_id=v.sku_id AND m.warehouse_id=c.warehouse_id
 WHERE v.mapping_status IN('CONFIRMED_SOURCE','CONFIRMED_RUNTIME','CONFIRMED_AUTHORITY')
 AND v.standard_group IS NOT NULL AND v.standard_fit IS NOT NULL AND v.standard_code IS NOT NULL AND v.standard_size IS NOT NULL
 AND (v.standard_code<>'' OR registered.standard_group_id IS NOT NULL AND registered.standard_size_id IS NOT NULL)
 ), coverage_domains AS (
 SELECT product_id,warehouse_id,color_id,standard_group,standard_fit,standard_code,standard_size,'EXACT'::text fit_scope,
 count(*)::integer identity_count,count(*) FILTER(WHERE present)::integer balance_count,
 count(*) FILTER(WHERE NOT present AND qualified_zero)::integer zero_count,
 count(*) FILTER(WHERE NOT present AND NOT qualified_zero)::integer missing_count,
 encode(sha256(convert_to(string_agg(jsonb_build_array(sku_id,source_fingerprint)::text,'|' ORDER BY sku_id),'UTF8')),'hex') identity_fingerprint
 FROM coverage_members GROUP BY product_id,warehouse_id,color_id,standard_group,standard_fit,standard_code,standard_size
 UNION ALL SELECT product_id,warehouse_id,color_id,standard_group,'*',standard_code,standard_size,'ALL',
 count(*)::integer,count(*) FILTER(WHERE present)::integer,count(*) FILTER(WHERE NOT present AND qualified_zero)::integer,
 count(*) FILTER(WHERE NOT present AND NOT qualified_zero)::integer,
 encode(sha256(convert_to(string_agg(jsonb_build_array(sku_id,source_fingerprint)::text,'|' ORDER BY sku_id),'UTF8')),'hex')
 FROM coverage_members GROUP BY product_id,warehouse_id,color_id,standard_group,standard_code,standard_size
 ), coverage_by_product AS (
 SELECT product_id,jsonb_build_object('contractVersion','INVENTORY_MAINTAINED_ZERO_COVERAGE_V2','generationId',$1::text,
 'readVersion',$7::text,'runId',$6::jsonb->>'runId','basisKind','FORMAL','activated',true,'state','READY','completeIdentityDomain',true,
 'page',$4::integer/$3::integer+1,'size',$3::integer,'requestedWarehouseIds',$2::jsonb->'warehouses',
 'cells',jsonb_agg(jsonb_build_object('productId',product_id,'warehouseId',warehouse_id,'colorId',color_id,
 'standard',jsonb_build_object('group',standard_group,'fit',standard_fit,'code',standard_code,'size',standard_size,'registeredCodeEmpty',standard_code=''),'fitScope',fit_scope,
 'identityCount',identity_count,'identityFingerprint',identity_fingerprint,'balanceRowCount',balance_count,
 'approvedUnlistedZeroCount',zero_count,'quantity','0') ORDER BY warehouse_id,color_id,standard_group,standard_fit,standard_code,standard_size)) proof
 FROM coverage_domains WHERE missing_count=0 AND zero_count>0 AND identity_count=balance_count+zero_count GROUP BY product_id
 )`;
}
export async function queryCurrentStockPage(context:AuthorizedContext,input:InventoryPageInput,g:StockBinding):Promise<Record<string,unknown>> {
 const {session,repo}=context,r=repo.runtime,s=repo.source,summary=input.projection==='summary'&&input.view==='standard';
 // Preserve the existing page route's current-basis admission.
 if(g.binding.kind!=='FORMAL'&&g.binding.kind!=='NON_FINAL')throw new SecurityError('INVENTORY_SUMMARY_CURRENT_BASIS_REQUIRED',409,'当前库存基准尚未核实');
 const rows=r+(summary?'.inventory_stock_standard_cell':'.inventory_stock_member');
 const count=summary?"CASE WHEN ($2::jsonb->>'nonzero')::boolean THEN nonzero_count ELSE member_count END":'1';
 const neg=summary?'negative_count':'CASE WHEN quantity<0 THEN 1 ELSE 0 END';
 const unk=summary?'CASE WHEN unmapped_sku_id IS NOT NULL THEN member_count ELSE 0 END':'CASE WHEN product_id IS NULL THEN 1 ELSE 0 END';
 const dto=summary?`jsonb_build_object('cellKey',cell_key,'generationId',$1::text,'warehouseId',warehouse_id,'productId',product_id,'colorId',color_id,
 'colorName',color_name,'colorCode',color_code,'standard',jsonb_build_object('group',standard_group,'fit',standard_fit,'code',standard_code,'size',standard_size,
 'registeredCodeEmpty',standard_code='' AND EXISTS(SELECT 1 FROM ${r}.standard_sku_relation registered WHERE registered.product_id=result_rows.product_id
 AND registered.options #>> '{COLOR,id}'=result_rows.color_id AND registered.standard_group=result_rows.standard_group AND registered.standard_fit=result_rows.standard_fit
 AND registered.standard_code='' AND registered.standard_size=result_rows.standard_size AND registered.standard_group_id IS NOT NULL AND registered.standard_size_id IS NOT NULL
 AND registered.mapping_status IN('CONFIRMED_SOURCE','CONFIRMED_RUNTIME','CONFIRMED_AUTHORITY'))),
 'unmappedSkuId',unmapped_sku_id,'quantity',quantity::text,'memberCount',member_count,'nonzeroCount',nonzero_count,'negativeCount',negative_count,
 'mappingStatus',mapping_status,'original',original)`:memberDto('c',g,r);
 const results=summary?`result_rows AS (
 SELECT cell_key,warehouse_id,product_id,color_id,product_key,min(product_code) product_code,
 standard_group,standard_fit,standard_code,standard_size,unmapped_sku_id,sum(quantity) quantity,sum(${count}) member_count,sum(nonzero_count) nonzero_count,
 sum(negative_count) negative_count,sum(${unk}) unmapped_member_count,
 coalesce(cm.body->>'name',sv.name) color_name,coalesce(sv.code,cm.body->>'code') color_code,
 coalesce((SELECT v.mapping_status FROM ${r}.inventory_stock_relation v WHERE v.generation_id=$1::uuid AND v.sku_id=unmapped_sku_id),
 CASE WHEN unmapped_sku_id IS NULL THEN 'CONFIRMED' ELSE 'UNMAPPED' END) mapping_status,
 (SELECT jsonb_build_object('color',v.options->'COLOR','size',v.options->'SIZE','fit',jsonb_build_object('id',v.fit_id,'name',v.fit_id||'版'))
 FROM ${r}.inventory_stock_relation v WHERE v.generation_id=$1::uuid AND v.sku_id=unmapped_sku_id) original
 FROM page_cells LEFT JOIN ${s}.spec_value sv ON sv.id::text=color_id LEFT JOIN ${r}.product_master_overlay cm ON cm.kind='colors' AND cm.id=color_id
 GROUP BY cell_key,warehouse_id,product_id,color_id,product_key,standard_group,standard_fit,standard_code,standard_size,unmapped_sku_id,cm.body,sv.name,sv.code
 ), output_rows AS (SELECT ${dto} item FROM result_rows)`:input.view==='standard'?`standard_rows AS (
 SELECT c.cell_key,c.warehouse_id,c.product_id,c.color_id,c.cell_tuple,sum(c.quantity) quantity,jsonb_agg(${dto} ORDER BY c.sku_id) members
 FROM page_cells c JOIN ${r}.inventory_stock_relation v ON v.generation_id=c.generation_id AND v.sku_id=c.sku_id
 GROUP BY c.cell_key,c.warehouse_id,c.product_id,c.color_id,c.cell_tuple
 ), output_rows AS (SELECT jsonb_build_object('warehouseId',warehouse_id,'productId',product_id,'colorId',color_id,
 'standard',jsonb_build_object('group',cell_tuple->>3,'fit',cell_tuple->>4,'code',cell_tuple->>5,'size',cell_tuple->>6),
 'unmappedSkuId',cell_tuple->>7,'quantity',quantity::text,'members',members) item FROM standard_rows)`:
 `output_rows AS (SELECT ${dto} item FROM page_cells c JOIN ${r}.inventory_stock_relation v ON v.generation_id=c.generation_id AND v.sku_id=c.sku_id)`;
 const totalSql=(scope:string)=>`SELECT coalesce(sum(quantity),0)::text FROM ${scope}`;
 const coverage=knownEmptyPageCoverageSql(s,r,g,input);
 const coveredOutput=coverage?", covered_output_rows AS (SELECT item,row_number() OVER(PARTITION BY item->>'productId' ORDER BY item->>'warehouseId',item->>'cellKey',item->>'skuId') coverage_anchor FROM output_rows)":'';
 const outputItem=coverage?"item||CASE WHEN coverage_anchor=1 THEN coalesce((SELECT jsonb_build_object('knownEmptyCoverage',coverage.proof) FROM coverage_by_product coverage WHERE coverage.product_id::text=item->>'productId'),'{}'::jsonb) ELSE '{}'::jsonb END":'item';
 const sql=`WITH RECURSIVE ${currentStockScopeSql(s,r,rows)},
 product_keys AS (SELECT product_key,min(product_code) code FROM matches GROUP BY product_key),
 page_keys AS (SELECT * FROM product_keys ORDER BY code NULLS LAST,product_key LIMIT $3 OFFSET $4),
 page_cells AS MATERIALIZED (SELECT c.* FROM matches c JOIN page_keys k USING(product_key)),
 ${results}${coverage?','+coverage:''}${coveredOutput}
 SELECT jsonb_build_object('contractVersion','${summary?'INVENTORY_UNIT_FREE_SUMMARY_V1':'INVENTORY_UNIT_FREE_PAGE_V1'}','view',$5::text,
 'items',coalesce((SELECT jsonb_agg(${outputItem} ORDER BY item->>'warehouseId',item->>'productId',item->>'cellKey',item->>'skuId') FROM ${coverage?'covered_output_rows':'output_rows'}),'[]'::jsonb),
 'total',(SELECT count(*) FROM product_keys),'page',$4::integer/$3::integer+1,'size',$3::integer,
 'originalCellCount',coalesce((SELECT sum(${count}) FROM matches),0),'negativeCellCount',coalesce((SELECT sum(${neg}) FROM matches),0),
 'unknownCellCount',coalesce((SELECT sum(${unk}) FROM matches),0),
 'quantityCompleteness',CASE WHEN EXISTS(SELECT 1 FROM quantity_issues) THEN 'INCOMPLETE' ELSE 'COMPLETE' END,
 'missingQuantityCount',(SELECT count(*) FROM quantity_issues),
 'quantityIssues',coalesce((SELECT jsonb_agg(jsonb_build_object('productId',q.product_id,'warehouseId',q.warehouse_id,'colorId',q.color_id,'skuId',q.sku_id,'reason',q.reason)
 ORDER BY q.product_id,q.warehouse_id,q.sku_id) FROM quantity_issues q JOIN page_keys k USING(product_key)),'[]'::jsonb),
 'visibleCoordinates',coalesce((SELECT jsonb_agg(jsonb_build_object('productId',product_id,'warehouseId',warehouse_id,'colorId',color_id) ORDER BY product_id,warehouse_id,color_id)
 FROM visible_coordinates c JOIN page_keys k USING(product_key)),'[]'::jsonb),
 'productIds',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM(SELECT DISTINCT product_id id FROM page_cells WHERE product_id IS NOT NULL) ids),'[]'::jsonb),
 ${summary?'':"'skuIds',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM(SELECT DISTINCT sku_id id FROM page_cells) ids),'[]'::jsonb),"}
 'quantityScope','${input.filters.nonzero?'KNOWN_NONZERO_ORIGINAL_CELLS':'COMPLETE_ORIGINAL_SKU_DOMAIN'}',
 'quantityTotal',(${totalSql('matches')}),'pageQuantityTotal',(${totalSql('page_cells')}),
 'source',$6::jsonb,'readVersion',$7::text,'generationId',$1::text,'reconciled',true,
 'quantityMethod','DERIVED_FROM_TARGET_INVENTORY','dataClass',$8::text,'historicalTimelineCompletenessClaimed',false) data`;
 const source=currentStockReadSource(g),data=(await session.query<{data:Record<string,unknown>}>(sql,
 [g.id,JSON.stringify(input.filters),input.size,(input.page-1)*input.size,input.view,JSON.stringify(source),currentStockReadVersion(g),String(source['dataClass'])])).rows[0]?.data??failed();
 return metadata(context,g,data);
}
export async function queryCurrentStockMembers(context:AuthorizedContext,input:InventoryPageInput,g:StockBinding):Promise<Record<string,unknown>> {
 if(input.expectedReadVersion!==currentStockReadVersion(g))throw new SecurityError('REVISION',409,'库存在读取期间更新，请重新查询');
 const {session,repo}=context,r=repo.runtime,offset=((input.memberPage??1)-1)*(input.memberSize??100),size=input.memberSize??100;
 const sql=`WITH RECURSIVE ${currentStockScopeSql(repo.source,repo.runtime,repo.runtime+'.inventory_stock_member')},
 cell AS MATERIALIZED (SELECT * FROM matches WHERE cell_key=$3),
 selected AS (SELECT * FROM cell ORDER BY sku_id LIMIT $4 OFFSET $5)
 SELECT jsonb_build_object('contractVersion','INVENTORY_UNIT_FREE_MEMBERS_V1','cellKey',$3::text,
 'items',coalesce((SELECT jsonb_agg(${memberDto('c',g,r)} ORDER BY c.sku_id) FROM selected c JOIN ${repo.runtime}.inventory_stock_relation v
 ON v.generation_id=c.generation_id AND v.sku_id=c.sku_id),'[]'::jsonb),
 'total',(SELECT count(*) FROM cell),'quantity',coalesce((SELECT sum(quantity)::text FROM cell),'0.0000'),
 'productIds',coalesce((SELECT jsonb_agg(id) FROM(SELECT DISTINCT product_id id FROM selected WHERE product_id IS NOT NULL) p),'[]'::jsonb),
 'skuIds',coalesce((SELECT jsonb_agg(sku_id ORDER BY sku_id) FROM selected),'[]'::jsonb),
 'page',$5::integer/$4::integer+1,'size',$4::integer,'readVersion',$6::text,'source',$7::jsonb) data`;
 const data=(await session.query<{data:Record<string,unknown>}>(sql,[g.id,JSON.stringify(input.filters),input.cellKey??'',size,offset,currentStockReadVersion(g),JSON.stringify(currentStockReadSource(g))])).rows[0]?.data??failed();
 if(data['total']===0)throw new SecurityError('NOT_FOUND',404,'库存明细不存在或不在当前范围');
 return metadata(context,g,data);
}
export interface CurrentStockBalance {warehouseId:string;skuId:string;quantity:string}
/** Optional probe is retained for controlled writer/preparation calls, never a normal route fallback. */
export async function readCurrentStockBalances(session:DataSession,r:string,s?:string,warehouses:readonly string[]=[],skus:readonly string[]=[],basisKind?:string):Promise<CurrentStockBalance[]|null> {
 return currentStockBalances(session,r,s,warehouses,skus,basisKind,false);
}
/** Ordinary reads require the initialized maintained carrier before any quantity SQL. */
export async function requireCurrentStockBalances(session:DataSession,r:string,s?:string,warehouses:readonly string[]=[],skus:readonly string[]=[],basisKind?:string):Promise<CurrentStockBalance[]> {
 return await currentStockBalances(session,r,s,warehouses,skus,basisKind,true)??failed();
}
async function currentStockBalances(session:DataSession,r:string,s:string|undefined,warehouses:readonly string[],skus:readonly string[],basisKind:string|undefined,required:boolean):Promise<CurrentStockBalance[]|null> {
 const g=required?await requireCurrentStockBinding(session,r,s):await readCurrentStockBinding(session,r,s);
 if(!g||g.binding.kind==='NON_FINAL'||basisKind&&g.binding.kind!==basisKind)return required?failed():null;
 return (await session.query<CurrentStockBalance>(`SELECT warehouse_id "warehouseId",sku_id "skuId",quantity::text
 FROM ${r}.inventory_stock_member WHERE generation_id=$1::uuid AND (cardinality($2::uuid[])=0 OR warehouse_id=ANY($2::uuid[]))
 AND (cardinality($3::uuid[])=0 OR sku_id=ANY($3::uuid[]))
 ${warehouses.length&&skus.length?`UNION ALL SELECT wanted.warehouse_id "warehouseId",v.sku_id "skuId",'0.0000'::text quantity
 FROM unnest($2::uuid[]) wanted(warehouse_id) JOIN ${r}.inventory_stock_relation v ON v.generation_id=$1::uuid AND v.sku_id=ANY($3::uuid[])
 WHERE ${currentStockZeroQualificationSql(r,'v','wanted.warehouse_id',g.binding.sourceSchema)}
 AND NOT EXISTS(SELECT 1 FROM ${r}.inventory_stock_member m WHERE m.generation_id=v.generation_id AND m.warehouse_id=wanted.warehouse_id AND m.sku_id=v.sku_id)`:''}
 ORDER BY "warehouseId","skuId"`,[g.id,warehouses,skus])).rows;
}
export async function readCurrentStockSummaries(context:AuthorizedContext,kind:'occupancy'|'products'):Promise<Record<string,unknown>|null> {
 const {session,repo}=context,g=await requireCurrentStockBinding(session,repo.runtime,repo.source);
 if(kind==='products'&&g.binding.kind!=='FORMAL')return failed();
 if(kind==='occupancy'&&g.binding.kind!=='FORMAL'&&g.binding.kind!=='NON_FINAL')return failed();
 if(kind==='occupancy'){
  const items=(await session.query<{warehouseId:string;occupiedCellCount:number}>(`SELECT warehouse_id "warehouseId",count(*)::integer "occupiedCellCount"
 FROM ${repo.runtime}.inventory_stock_member WHERE generation_id=$1::uuid AND quantity<>0 GROUP BY warehouse_id ORDER BY warehouse_id`,[g.id])).rows;
  return {contractVersion:'WAREHOUSE_OCCUPANCY_V1',items,byWarehouse:Object.fromEntries(items.map(row=>[row.warehouseId,row.occupiedCellCount])),source:currentStockReadSource(g)};
 }
 // This legacy numeric-only contract cannot represent a partial product total.
 // Reject a true gap rather than publishing a known subtotal as the complete quantity.
 const missing=(await session.query<{productId:string;warehouseId:string;skuId:string}>(`WITH warehouses AS (
 SELECT id FROM ${repo.source}.warehouse UNION SELECT id::uuid FROM ${repo.runtime}.master_data_entity
 WHERE kind='warehouses' AND id ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$')
 SELECT domain.product_id "productId",w.id "warehouseId",domain.sku_id "skuId"
 FROM ${repo.runtime}.standard_sku_relation domain LEFT JOIN ${repo.runtime}.product_overlay product ON product.id=domain.product_id
 CROSS JOIN warehouses w LEFT JOIN ${repo.runtime}.inventory_stock_relation v ON v.generation_id=$1::uuid AND v.sku_id=domain.sku_id
 LEFT JOIN ${repo.runtime}.inventory_stock_member m ON m.generation_id=$1::uuid AND m.warehouse_id=w.id AND m.sku_id=domain.sku_id
 WHERE NOT coalesce(product.deleted,false) AND m.sku_id IS NULL
 AND NOT ${currentStockZeroQualificationSql(repo.runtime,'v','w.id',repo.source)}
 ORDER BY domain.product_id,w.id,domain.sku_id LIMIT 20`,[g.id])).rows;
 if(missing.length)throw new SecurityError('INVENTORY_READ_FAILED',503,'部分原规格缺少可靠数量',{reason:'ORIGINAL_STOCK_COVERAGE_INCOMPLETE',originalKeys:missing});
 const items=(await session.query<{product_id:string;quantity:string}>(`SELECT v.product_id,sum(m.quantity)::text quantity
 FROM ${repo.runtime}.inventory_stock_member m JOIN ${repo.runtime}.inventory_stock_relation v ON v.generation_id=m.generation_id AND v.sku_id=m.sku_id
 JOIN (SELECT p.id FROM ${repo.source}.product p LEFT JOIN ${repo.runtime}.product_overlay po ON po.id=p.id WHERE NOT coalesce(po.deleted,false)
 UNION ALL SELECT id FROM ${repo.runtime}.product_overlay po WHERE NOT po.deleted AND NOT EXISTS(SELECT 1 FROM ${repo.source}.product p WHERE p.id=po.id)) p ON p.id=v.product_id
 WHERE m.generation_id=$1::uuid GROUP BY v.product_id ORDER BY v.product_id`,[g.id])).rows;
 return {items,source:currentStockReadSource(g)};
}

export type ProductPageStockUnknownReason='STOCK_LAYER_UNAVAILABLE'|'STOCK_LAYER_NOT_READY'|'BASIS_NOT_FINAL'|'RECONCILIATION_NOT_PROVEN'
 |'NO_RESOLVED_SKUS'|'NO_WAREHOUSE_SCOPE'|'SKU_IDENTITY_UNRESOLVED'|'STOCK_COVERAGE_INCOMPLETE'|'UNKNOWN_WAREHOUSE_IDENTITY'
 |'INVALID_STOCK_SUMMARY';
export interface ProductPageStockItem {
 product_id:string;quantity:string|null;status:'KNOWN'|'UNKNOWN';unknownReason:ProductPageStockUnknownReason|null;
 coverage:{skuCount:number;warehouseCount:number;cellCount:number;missingCellCount:number}|null;
}
export interface ProductPageStockSummary {
 contractVersion:'PRODUCT_PAGE_STOCK_SUMMARY_V1';productIds:readonly string[];
 scope:'ALL_INVENTORY_WAREHOUSES';readVersion:string|null;generationId:string|null;changeSeq:string|null;
 source:Record<string,unknown>|null;items:ProductPageStockItem[];
}
interface ProductStockPageRow {
 product_id:string;quantity:string|null;sku_count:number;warehouse_count:number;cell_count:number;missing_count:number;
 unresolved_count:number;extra_count:number;
}
const stockUnavailableError=(error:unknown):boolean=>error instanceof SecurityError&&['INVENTORY_READ_FAILED','REVISION'].includes(error.code);
function productPageStockQuantity(value:unknown):string|null {
 if(typeof value!=='string'||! /^-?\d+(?:\.\d{1,4}0*)?$/.test(value))return null;
 // Numeric text can retain redundant zero scale. Remove only excess zeroes;
 // every nonzero digit and the exact value remain intact for the existing 4-place reader.
 return value.replace(/(\.\d{4})0+$/,'$1');
}
function productStockPageItem(row:ProductStockPageRow):ProductPageStockItem {
 const counts=[row.sku_count,row.warehouse_count,row.cell_count,row.missing_count,row.unresolved_count,row.extra_count];
 const quantity=productPageStockQuantity(row.quantity);
 const invalid=counts.some(n=>!Number.isSafeInteger(n)||n<0);
 const reason:ProductPageStockUnknownReason|null=invalid?'INVALID_STOCK_SUMMARY':!row.sku_count?'NO_RESOLVED_SKUS':!row.warehouse_count?'NO_WAREHOUSE_SCOPE'
  :row.unresolved_count?'SKU_IDENTITY_UNRESOLVED':row.extra_count?'UNKNOWN_WAREHOUSE_IDENTITY':row.missing_count?'STOCK_COVERAGE_INCOMPLETE'
  :row.cell_count!==row.sku_count*row.warehouse_count?'STOCK_COVERAGE_INCOMPLETE'
  :quantity===null?'INVALID_STOCK_SUMMARY':null;
 return {product_id:row.product_id,quantity:reason?null:quantity,status:reason?'UNKNOWN':'KNOWN',unknownReason:reason,
  coverage:invalid?null:{skuCount:row.sku_count,warehouseCount:row.warehouse_count,cellCount:row.cell_count,missingCellCount:row.missing_count}};
}
/** Runs in the same existing AuthorizedContext repeatable-read snapshot as productList. */
export async function readProductPageStockSummary(context:AuthorizedContext,productIds:readonly string[]):Promise<ProductPageStockSummary> {
 if(productIds.length>500)throw new SecurityError('VALIDATION',400,'本页库存摘要范围无效');
 const ids=[...new Set(productIds.map(id=>identifier(id,true).toLowerCase()))],{session,repo}=context,s=repo.source,r=repo.runtime;
 const result:ProductPageStockSummary={contractVersion:'PRODUCT_PAGE_STOCK_SUMMARY_V1',productIds:ids,scope:'ALL_INVENTORY_WAREHOUSES',
  readVersion:null,generationId:null,changeSeq:null,source:null,items:[]};
 const unknown=(reason:ProductPageStockUnknownReason):ProductPageStockSummary=>({...result,items:ids.map(product_id=>({product_id,quantity:null,status:'UNKNOWN',unknownReason:reason,coverage:null}))});
 if(!ids.length)return result;
 let g:StockBinding;
 try{g=await requireCurrentStockBinding(session,r,s);}catch(error){if(stockUnavailableError(error))return unknown('STOCK_LAYER_NOT_READY');throw error;}
 const scope=`skus AS MATERIALIZED (
 SELECT sku_id id,product_id FROM ${r}.standard_sku_relation WHERE product_id=ANY($2::uuid[])),
 warehouses AS MATERIALIZED (SELECT id,id=ANY($3::uuid[]) zero_eligible FROM ${s}.warehouse
 UNION ALL SELECT CASE WHEN w.id ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN w.id::uuid END,false
 FROM ${r}.master_data_entity w WHERE kind='warehouses' AND w.id ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 AND NOT EXISTS(SELECT 1 FROM ${s}.warehouse original WHERE original.id::text=w.id))`;
 if(g.binding.kind==='NON_FINAL'||!g.binding.activated)return unknown('BASIS_NOT_FINAL');
  result.readVersion=currentStockReadVersion(g);result.generationId=g.id;result.changeSeq=g.change_seq;result.source=currentStockReadSource(g);
  const proof=(await session.query<{ok:boolean}>(`SELECT reconciliation->>'contractVersion'='INVENTORY_UNIT_FREE_V1'
 AND reconciliation->'quantityKeysVerified'='true'::jsonb AND reconciliation->'allCommittedEffectsBound'='true'::jsonb ok
 FROM ${r}.inventory_stock_generation WHERE id=$1::uuid AND active AND enabled AND state='READY'`,[g.id])).rows[0]?.ok;
  if(!proof)return unknown('RECONCILIATION_NOT_PROVEN');
  const rows=(await session.query<ProductStockPageRow>(`WITH ${scope},
 extra AS (SELECT k.product_id,count(*)::integer n FROM skus k JOIN ${r}.inventory_stock_member m
 ON m.generation_id=$1::uuid AND m.sku_id=k.id WHERE NOT EXISTS(SELECT 1 FROM warehouses w WHERE w.id=m.warehouse_id) GROUP BY k.product_id),
 totals AS (SELECT k.product_id,count(DISTINCT k.id)::integer sku_count,count(DISTINCT w.id)::integer warehouse_count,
 count(*) FILTER(WHERE w.id IS NOT NULL AND (m.sku_id IS NOT NULL OR (v.runtime_zero_eligible OR v.zero_eligible AND w.zero_eligible)))::integer cell_count,
 count(*) FILTER(WHERE w.id IS NOT NULL AND m.sku_id IS NULL AND NOT(coalesce(v.runtime_zero_eligible,false) OR coalesce(v.zero_eligible,false) AND w.zero_eligible))::integer missing_count,
 count(DISTINCT k.id) FILTER(WHERE v.sku_id IS NULL OR v.product_id IS DISTINCT FROM k.product_id
 OR m.product_id IS NOT NULL AND m.product_id<>k.product_id)::integer unresolved_count,
 sum(CASE WHEN m.sku_id IS NOT NULL THEN m.quantity WHEN (v.runtime_zero_eligible OR v.zero_eligible AND w.zero_eligible) THEN 0::numeric END)::text quantity
 FROM skus k LEFT JOIN ${r}.inventory_stock_relation v ON v.generation_id=$1::uuid AND v.sku_id=k.id
 LEFT JOIN warehouses w ON true LEFT JOIN ${r}.inventory_stock_member m ON m.generation_id=$1::uuid AND m.warehouse_id=w.id AND m.sku_id=k.id
 GROUP BY k.product_id)
 SELECT wanted.id product_id,t.quantity,coalesce(t.sku_count,0)::integer sku_count,(SELECT count(*)::integer FROM warehouses) warehouse_count,
 coalesce(t.cell_count,0)::integer cell_count,coalesce(t.missing_count,0)::integer missing_count,
 coalesce(t.unresolved_count,0)::integer unresolved_count,coalesce(e.n,0)::integer extra_count
 FROM unnest($2::uuid[]) wanted(id) LEFT JOIN totals t ON t.product_id=wanted.id LEFT JOIN extra e ON e.product_id=wanted.id`,[g.id,ids,Array.isArray(g.reconciliation?.['zeroWarehouseIds'])?g.reconciliation['zeroWarehouseIds'] as string[]:[]])).rows;
  if(rows.length!==ids.length||new Set(rows.map(row=>row.product_id)).size!==ids.length||rows.some(row=>!ids.includes(row.product_id)))return unknown('INVALID_STOCK_SUMMARY');
  const byId=new Map(rows.map(row=>[row.product_id,productStockPageItem(row)]));result.items=ids.map(id=>byId.get(id)!);return result;
}


/** Explicit legacy provenance/rebuild helper only; no ordinary stock route calls this function.
 * It is not a fallback for an absent, disabled or stale maintained generation. */
export async function readFormalProductPageStockSummary(context:AuthorizedContext,ids:readonly string[],base:ProductPageStockSummary):Promise<ProductPageStockSummary|null> {
 if(!ids.length||ids.length>500||ids.some(id=>identifier(id,true)!==id))throw new SecurityError('VALIDATION',400,'本页库存摘要范围无效');
 const {session,repo}=context,s=repo.source,r=repo.runtime,run=await activeFormalBaselineRun(session,r);
 if(!run?.activated)return null;
 await assertSingleCurrentBasis(session,r);
 const increment=await formalSourceIncrementComponentReady(session,r),policy=approvedUnlistedZeroPolicy(run);
 const reply=(await session.query<{read_version:string;rows:ProductStockPageRow[]}>(`WITH
 source_skus AS MATERIALIZED (
  SELECT v.id,v.product_id,'SOURCE' origin,
   coalesce((SELECT jsonb_object_agg(d.code,jsonb_build_object('id',sv.id,'code',sv.code,'name',sv.name))
    FROM ${s}.variant_option o JOIN ${s}.spec_dimension d ON d.id=o.dimension_id JOIN ${s}.spec_value sv ON sv.id=o.spec_value_id
    WHERE o.variant_id=v.id AND d.code IN('COLOR','SIZE')),'{}'::jsonb) options,
   coalesce(g.name,ps.source_payload->>'sourceSizeGroupName',ps.source_payload->>'sourceSizeGroupCode') source_group,
   ${originalSourceGroupCodeSql('ps.source_payload')} original_source_group_code
  FROM ${s}.variant v LEFT JOIN LATERAL(SELECT source_payload,source_size_group_id FROM ${s}.tplus_product_source ps
   WHERE ps.product_id=v.product_id AND ps.batch_id=(SELECT batch_id FROM ${s}.tplus_import_run WHERE status='COMMITTED'
    ORDER BY committed_at DESC NULLS LAST,started_at DESC LIMIT 1)) ps ON true
  LEFT JOIN ${s}.size_group g ON g.id=ps.source_size_group_id WHERE v.product_id=ANY($2::uuid[])
 ), skus AS MATERIALIZED (
  SELECT v.id,v.product_id,$3::boolean AND ${approvedUnlistedSkuIdentitySql(s,r,'v')} zero_eligible FROM source_skus v
  UNION ALL SELECT v.id,v.product_id,false FROM ${r}.variant_overlay v WHERE v.product_id=ANY($2::uuid[])
   AND NOT EXISTS(SELECT 1 FROM ${s}.variant old WHERE old.id=v.id)
 ), warehouses AS MATERIALIZED (
  SELECT w.id,$3::boolean AND EXISTS(SELECT 1 FROM ${r}.inventory_quantity_identity i WHERE i.kind='WAREHOUSE' AND i.id=w.id
   AND i.target_key='WAREHOUSE:'||w.code AND NOT i.generated_in_target AND i.evidence_sha256 ~ '^[a-f0-9]{64}$'
   AND i.body->>'historicalIdentityAdmission'='true' AND i.body->>'currentCatalogueIdentityOnly'='false') zero_eligible FROM ${s}.warehouse w
  UNION ALL SELECT CASE WHEN m.id ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN m.id::uuid END,false
   FROM ${r}.master_data_entity m WHERE m.kind='warehouses' AND m.id ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   AND NOT EXISTS(SELECT 1 FROM ${s}.warehouse w WHERE w.id::text=m.id)
 ), changes AS MATERIALIZED (
  SELECT d.warehouse_id,d.sku_id,sum(d.quantity) quantity FROM (${formalSourceChangesSql(r,increment)}) d
   JOIN skus k ON k.id=d.sku_id WHERE d.run_id=$1 GROUP BY d.warehouse_id,d.sku_id
 ), cells AS MATERIALIZED (
  SELECT c.warehouse_id,c.sku_id,c.confirmed_opening+c.source_net+coalesce(d.quantity,0) quantity,
   c.proof #>> '{binding,display,productId}' bound_product_id FROM ${r}.inventory_formal_baseline_cell c
   JOIN skus k ON k.id=c.sku_id LEFT JOIN changes d ON d.warehouse_id=c.warehouse_id AND d.sku_id=c.sku_id WHERE c.run_id=$1
  UNION ALL SELECT d.warehouse_id,d.sku_id,d.quantity,NULL::text FROM changes d WHERE NOT EXISTS(
   SELECT 1 FROM ${r}.inventory_formal_baseline_cell c WHERE c.run_id=$1 AND c.warehouse_id=d.warehouse_id AND c.sku_id=d.sku_id)
 ), unresolved_saved AS (
  SELECT c.proof #>> '{binding,display,productId}' product_id,count(*)::integer n
  FROM ${r}.inventory_formal_baseline_cell c WHERE c.run_id=$1 AND c.proof #>> '{binding,display,productId}'=ANY(ARRAY(SELECT value::text FROM unnest($2::uuid[]) wanted(value)))
   AND NOT EXISTS(SELECT 1 FROM skus k WHERE k.id=c.sku_id) GROUP BY c.proof #>> '{binding,display,productId}'
 ), extra AS (
  SELECT k.product_id,count(*)::integer n FROM cells c JOIN skus k ON k.id=c.sku_id
   WHERE NOT EXISTS(SELECT 1 FROM warehouses w WHERE w.id=c.warehouse_id) GROUP BY k.product_id
 ), totals AS (
  SELECT k.product_id,count(DISTINCT k.id)::integer sku_count,count(DISTINCT w.id)::integer warehouse_count,
   count(*) FILTER(WHERE w.id IS NOT NULL AND (c.sku_id IS NOT NULL OR k.zero_eligible AND w.zero_eligible))::integer cell_count,
   count(*) FILTER(WHERE w.id IS NOT NULL AND c.sku_id IS NULL AND NOT(k.zero_eligible AND w.zero_eligible))::integer missing_count,
   count(*) FILTER(WHERE c.bound_product_id IS NOT NULL AND c.bound_product_id<>k.product_id::text)::integer unresolved_count,
   sum(CASE WHEN c.sku_id IS NOT NULL THEN c.quantity WHEN k.zero_eligible AND w.zero_eligible THEN 0::numeric END)::text quantity
  FROM skus k LEFT JOIN warehouses w ON true LEFT JOIN cells c ON c.sku_id=k.id AND c.warehouse_id=w.id GROUP BY k.product_id
 ), result AS (
  SELECT wanted.id product_id,t.quantity,coalesce(t.sku_count,0)::integer sku_count,(SELECT count(*)::integer FROM warehouses) warehouse_count,
   coalesce(t.cell_count,0)::integer cell_count,coalesce(t.missing_count,0)::integer missing_count,
   (coalesce(t.unresolved_count,0)+coalesce(u.n,0))::integer unresolved_count,coalesce(e.n,0)::integer extra_count
   FROM unnest($2::uuid[]) wanted(id) LEFT JOIN totals t ON t.product_id=wanted.id LEFT JOIN extra e ON e.product_id=wanted.id LEFT JOIN unresolved_saved u ON u.product_id=wanted.id::text
 ) SELECT ${formalSourceReadVersionSql(r,increment)} read_version,
 coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY product_id) FROM result a),'[]'::jsonb) rows`,[run.id,ids,policy!==null])).rows[0];
 if(!reply||typeof reply.read_version!=='string'||!Array.isArray(reply.rows)||reply.rows.length!==ids.length
  ||new Set(reply.rows.map(row=>row.product_id)).size!==ids.length||reply.rows.some(row=>!ids.includes(row.product_id)))return failed();
 const items=new Map(reply.rows.map(row=>[row.product_id,productStockPageItem(row)]));
 return {...base,readVersion:reply.read_version,source:{kind:'APPROVED_FORMAL_CURRENT_BASELINE',runId:run.id,
  dataClass:'USER_APPROVED_FORMAL_BASELINE',quantityMethod:'DERIVED_FROM_TARGET_INVENTORY',historicalTimelineCompletenessClaimed:false,
  quantityRead:'BOUNDED_ORIGINAL_SKU_BASELINE_AND_CURRENT_EFFECTS',...(policy?{unlistedZeroPolicy:policy}:{})},items:ids.map(id=>items.get(id)!)};
}

/** Legacy cell-paged readers share the same maintained original quantities.
 * Their existing cell-count contract remains distinct from the product-paged inventory screen.
 * Tracing may still read provenance, but ordinary quantity reads never rebuild old source algebra.
 */
export async function queryMaintainedInventory(context:AuthorizedContext,f:import('./query.js').InventoryFilters,
 expected?:{kind:'FORMAL'|'NON_FINAL';runId:string}):Promise<Record<string,unknown>|null> {
 const {session,repo}=context,s=repo.source,r=repo.runtime,g=await requireCurrentStockBinding(session,r,s);
 if(expected&&(g.binding.kind!==expected.kind||g.binding.runId!==expected.runId))return failed();
 if(!['FORMAL','NON_FINAL'].includes(g.binding.kind))return failed();
 const member=memberDto('c',g,r),standard=f.view==='standard';
 const grouped=standard?`display AS (
 SELECT c.warehouse_id,c.product_id,c.color_id,c.cell_tuple,sum(c.quantity) quantity,jsonb_agg(${member} ORDER BY c.sku_id) members
 FROM matches c JOIN ${r}.inventory_stock_relation v ON v.generation_id=c.generation_id AND v.sku_id=c.sku_id
 GROUP BY c.warehouse_id,c.product_id,c.color_id,c.cell_tuple),output AS (
 SELECT jsonb_build_object('warehouseId',warehouse_id,'productId',product_id,'colorId',color_id,
 'standard',jsonb_build_object('group',cell_tuple->>3,'fit',cell_tuple->>4,'code',cell_tuple->>5,'size',cell_tuple->>6),
 'unmappedSkuId',cell_tuple->>7,'quantity',quantity::text,'members',members) item,warehouse_id,cell_tuple::text sort_key FROM display)`:
 `output AS (SELECT ${member} item,c.warehouse_id,c.sku_id::text sort_key FROM matches c
 JOIN ${r}.inventory_stock_relation v ON v.generation_id=c.generation_id AND v.sku_id=c.sku_id)`;
 const data=(await session.query<{data:Record<string,unknown>}>(`WITH matches AS MATERIALIZED (
 SELECT * FROM ${r}.inventory_stock_member c WHERE generation_id=$1::uuid
 AND ($2::uuid IS NULL OR warehouse_id=$2::uuid) AND ($3::uuid IS NULL OR sku_id=$3::uuid)
 AND ($4::uuid IS NULL OR product_id=$4::uuid) AND ($5::text='' OR position(lower($5) in lower(display_search))>0)
 AND (NOT $6::boolean OR quantity<>0)),${grouped},slice AS (
 SELECT * FROM output ORDER BY warehouse_id,sort_key LIMIT $7 OFFSET $8)
 SELECT jsonb_build_object('view',$9::text,'items',coalesce((SELECT jsonb_agg(item ORDER BY warehouse_id,sort_key) FROM slice),'[]'::jsonb),
 'total',(SELECT count(*) FROM output),'originalCellCount',(SELECT count(*) FROM matches),
 'page',$8::integer/$7::integer+1,'size',$7::integer,'quantityTotal',coalesce((SELECT sum(quantity)::text FROM matches),'0.0000'),
 'reconciled',true,'standardRead',jsonb_build_object('contractVersion','STANDARD_SKU_READ_V1','readiness','READY'),'sourceQuantityPolicy','USER_CONFIRMED_CURRENT_EXPORT_TARGET_CALIBRATION','readVersion',$10::text,'generationId',$1::text,'catalogVersion',$11::text,'source',$12::jsonb,
 'quantityMethod','DERIVED_FROM_TARGET_INVENTORY','historicalTimelineCompletenessClaimed',false,'dataClass',$13::text) data`,
 [g.id,f.warehouseId,f.skuId,f.productId,f.q,f.nonzero,f.size,(f.page-1)*f.size,f.view,currentStockReadVersion(g),g.catalog_version??null,
 JSON.stringify(currentStockReadSource(g)),String(currentStockReadSource(g)['dataClass'])])).rows[0]?.data;
 return data??failed();
}
