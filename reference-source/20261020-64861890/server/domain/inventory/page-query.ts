import type {AuthorizedContext} from '../../security/service.js';
import {identifier,invalid,object,SecurityError} from '../../security/errors.js';
import {standardSkuIdentityDomain} from '../products/standard-sku-relation.js';
import {requireCurrentStockBinding,type StockBinding} from './current-stock.js';
import {queryCurrentStockPage,queryCurrentStockMembers} from './current-stock-sql.js';
import {parseScaled} from '../transactions/decimal.js';

export {approvedUnlistedZeroPolicy} from './formal-current-baseline.js';

/** Lossless opt-in transport only. Explicit mask records each inherited field;
 * absent facts stay absent and all original members/counts/quantities survive. */
export function compactInventoryPage(data:Record<string,unknown>):Record<string,unknown> {
 if(data['contractVersion']!=='INVENTORY_PAGE_V1'||!Array.isArray(data['items']))return data;
 const source=object(data['source']);
 const pack=(cell:Record<string,unknown>,parent:Record<string,unknown>):Record<string,unknown>=>{
  if(Object.hasOwn(cell,'__inheritMask'))throw new Error('INVENTORY_TRANSPORT_FIELD_COLLISION');
  const row={...cell},basis=cell['basis'];let mask=0;
  const fields=['warehouseId','productId','quantityMethod','historicalTimelineCompletenessClaimed','dataClass'];
  const values=[parent['warehouseId'],parent['productId'],data['quantityMethod'],data['historicalTimelineCompletenessClaimed'],data['dataClass']];
  fields.forEach((key,index)=>{if(values[index]!==undefined&&Object.hasOwn(row,key)&&row[key]===values[index]){delete row[key];mask|=1<<index;}});
  if(basis&&typeof basis==='object'&&!Array.isArray(basis)){
   const b={...basis as Record<string,unknown>},keys=['kind','runId','difference','reconciled'],expected=[source['kind'],source['runId'],'0.0000',true];
   keys.forEach((key,index)=>{if(expected[index]!==undefined&&Object.hasOwn(b,key)&&b[key]===expected[index]){delete b[key];mask|=1<<(index+5);}});row['basis']=b;
  }
  return {...row,__inheritMask:mask};
 };
 return {transportVersion:'INVENTORY_PAGE_COMPACT_V1',data:{...data,items:data['items'].map(value=>{
  const row=object(value);return Array.isArray(row['members'])?{...row,members:row['members'].map(cell=>pack(object(cell),row))}:pack(row,{});
 })}};
}

interface PageFilters {
  warehouses:string[];products:string[];codes:string[];categories:string[];supplierId:string[];fitId:string[];seasons:string[];
  q:string;unit:string|null;nonzero:boolean;
}
export interface InventoryPageInput {page:number;size:number;view:'original'|'standard';filters:PageFilters;
  wire?:'compact-v1';projection?:'summary'|'members';cellKey?:string;expectedReadVersion?:string;memberPage?:number;memberSize?:number}
