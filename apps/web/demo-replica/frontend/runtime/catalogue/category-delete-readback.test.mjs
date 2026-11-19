import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const here = path.dirname(fileURLToPath(import.meta.url));
const temp = await mkdtemp(path.join(here, '.test-'));
const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>', { url: 'https://synthetic.test/', pretendToBeVisual: true });
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLIFrameElement','Node','Element','SVGElement','Event','MouseEvent','MutationObserver','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','navigator']) Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
window.matchMedia = () => ({ matches:false, addListener(){}, removeListener(){} });
globalThis.ResizeObserver = window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let release, act;
try {
  const outfile = path.join(temp,'entry.mjs');
  await build({stdin:{contents:"export {act} from 'react';export {mount} from './category-page.tsx';export {ReadContext} from '../../../../src/loading/read-scope.ts';",resolveDir:here,loader:'tsx'},outfile,bundle:true,platform:'browser',format:'esm',external:['react','react-dom','react-dom/*'],banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},jsx:'automatic',plugins:[{name:'synthetic-style',setup(b){b.onResolve({filter:/\.css(?:\?inline)?$/},args=>({path:args.path,namespace:'test-css'}));b.onLoad({filter:/.*/,namespace:'test-css'},()=>({contents:'export default "";',loader:'js'}));}}]});
  const mod = await import(pathToFileURL(outfile)); act = mod.act;
  const id = '10000000-0000-4000-8000-000000000003';
  const operationId = '10000000-0000-4000-8000-000000000004';
  const item = { id, name:'合成分类', parentId:null, displayOrder:0, productCount:0, childCount:0, version:1 };
  const scope = new mod.ReadContext({accountId:id,sessionRevision:'1',permissionRevision:'1'}).createScope('category');
  let reads=0,writes=0,changed=0,complete;
  const options = {
    scope, categoryControlCss:'', mountEmpty:()=>()=>{}, onCanLeaveChange(){}, onChanged(){changed++;}, onAccessFailure(){assert.fail('unexpected access failure');},
    catalogue:{async readCategories(){reads++;if(reads===1||reads===3)return {items:[item]};if(reads===2)throw Error('synthetic read failure');return new Promise(resolve=>{complete=()=>resolve({items:[]});});}},
    maintenance:{CATEGORY:{kind:'CATEGORY',allowedActions:['DELETE'],newRequestKey:()=>operationId,onRecoveryRequired(){},client:{kind:'CATEGORY',async execute(command){writes++;assert.equal(command.action,'DELETE');assert.equal(command.id,id);return {operationId,kind:'CATEGORY',targetId:id,version:2};},async receipt(){assert.fail('known commit must not read receipt or replay');}}}}
  };
  const button = (where,text) => [...where.querySelectorAll('button')].find(node=>node.textContent===text);
  const click = async(node)=>{assert.ok(node,'button exists');await act(async()=>node.click());};
  await act(async()=>{release=mod.mount(document.getElementById('root'),options);});
  await click(button(document,'删除分类'));
  const modal=()=>document.querySelector('.arco-modal');
  assert.ok(modal());
  await click(button(modal(),'确认删除'));
  assert.equal(writes,1);assert.equal(reads,2);
  assert.match(modal().textContent,/操作已提交.*读取失败/);
  assert.equal(button(modal(),'确认删除').disabled,true);
  await click(button(modal(),'重新读取目录'));
  assert.equal(writes,1);assert.equal(reads,3);
  assert.match(modal().textContent,/操作已提交.*仍出现/);
  await click(button(modal(),'重新读取目录'));
  assert.equal(button(modal(),'重新读取目录').disabled,true);
  await act(async()=>complete());
  assert.equal(writes,1);assert.equal(reads,4);assert.equal(changed,1);
  assert.ok(!modal());
  assert.match(document.getElementById('pc-category-error').textContent,/已删除/);
} finally {
  if(release)await act(async()=>release());
  dom.window.close();await rm(temp,{recursive:true,force:true});
}
