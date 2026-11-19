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
let root, act;
try {
  const outfile=path.join(temp,'entry.mjs');
  await build({stdin:{contents:"export {act,createElement,useState} from 'react';export {createRoot} from 'react-dom/client';export {HistoryMatrix} from './transfers-history-page.tsx';",resolveDir:here,loader:'tsx'},outfile,bundle:true,platform:'browser',format:'esm',external:['react','react-dom','react-dom/*'],banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},jsx:'automatic',plugins:[{name:'synthetic-styles-and-private-matrix',setup(b){
    b.onResolve({filter:/\.css(?:\?inline)?$/},args=>({path:args.path,namespace:'test-css'}));
    b.onLoad({filter:/.*/,namespace:'test-css'},()=>({contents:'export default "";',loader:'js'}));
    b.onLoad({filter:/transfers-history-page\.tsx$/},async args=>({contents:await (await import('node:fs/promises')).readFile(args.path,'utf8').then(s=>s+'\nexport {HistoryMatrix};'),loader:'tsx'}));
  }}]});
  const mod=await import(pathToFileURL(outfile));act=mod.act;
  const h=mod.createElement,host=document.getElementById('root');root=mod.createRoot(host);
  const lines=Array.from({length:21},(_,i)=>{const line={id:String(i),quantity:'1',productCodeSnapshot:'SYN'+i,colorNameSnapshot:'红',fitNameSnapshot:'5',sizeNameSnapshot:'M'};return {key:line.id,productId:line.id,lines:[line],cells:new Map([['M',line]])};});
  let update;
  function Harness(){const [rows,setRows]=mod.useState(lines),[rowPage,setRowPage]=mod.useState(1);update=setRows;return h(mod.HistoryMatrix,{projection:{sections:[{key:'1',origin:'SOURCE',group:{groupId:'1',name:'合成尺码组',sizes:[{sizeId:'M',name:'M'}]},rows}]},model:null,quantities:null,locked:false,rowPage,setRowPage});}
  const visible=()=>[...host.querySelectorAll('[data-mx-row]')].map(x=>x.dataset.mxRow);
  await act(async()=>root.render(h(Harness)));
  assert.equal(visible().length,20);
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='下一页矩阵').click());
  assert.deepEqual(visible(),['20']);
  await act(async()=>update(lines.slice(0,20)));
  assert.equal(visible().length,20,'deleting the only final-page row must leave surviving rows visible');
  await act(async()=>update(lines));
  assert.equal(visible().length,20,'adding rows back must not resurrect a stale page');
  await act(async()=>update([]));
  assert.equal(visible().length,0);
} finally {
  if(root)await act(async()=>root.unmount());
  dom.window.close();await rm(temp,{recursive:true,force:true});
}