export function inventoryPageInput(input:unknown):InventoryPageInput {
  const outer=object(input);let q=outer;
  if(outer['query']!==undefined){
    if(Object.keys(outer).some(k=>k!=='query')||typeof outer['query']!=='string'||Buffer.byteLength(outer['query'])>1048576)return invalid();
    try{q=object(JSON.parse(outer['query']));}catch{return invalid();}
  }
  if(Object.keys(q).some(k=>!['page','size','filters','view','projection','cellKey','expectedReadVersion','memberPage','memberSize','wire'].includes(k)))return invalid();
  const integer=(v:unknown,fallback:number):number=>v===undefined?fallback:typeof v==='number'?v:typeof v==='string'&&/^[1-9]\d*$/.test(v)?Number(v):NaN;
  const page=integer(q['page'],1),size=integer(q['size'],100),f=q['filters']===undefined?{}:object(q['filters']);
  if(f['unit']!==undefined&&f['unit']!==null&&f['unit']!=='')throw new SecurityError('CONTRACT_VERSION_MISMATCH',409,'单位筛选已停用，请保留其他条件重新查询');
  if(!Number.isSafeInteger(page)||page<1||page>1000000||![20,50,100,200,500].includes(size)
    ||q['view']!==undefined&&!['original','standard'].includes(String(q['view'])))return invalid();
  if(Object.keys(f).some(k=>!['warehouses','products','codes','categories','supplierId','fitId','seasons','q','unit','nonzero'].includes(k)))return invalid();
  const list=(key:string,uuid=false):string[]=>{
    const v=f[key];if(v===undefined)return [];
    if(!Array.isArray(v)||v.length>3000||v.some(x=>typeof x!=='string'||!x.length||x.length>128||x.includes('\0')))return invalid();
    return [...new Set(v.map(x=>uuid?identifier(x,true):String(x)))];
  };
  const text=(v:unknown,max:number):string|null=>v===undefined?null:typeof v==='string'&&v.trim()&&v.length<=max&&!v.includes('\0')?v.trim():invalid();
  if(f['nonzero']!==undefined&&typeof f['nonzero']!=='boolean')return invalid();
  if(q['wire']!==undefined&&q['wire']!=='compact-v1')return invalid();
  const projection=q['projection'];
  if(projection!==undefined&&!['summary','members'].includes(String(projection)))return invalid();
  if(projection!==undefined&&q['view']!=='standard')return invalid();
  const memberPage=integer(q['memberPage'],1),memberSize=integer(q['memberSize'],100);
  if(projection==='members'){
    if(typeof q['cellKey']!=='string'||!/^[a-f0-9]{64}$/.test(q['cellKey'])
      ||typeof q['expectedReadVersion']!=='string'||!q['expectedReadVersion'].length||q['expectedReadVersion'].length>512
      ||!Number.isSafeInteger(memberPage)||memberPage<1||memberPage>1000000||![20,50,100,200,500].includes(memberSize))return invalid();
  }else if(['cellKey','expectedReadVersion','memberPage','memberSize'].some(k=>q[k]!==undefined))return invalid();
  return {...(q['wire']==='compact-v1'?{wire:'compact-v1' as const}:{}),page,size,view:q['view']==='standard'?'standard':'original',filters:{warehouses:list('warehouses',true),products:list('products',true),codes:list('codes'),
    categories:list('categories').includes('all')?[]:list('categories'),supplierId:list('supplierId'),fitId:list('fitId'),seasons:list('seasons'),
    q:f['q']===''?'':text(f['q'],3000)??'',unit:null,nonzero:f['nonzero']===true},
    ...(projection==='summary'?{projection:'summary' as const}:projection==='members'?{projection:'members' as const,
      cellKey:q['cellKey'] as string,expectedReadVersion:q['expectedReadVersion'] as string,memberPage,memberSize}:{})};
}

/** A single read action owns the complete filter/count/summary and the selected product identities. */
export async function queryInventoryPage(context:AuthorizedContext,input:InventoryPageInput):Promise<Record<string,unknown>> {
  const {session,repo}=context,s=repo.source,r=repo.runtime,f=input.filters;
  const withDomain=async(data:Record<string,unknown>,binding?:StockBinding):Promise<Record<string,unknown>>=>{
    const ids=data['productIds'];if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'))throw new SecurityError('INVENTORY_READ_FAILED',503,'库存商品范围尚未核实');
    const domain=await standardSkuIdentityDomain(session,s,r,ids as string[]);
    if(!domain)throw new SecurityError('INVENTORY_READ_FAILED',503,'库存标准关系暂未就绪，请稍后重试');
    const identityDomain:Record<string,unknown>={...domain,page:input.page,size:input.size,readVersion:data['readVersion'],catalogVersion:data['catalogVersion'],warehouseIds:[...f.warehouses]};
    if(binding?.binding.kind==='FORMAL'&&!f.nonzero){
      const qualifications=(await session.query<{sku_id:string;zero_eligible:boolean;runtime_zero_eligible:boolean}>(
        `SELECT sku_id,zero_eligible,runtime_zero_eligible FROM ${r}.inventory_stock_relation WHERE generation_id=$1::uuid AND product_id=ANY($2::uuid[]) ORDER BY sku_id`,[binding.id,ids])).rows;
      const policy=binding.reconciliation?.['unlistedZeroPolicy'];
      if(policy&&typeof policy==='object')identityDomain['zeroQuantityCoverage']={...policy,relationSource:'MAINTAINED_CURRENT_STOCK_V3',
        readVersion:data['readVersion'],catalogVersion:data['catalogVersion'],page:input.page,size:input.size,
        warehouseIds:(Array.isArray(binding.reconciliation?.['zeroWarehouseIds'])?binding.reconciliation['zeroWarehouseIds'] as string[]:[]).filter(id=>f.warehouses.includes(id)),eligibleSkuIds:qualifications.filter(row=>row.zero_eligible).map(row=>row.sku_id),
        runtimeEligibleSkuIds:qualifications.filter(row=>row.runtime_zero_eligible).map(row=>row.sku_id),completeReturnedQuantityKeysVerified:true};
      data=input.view!=='standard'||input.projection!=='summary'?{...data,preparedRead:preparedInventoryPageFacts(data,identityDomain)}:{...data,preparedRead:{contractVersion:'INVENTORY_PREPARED_SUMMARY_FACTS_V2',readVersion:data['readVersion'],catalogVersion:data['catalogVersion'],
        page:input.page,size:input.size,productIds:ids,warehouseIds:[...f.warehouses],quantityIssues:data['quantityIssues'],visibleCoordinates:data['visibleCoordinates'],zeroFacts:[]}};
    }
    return {...data,identityDomain};
  };
  const maintained=await requireCurrentStockBinding(session,r,s);
  const data=input.projection==='members'?await queryCurrentStockMembers(context,input,maintained)
    :await withDomain(await queryCurrentStockPage(context,input,maintained),maintained);
  return input.wire==='compact-v1'?compactInventoryPage(data):data;
}

