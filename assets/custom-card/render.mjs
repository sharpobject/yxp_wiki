import './scene-resample.mjs?v=3b0eef10696b5338';
import './scene-render.mjs?v=3b0eef10696b5338';
import {loadNativeText,bitmap,composite} from './native-text.mjs?v=3b0eef10696b5338';
import {autoStyle,markup} from './auto-style.mjs?v=3b0eef10696b5338';
const Scene=globalThis.CardScene,resample=globalThis.CardResample;
const cache=new Map();
export function loadImage(url){
 if(!cache.has(url))cache.set(url,new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{cache.delete(url);reject(new Error('Image failed to load'));};im.src=url;}));
 return cache.get(url);
}
const surface=(w,h)=>Scene.surface(w,h);
const jsonCache=new Map();
function json(url){if(!jsonCache.has(url))jsonCache.set(url,fetch(url,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Card data unavailable');return r.json();}).catch(e=>{jsonCache.delete(url);throw e;}));return jsonCache.get(url);}
function artLayer(image,flip,zoom,x,y,sigil=false,nativeSigil=false){
 if(sigil)return sigilArtLayer(image||artLayer(null,false,1,0,0),flip,zoom,x,y,nativeSigil);
 const c=surface(180,216),ctx=c.getContext('2d');
 if(!image){ctx.fillStyle='#ddd9cb';ctx.fillRect(0,0,180,216);ctx.strokeStyle='#b7b3a5';for(let i=-216;i<180;i+=12){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+216,216);ctx.stroke();}return c;}
 const k=Math.max(180/image.width,216/image.height)*zoom,w=image.width*k,h=image.height*k;
 ctx.translate(90,108);if(flip)ctx.scale(-1,1);ctx.drawImage(image,-w/2+x*(w-180)/2,-h/2+y*(h-216)/2,w,h);return c;
}
// Native sigil art is 200 square. The reused Card_0 / KeYinCard_10006
// pair measures 0.798 scale with origin (28.84,19.34): use the intended 0.8.
function sigilArtLayer(image,flip,zoom,x,y,nativeSigil){
 const square=surface(200,200),ctx=square.getContext('2d');
 if(nativeSigil){
  const k=Math.max(200/image.width,200/image.height)*zoom,w=image.width*k,h=image.height*k;
  ctx.translate(100,100);if(flip)ctx.scale(-1,1);ctx.drawImage(image,-w/2+x*Math.max(0,w-200)/2,-h/2+y*Math.max(0,h-200)/2,w,h);
 }else{
  const regular=artLayer(image,flip,zoom,x,y),w=144,h=172.8,l=28,t=19.2;
  // Extend only the edge pixels into the surrounding background; the subject
  // keeps its measured uniform scale and never stretches to the square.
  const xs=[0,l,l+w,200],ys=[0,t,t+h,200],sx=[0,0,179],sy=[0,0,215],sw=[1,180,1],sh=[1,216,1];
  for(let row=0;row<3;row++)for(let col=0;col<3;col++)ctx.drawImage(regular,sx[col],sy[row],sw[col],sh[row],xs[col],ys[row],xs[col+1]-xs[col],ys[row+1]-ys[row]);
 }
 return square;
}
export async function renderCard(canvas,state,catalog,base,uploads,scale=1){
 const [all,lexicon]=await Promise.all([json(new URL('native-assets.json',base).href),json(new URL('keywords.json',base).href)]);
 const text=state.autoStyle===false?state.text:markup(autoStyle(state.text,state.language,lexicon));
 const native=await loadNativeText(base,state.name+state.cn+text);
 const g=state.sigil?all[scale].sigil:all[scale],assets=new Map(),image=file=>loadImage(new URL(file,base).href),parts=[];
 let id=0;
 const leaf=im=>{const key='runtime-'+id++;assets.set(key,im);return ['i',key,im.width,im.height];};
 const getArt=async slot=>state[slot.toLowerCase()]==='upload'?(uploads[slot]?.image||null):image(catalog.cards.find(c=>c.id===state[slot.toLowerCase()]).image);
 const isSigilArt=slot=>catalog.cards.find(c=>c.id===state[slot.toLowerCase()])?.kind==='sigil';
 const [a,b]=await Promise.all([getArt('A'),state.fusion?getArt('B'):null]);
 let art=leaf(artLayer(a,state.flipA,state.zoomA,state.xA,state.yA,state.sigil,isSigilArt('A')));
 if(state.fusion){
  // Native putalpha replaces alpha after shifting, rather than multiplying it.
  // Bake this mutable fusion in JS before passing it to the shared compositor.
  const fused=bitmap(180,216);
  const masks=await Promise.all(catalog.fusion.masks.map(image)),divider=await image(catalog.fusion.line);
  const pixels=im=>{const c=surface(180,216);c.getContext('2d').drawImage(im,0,0,180,216);return c.getContext('2d').getImageData(0,0,180,216);};
  for(let i=0;i<2;i++){
   const slot=i?'B':'A',im=i?b:a,[x,y]=catalog.fusion.offsets[i],ix=Math.floor(x),iy=Math.floor(y),tile=pixels(artLayer(im,state['flip'+slot],state['zoom'+slot],state['x'+slot],state['y'+slot],state.sigil,isSigilArt(slot)));
   const shifted=resample(tile,180,216,1,1,x-ix,y-iy,'magic_kernel_shift_rgba'),layer=bitmap(180,216),mask=pixels(masks[i]);
   composite(layer,shifted,ix,iy);for(let k=3;k<layer.data.length;k+=4)layer.data[k]=mask.data[k];composite(fused,layer,0,0);
  }
  composite(fused,pixels(divider),0,0);
  const c=surface(180,216);c.getContext('2d').putImageData(new ImageData(fused.data,180,216),0,0);art=leaf(c);
 }
 const artTransform=state.sigil&&!state.fusion?[g.artTransform[0]*.9,g.artTransform[1]*1.08,...g.artTransform.slice(2)]:g.artTransform;
 parts.push([g.bleed,0,['t',...(state.sigil?g.size:[300*scale,508*scale]),...artTransform,art,'magic_kernel_sharp_resample_translate']]);
 const sheetBase=new URL('../card-components/',base),decorations=await json(new URL('decorations.json',sheetBase).href);
 const fixedRows=state.sigil?[g.frames[state.phase],state.mark!=='none'?g.marks[state.mark]:null,...g.dots[state.phase].slice(0,state.sigilValue),state.maxHp?g.hp[state.phase]:null]:[g.frames[state.phase+'-'+(state.dream?'dream':state.level)],!state.dream&&state.mark!=='none'?g.marks[state.mark]:null,state.language==='en'?g.titleBg:null,state.costType!=='none'?g.costs[state.costType][state.cost]:null];
 const sharedImage=async name=>{
  const d=decorations[name];if(!d)throw Error('Missing decoration: '+name);
  const [file,x,y,w,h]=d.rect,im=await loadImage(new URL(file,sheetBase).href),c=surface(w*scale,h*scale),ctx=c.getContext('2d');
  for(const [cx,cy,cw,ch] of d.cuts)ctx.drawImage(im,x+cx,y+cy,cw,ch,cx*scale,cy*scale,cw*scale,ch*scale);
  return {image:c,origin:d.origin.map(v=>v*scale)};
 };
 if(state.sigil){
  const artCanvas=Scene.renderPrepared(['g',...g.size,parts],assets),mask=await sharedImage('sigil-art-mask'),maskCanvas=surface(...g.size);
  maskCanvas.getContext('2d').drawImage(mask.image,...mask.origin);
  const ctx=artCanvas.getContext('2d');ctx.globalCompositeOperation='destination-in';ctx.drawImage(maskCanvas,0,0);ctx.globalCompositeOperation='source-over';
  parts.length=0;parts.push([0,0,leaf(artCanvas)]);
 }
 for(const row of fixedRows.filter(Boolean)){
  if(row.shared){const d=await sharedImage(row.shared),[x,y]=row.offset||[0,0];parts.push([x+d.origin[0],y+d.origin[1],leaf(d.image)]);}
  else parts.push([row[0],row[1],leaf(await image(row[2]))]);
 }
 if(state.sigil&&state.maxHp){
  const digits=await Promise.all(Array.from(String(state.maxHp),ch=>sharedImage('sigil-hp-digit-'+ch))),gap=scale,w=digits.reduce((n,d)=>n+d.image.width,0)+gap*(digits.length-1),h=Math.max(...digits.map(d=>d.image.height)),b=g.hpRect;
  let x=(b[0]+b[2]-w)/2;for(const d of digits){parts.push([x,(b[1]+b[3]-d.image.height)/2,leaf(d.image)]);x+=d.image.width+gap;}
 }
 const titleNative=state.sigil?await loadNativeText(base,state.language==='en'?state.name:state.cn,'huiwen'):null;
 const type=state.sigil?native.sigilLayers({...state,text},scale,titleNative):native.layers({...state,text},scale),toCanvas=im=>{const c=surface(im.width,im.height);c.getContext('2d').putImageData(new ImageData(im.data,im.width,im.height),0,0);return c;};
 for(const p of type.layers){let im=toCanvas(p.image);if(p.downsample){const small=surface(Math.max(1,Math.round(im.width/p.downsample)),Math.max(1,Math.round(im.height/p.downsample))),ctx=small.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(im,0,0,small.width,small.height);im=small;}parts.push([p.x,p.y,leaf(im)]);}
 let description=['g',...g.size,type.description.map(p=>[p.x,p.y,leaf(toCanvas(p.image))])];
 if(Math.abs(type.blockScale-1)>1e-6){const s=type.blockScale,[cx,cy]=type.blockCenter;description=['t',...g.size,s,s,cx*(1-s),cy*(1-s),description,'magic_kernel_sharp_resample_translate'];}
 parts.push([0,0,description]);
 const scene=['g',...g.size,parts],out=Scene.renderPrepared(scene,assets);
 canvas.width=out.width;canvas.height=out.height;canvas.getContext('2d').drawImage(out,0,0);
 return {overflow:type.overflow,missing:!a||(state.fusion&&!b)};
}
