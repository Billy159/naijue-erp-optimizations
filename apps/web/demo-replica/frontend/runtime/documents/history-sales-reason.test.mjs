import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const here = path.dirname(fileURLToPath(import.meta.url));
const temp = await mkdtemp(path.join(here, '.test-'));
const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>', { url: 'https://synthetic.test/', pretendToBeVisual: true });
for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLIFrameElement','HTMLDialogElement','HTMLTextAreaElement','Node','Element','SVGElement','Event','MouseEvent','MutationObserver','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','navigator']) Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
window.matchMedia = () => ({ matches:false, addListener(){}, removeListener(){} });
globalThis.ResizeObserver = window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
HTMLDialogElement.prototype.showModal=function(){this.open=true;};
HTMLDialogElement.prototype.close=function(){this.open=false;};
let root, act;
try {
  const outfile=path.join(temp,'entry.mjs');
  await build({stdin:{contents:"export {act,createElement} from 'react';export {createRoot} from 'react-dom/client';export {default as HistoryPage} from './history-page.tsx';export {ReadContext} from '../../../../src/loading/read-scope.ts';",resolveDir:here,loader:'tsx'},outfile,bundle:true,platform:'browser',format:'esm',external:['react','react-dom','react-dom/*'],banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},jsx:'automatic',plugins:[{name:'synthetic-history',setup(b){
    b.onResolve({filter:/\.css(?:\?inline)?$/},args=>({path:args.path,namespace:'test-css'}));
    b.onLoad({filter:/.*/,namespace:'test-css'},()=>({contents:'export default "";',loader:'js'}));
    b.onLoad({filter:/history-reader\.ts$/},()=>({contents:"export const createHistoryReader=()=>({readDetail:async()=>globalThis.syntheticHistory.detail});export const collectHistoryDocument=async()=>globalThis.syntheticHistory.complete;",loader:'ts'}));
  }}]});
  const mod=await import(pathToFileURL(outfile));act=mod.act;
  const host=document.getElementById('root');root=mod.createRoot(host);
  const id='10000000-0000-4000-8000-000000000003',scope=new mod.ReadContext({accountId:id,sessionRevision:'1',permissionRevision:'1'}).createScope('sales-history');
  const documentRow={kind:'sales',documentId:id,batchId:id,version:1,sourceStatus:'APPROVED',businessType:'SALE',grossAmount:'1.00',orderDiscount:'0.00',netDue:'1.00'};
  const detail={document:documentRow,lines:{items:[],total:'0',page:1},settlements:{items:[],total:'0',page:1}};
  globalThis.syntheticHistory={detail,complete:{document:documentRow,lines:[],settlements:[]}};
  const writes=[],idle={phase:'idle',notice:null};
  const owner={subscribe:()=>()=>{},getSnapshot:()=>idle,submit:async command=>{writes.push(command);}};
  const session={historyOwners:new Map(),historyOwner:async()=>owner,selection:{row:null}};
  await act(async()=>root.render(mod.createElement(mod.HistoryPage,{session,scope,http:{},target:{kind:'sales',batchId:id,documentId:id,effectiveVersion:1},canEdit:true,newRequestKey:()=>id,denied(){},navigate(){},guard(){},committed(){}})));
  const click=async(where,text)=>{const node=[...where.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(node,text);await act(async()=>node.click());};
  const input=async(node,value)=>{await act(async()=>{Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node),'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));});};
  await click(host,'修改');
  await input(host.querySelector('input[aria-label="销售金额"]'),'2.00');
  await click(host,'保存');
  const dialog=host.querySelector('dialog');
  assert.ok(dialog?.open);
  await click(dialog,'保存');
  assert.equal(writes.length,0);
  assert.match(dialog.querySelector('[role=alert]')?.textContent??'',/请填写修订原因/);
  const reason=dialog.querySelector('textarea');
  assert.equal(document.activeElement,reason);
  await input(reason,'合成修订原因');
  await click(dialog,'保存');
  assert.equal(writes.length,1);assert.equal(writes[0].reason,'合成修订原因');assert.equal(writes[0].totals.grossAmount,'2.00');
} finally {
  if(root)await act(async()=>root.unmount());
  delete globalThis.syntheticHistory;
  dom.window.close();await rm(temp,{recursive:true,force:true});
}
