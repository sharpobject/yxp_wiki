import './scene-resample.mjs?v=16a1f4162c40880b';
import './scene-render.mjs?v=16a1f4162c40880b';
import {loadNativeText,bitmap,composite} from './native-text.mjs?v=16a1f4162c40880b';
import {autoStyle,markup} from './auto-style.mjs?v=16a1f4162c40880b';
const Scene=globalThis.CardScene,resample=globalThis.CardResample;
const cache=new Map();
export function loadImage(url){
 if(!cache.has(url))cache.set(url,new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{cache.delete(url);reject(new Error('Image failed to load'));};im.src=url;}));
 return cache.get(url);
}
const surface=(w,h)=>Scene.surface(w,h);
const jsonCache=new Map();
function json(url){if(!jsonCache.has(url))jsonCache.set(url,fetch(url,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Card data unavailable');return r.json();}).catch(e=>{jsonCache.delete(url);throw e;}));return jsonCache.get(url);}
function artLayer(image,flip,zoom,x,y){
 const c=surface(180,216),ctx=c.getContext('2d');
 if(!image){ctx.fillStyle='#ddd9cb';ctx.fillRect(0,0,180,216);ctx.strokeStyle='#b7b3a5';for(let i=-216;i<180;i+=12){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+216,216);ctx.stroke();}return c;}
 const k=Math.max(180/image.width,216/image.height)*zoom,w=image.width*k,h=image.height*k;
 ctx.translate(90,108);if(flip)ctx.scale(-1,1);ctx.drawImage(image,-w/2+x*(w-180)/2,-h/2+y*(h-216)/2,w,h);return c;
}
export async function renderCard(canvas,state,catalog,base,uploads,scale=1){
 const [all,lexicon]=await Promise.all([json(new URL('native-assets.json',base).href),json(new URL('keywords.json',base).href)]);
 const text=state.autoStyle===false?state.text:markup(autoStyle(state.text,state.language,lexicon));
 const native=await loadNativeText(base,state.name+state.cn+text);
 const g=all[scale],assets=new Map(),image=file=>loadImage(new URL(file,base).href),parts=[];
 let id=0;
 const leaf=im=>{const key='runtime-'+id++;assets.set(key,im);return ['i',key,im.width,im.height];};
 const getArt=async slot=>state[slot.toLowerCase()]==='upload'?(uploads[slot]?.image||null):image(catalog.cards.find(c=>c.id===state[slot.toLowerCase()]).image);
 const [a,b]=await Promise.all([getArt('A'),state.fusion?getArt('B'):null]);
 let art=leaf(artLayer(a,state.flipA,state.zoomA,state.xA,state.yA));
 if(state.fusion){
  // Native putalpha replaces alpha after shifting, rather than multiplying it.
  // Bake this mutable fusion in JS before passing it to the shared compositor.
  const fused=bitmap(180,216);
  const masks=await Promise.all(catalog.fusion.masks.map(image)),divider=await image(catalog.fusion.line);
  const pixels=im=>{const c=surface(180,216);c.getContext('2d').drawImage(im,0,0);return c.getContext('2d').getImageData(0,0,180,216);};
  for(let i=0;i<2;i++){
   const slot=i?'B':'A',im=i?b:a,[x,y]=catalog.fusion.offsets[i],ix=Math.floor(x),iy=Math.floor(y),tile=pixels(artLayer(im,state['flip'+slot],state['zoom'+slot],state['x'+slot],state['y'+slot]));
   const shifted=resample(tile,180,216,1,1,x-ix,y-iy,'magic_kernel_shift_rgba'),layer=bitmap(180,216),mask=pixels(masks[i]);
   composite(layer,shifted,ix,iy);for(let k=3;k<layer.data.length;k+=4)layer.data[k]=mask.data[k];composite(fused,layer,0,0);
  }
  composite(fused,pixels(divider),0,0);
  const c=surface(180,216);c.getContext('2d').putImageData(new ImageData(fused.data,180,216),0,0);art=leaf(c);
 }
 parts.push([g.bleed,0,['t',300*scale,508*scale,...g.artTransform,art,'magic_kernel_sharp_resample_translate']]);
 const fixedRows=[g.frames[state.phase+'-'+(state.dream?'dream':state.level)],!state.dream&&state.mark!=='none'?g.marks[state.mark]:null,state.language==='en'?g.titleBg:null,state.costType!=='none'?g.costs[state.costType][state.cost]:null].filter(Boolean);
 const fixedImages=await Promise.all(fixedRows.map(row=>image(row[2])));
 fixedRows.forEach(([x,y],i)=>parts.push([x,y,leaf(fixedImages[i])]));
 const type=native.layers({...state,text},scale),toCanvas=im=>{const c=surface(im.width,im.height);c.getContext('2d').putImageData(new ImageData(im.data,im.width,im.height),0,0);return c;};
 for(const p of type.layers)parts.push([p.x,p.y,leaf(toCanvas(p.image))]);
 let description=['g',...g.size,type.description.map(p=>[p.x,p.y,leaf(toCanvas(p.image))])];
 if(Math.abs(type.blockScale-1)>1e-6){const s=type.blockScale,[cx,cy]=type.blockCenter;description=['t',...g.size,s,s,cx*(1-s),cy*(1-s),description,'magic_kernel_sharp_resample_translate'];}
 parts.push([0,0,description]);
 const scene=['g',...g.size,parts],out=Scene.renderPrepared(scene,assets);
 canvas.width=out.width;canvas.height=out.height;canvas.getContext('2d').drawImage(out,0,0);
 return {overflow:type.overflow,missing:!a||(state.fusion&&!b)};
}
