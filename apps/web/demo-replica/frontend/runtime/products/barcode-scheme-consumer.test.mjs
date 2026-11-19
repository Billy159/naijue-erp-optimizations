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
  await build({stdin:{contents:"export {act,createElement} from 'react';export {createRoot} from 'react-dom/client';export {SchemeConsumer} from './detail.tsx';export {ReadContext} from '../../../../src/loading/read-scope.ts';",resolveDir:here,loader:'tsx'},outfile,bundle:true,platform:'browser',format:'esm',external:['react','react-dom','react-dom/*'],banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},jsx:'automatic',plugins:[{name:'synthetic-lazy-scheme',setup(b){
    b.onResolve({filter:/\.css(?:\?inline)?$/},args=>({path:args.path,namespace:'test-css'}));
    b.onLoad({filter:/.*/,namespace:'test-css'},()=>({contents:'export default "";',loader:'js'}));
    b.onLoad({filter:/scheme-page\.tsx$/},()=>({contents:"export const mountDetail = (...args) => globalThis.syntheticSchemeMount(...args);",loader:'tsx'}));
  }}]});
  const mod=await import(pathToFileURL(outfile));act=mod.act;
  const host=document.getElementById('root');root=mod.createRoot(host);
  let mounts=0,disposes=0;
  globalThis.syntheticSchemeMount=(node,schemeId,opts)=>{mounts++;assert.ok(opts.scope.active);if(mounts===1)throw Error('synthetic lazy consumer failure');node.textContent='真实入口合成数据 '+schemeId;return()=>{disposes++;node.replaceChildren();};};
  const id='10000000-0000-4000-8000-000000000003',scope=new mod.ReadContext({accountId:id,sessionRevision:'1',permissionRevision:'1'}).createScope('scheme');
  await act(async()=>root.render(mod.createElement(mod.SchemeConsumer,{scope,http:{origin:'https://synthetic.test',basePath:'',fetch(){assert.fail('unexpected fetch');}},onAccessFailure(){assert.fail('unexpected denial');},schemeId:id,close(){}})));
  assert.match(document.querySelector('.arco-modal [role=alert]')?.textContent??'',/方案未能打开/);
  await act(async()=>[...document.querySelectorAll('.arco-modal button')].find(b=>b.textContent==='重试').click());
  assert.equal(mounts,2);assert.match(host.textContent,/真实入口合成数据/);
  await act(async()=>scope.dispose());assert.equal(disposes,1);
} finally {
  if(root)await act(async()=>root.unmount());
  delete globalThis.syntheticSchemeMount;
  dom.window.close();await rm(temp,{recursive:true,force:true});
}