/** Page layout facts computed from maintained qualifications and exact original members.
 * Missing-zero facts are separate from original members and cannot create ledger entries. */
export function preparedInventoryPageFacts(data:Record<string,unknown>,domain:Record<string,unknown>):Record<string,unknown> {
 const skus=domain['skus'] as Record<string,unknown>[],coverage=domain['zeroQuantityCoverage'] as Record<string,unknown>|undefined;
 const quantityRows=(data['items'] as Record<string,unknown>[]).flatMap(item=>Array.isArray(item['members'])?item['members'] as Record<string,unknown>[]:[item]);
 const bySku=new Map(skus.map(row=>[String(row['skuId']),row])),byKey=new Map<string,Record<string,unknown>>(),coordinates=new Map<string,Record<string,unknown>>();
 const key=(warehouse:unknown,sku:unknown)=>JSON.stringify([warehouse,sku]);
 for(const row of quantityRows){const identity=key(row['warehouseId'],row['skuId']);if(byKey.has(identity))throw new SecurityError('INVENTORY_READ_FAILED',503,'库存原数量身份重复');byKey.set(identity,row);
  const sku=bySku.get(String(row['skuId']));if(!sku||!sku['colorId'])continue;
  const coordinate=JSON.stringify([row['productId'],sku['colorId'],row['warehouseId']]);
  coordinates.set(coordinate,{productId:row['productId'],colorId:sku['colorId'],warehouseId:row['warehouseId']});
 }
 const zeroIds=new Set(coverage?.['eligibleSkuIds'] as string[]??[]),runtimeZeroIds=new Set(coverage?.['runtimeEligibleSkuIds'] as string[]??[]),zeroWarehouses=new Set(coverage?.['warehouseIds'] as string[]??[]);
 const zeros:Record<string,unknown>[]=[],issues:Record<string,unknown>[]=[],visible:Record<string,unknown>[]=[];
 for(const coordinate of coordinates.values()){
  let show=false;
  for(const sku of skus.filter(row=>row['productId']===coordinate['productId']&&row['colorId']===coordinate['colorId'])){
   const row=byKey.get(key(coordinate['warehouseId'],sku['skuId']));
   if(row){if(row['quantity']===null||parseScaled(row['quantity'],4)!==0n)show=true;continue;}
   const identity={...coordinate,skuId:sku['skuId']};
   if(coverage?.['completeReturnedQuantityKeysVerified']===true&&(runtimeZeroIds.has(String(sku['skuId']))||zeroIds.has(String(sku['skuId']))&&zeroWarehouses.has(String(coordinate['warehouseId']))))zeros.push({...identity,quantity:'0',kind:'APPROVED_UNLISTED_ZERO'});
   else {show=true;issues.push({...identity,reason:zeroIds.has(String(sku['skuId']))?'WAREHOUSE_ZERO_NOT_ADMITTED':String(sku['zeroQualification']??'SKU_ZERO_NOT_ADMITTED')});}
  }
  if(show)visible.push(coordinate);
 }
 return {contractVersion:'INVENTORY_PREPARED_PAGE_FACTS_V1',readVersion:data['readVersion'],catalogVersion:data['catalogVersion'],
  page:data['page'],size:data['size'],productIds:data['productIds'],warehouseIds:domain['warehouseIds'],originalMemberCount:quantityRows.length,missingOriginalCount:zeros.length+issues.length,visibleCoordinateCount:visible.length,zeroFacts:zeros,quantityIssues:issues,visibleCoordinates:visible};
}
