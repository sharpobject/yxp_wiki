import './scene-resample.mjs?v=fcc3e22a089f41a8';
import './scene-render.mjs?v=fcc3e22a089f41a8';
import {loadNativeText,bitmap,composite} from './native-text.mjs?v=fcc3e22a089f41a8';
import {autoStyle,markup} from './auto-style.mjs?v=fcc3e22a089f41a8';
const Scene=globalThis.CardScene,resample=globalThis.CardResample;
// Cache prepared pieces, not complete cards: changing text should not resample
// the artwork, and adjusting a crop should not rasterize the same text again.
const cache=new Map(),jsonCache=new Map(),artCache=new Map(),textCache=new Map(),descriptionCache=new Map(),decorationCache=new Map();
function memo(map,key,create,limit){
 if(map.has(key)){const value=map.get(key);map.delete(key);map.set(key,value);return value;}
 const promise=Promise.resolve().then(create).catch(error=>{if(map.get(key)===promise)map.delete(key);throw error;});
 map.set(key,promise);while(map.size>limit)map.delete(map.keys().next().value);return promise;
}
export function loadImage(url){
 return memo(cache,String(url),()=>typeof Image==='undefined'
  ?fetch(url).then(r=>{if(!r.ok)throw new Error('Image failed to load');return r.blob();}).then(blob=>createImageBitmap(blob))
  :new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Image failed to load'));im.src=url;}),32);
}
const surface=(w,h)=>Scene.surface(w,h);
function json(url){return memo(jsonCache,url,()=>fetch(url,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Card data unavailable');return r.json();}),16);}
const imageIds=new WeakMap();let imageSequence=0;
function imageId(image){if(!image)return 0;if(!imageIds.has(image))imageIds.set(image,++imageSequence);return imageIds.get(image);}
function toCanvas(im){const c=surface(im.width,im.height);c.getContext('2d').putImageData(new ImageData(im.data,im.width,im.height),0,0);return c;}
function preparedScene(){
 const assets=new Map();let id=0;
 return {assets,leaf(image){const key='runtime-'+id++;assets.set(key,image);return ['i',key,image.width,image.height];}};
}
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
 const image=file=>loadImage(new URL(file,base).href),sheetBase=new URL('../card-components/',base);
 const geometry=json(new URL('native-assets.json',base).href).then(all=>state.sigil?all[scale].sigil:all[scale]);
 const decorations=json(new URL('decorations.json',sheetBase).href);
 const sharedImage=name=>memo(decorationCache,JSON.stringify([sheetBase.href,scale,name]),async()=>{
  const d=(await decorations)[name];if(!d)throw Error('Missing decoration: '+name);
  const [file,x,y,w,h]=d.rect,im=await loadImage(new URL(file,sheetBase).href),c=surface(w*scale,h*scale),ctx=c.getContext('2d');
  for(const [cx,cy,cw,ch] of d.cuts)ctx.drawImage(im,x+cx,y+cy,cw,ch,cx*scale,cy*scale,cw*scale,ch*scale);
  return {image:c,origin:d.origin.map(v=>v*scale)};
 },16);
 const getArt=async slot=>{
  if(state[slot.toLowerCase()]!=='upload')return image(catalog.cards.find(c=>c.id===state[slot.toLowerCase()]).image);
  return uploads[slot]?.image||(uploads[slot]?.url?loadImage(uploads[slot].url):null);
 };
 const isSigilArt=slot=>catalog.cards.find(c=>c.id===state[slot.toLowerCase()])?.kind==='sigil';
 const artPromise=Promise.all([geometry,getArt('A'),state.fusion?getArt('B'):null]).then(async([g,a,b])=>{
  const slotKey=slot=>[imageId(slot==='A'?a:b),state['flip'+slot],state['zoom'+slot],state['x'+slot],state['y'+slot],isSigilArt(slot)];
  const key=JSON.stringify([String(base),scale,state.sigil,state.fusion,slotKey('A'),state.fusion?slotKey('B'):null,g.size,g.artTransform,g.bleed,state.fusion?catalog.fusion:null]);
  const prepared=await memo(artCache,key,async()=>{
   const {assets,leaf}=preparedScene();
   let art=leaf(artLayer(a,state.flipA,state.zoomA,state.xA,state.yA,state.sigil,isSigilArt('A')));
   if(state.fusion){
    // Native putalpha replaces alpha after shifting, rather than multiplying it.
    const fused=bitmap(180,216),[masks,divider]=await Promise.all([Promise.all(catalog.fusion.masks.map(image)),image(catalog.fusion.line)]);
    const pixels=im=>{const c=surface(180,216);c.getContext('2d').drawImage(im,0,0,180,216);return c.getContext('2d').getImageData(0,0,180,216);};
    for(let i=0;i<2;i++){
     const slot=i?'B':'A',im=i?b:a,[x,y]=catalog.fusion.offsets[i],ix=Math.floor(x),iy=Math.floor(y),tile=pixels(artLayer(im,state['flip'+slot],state['zoom'+slot],state['x'+slot],state['y'+slot],state.sigil,isSigilArt(slot)));
     const shifted=resample(tile,180,216,1,1,x-ix,y-iy,'magic_kernel_shift_rgba'),layer=bitmap(180,216),mask=pixels(masks[i]);
     composite(layer,shifted,ix,iy);for(let k=3;k<layer.data.length;k+=4)layer.data[k]=mask.data[k];composite(fused,layer,0,0);
    }
    composite(fused,pixels(divider),0,0);art=leaf(toCanvas(fused));
   }
   const artTransform=state.sigil&&!state.fusion?[g.artTransform[0]*.9,g.artTransform[1]*1.08,...g.artTransform.slice(2)]:g.artTransform;
   const transformed=['t',...(state.sigil?g.size:[300*scale,508*scale]),...artTransform,art,'magic_kernel_sharp_resample_translate'];
   if(!state.sigil)return {x:g.bleed,y:0,image:Scene.renderPrepared(transformed,assets)};
   const artCanvas=Scene.renderPrepared(['g',...g.size,[[g.bleed,0,transformed]]],assets),mask=await sharedImage('sigil-art-mask'),maskCanvas=surface(...g.size);
   maskCanvas.getContext('2d').drawImage(mask.image,...mask.origin);
   const ctx=artCanvas.getContext('2d');ctx.globalCompositeOperation='destination-in';ctx.drawImage(maskCanvas,0,0);ctx.globalCompositeOperation='source-over';
   return {x:0,y:0,image:artCanvas};
  },8);
  return {...prepared,missing:!a||(state.fusion&&!b)};
 });
 const fixedPromise=geometry.then(async g=>{
  const rows=(state.sigil?[g.frames[state.phase],state.mark!=='none'?g.marks[state.mark]:null,...g.dots[state.phase].slice(0,state.sigilValue),state.maxHp?g.hp[state.phase]:null]:[g.frames[state.phase+'-'+(state.dream?'dream':state.level)],!state.dream&&state.mark!=='none'?g.marks[state.mark]:null,state.language==='en'?g.titleBg:null,state.costType!=='none'?g.costs[state.costType][state.cost]:null]).filter(Boolean);
  const [fixed,digits]=await Promise.all([
   Promise.all(rows.map(async row=>{
    if(row.shared){const d=await sharedImage(row.shared),[x,y]=row.offset||[0,0];return {x:x+d.origin[0],y:y+d.origin[1],image:d.image};}
    return {x:row[0],y:row[1],image:await image(row[2])};
   })),
   state.sigil&&state.maxHp?Promise.all(Array.from(String(state.maxHp),ch=>sharedImage('sigil-hp-digit-'+ch))):null
  ]);
  if(digits){
   const gap=scale,w=digits.reduce((n,d)=>n+d.image.width,0)+gap*(digits.length-1),b=g.hpRect;
   let x=(b[0]+b[2]-w)/2;for(const d of digits){fixed.push({x,y:(b[1]+b[3]-d.image.height)/2,image:d.image});x+=d.image.width+gap;}
  }
  return fixed;
 });
 const textKey=JSON.stringify([String(base),scale,state.sigil,state.language,state.name,state.cn,state.text,state.autoStyle!==false]);
 const textPromise=memo(textCache,textKey,async()=>{
  const text=state.autoStyle===false?state.text:markup(autoStyle(state.text,state.language,await json(new URL('keywords.json',base).href)));
  const [g,native,titleNative]=await Promise.all([geometry,loadNativeText(base,state.name+state.cn+text),state.sigil?loadNativeText(base,state.language==='en'?state.name:state.cn,'huiwen'):null]);
  const type=state.sigil?native.sigilLayers({...state,text},scale,titleNative):native.layers({...state,text},scale);
  const layers=type.layers.map(p=>{
   let im=toCanvas(p.image);if(p.downsample){const small=surface(Math.max(1,Math.round(im.width/p.downsample)),Math.max(1,Math.round(im.height/p.downsample))),ctx=small.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(im,0,0,small.width,small.height);im=small;}
   return {x:p.x,y:p.y,image:im};
  });
  // Name edits change title pixels but leave the costly full-card description
  // transform unchanged. Share that surface across separate text-cache entries.
  const description=await memo(descriptionCache,JSON.stringify([String(base),scale,state.sigil,state.language,text]),()=>{
   const layers=type.description.map(p=>({x:p.x,y:p.y,image:toCanvas(p.image)}));
   if(Math.abs(type.blockScale-1)>1e-6){
    const {assets,leaf}=preparedScene(),s=type.blockScale,[cx,cy]=type.blockCenter;
    const scene=['t',...g.size,s,s,cx*(1-s),cy*(1-s),['g',...g.size,layers.map(p=>[p.x,p.y,leaf(p.image)])],'magic_kernel_sharp_resample_translate'];
    return [{x:0,y:0,image:Scene.renderPrepared(scene,assets)}];
   }
   return layers;
  },8);
  return {layers,description,overflow:type.overflow};
 },12);
 // Every dependency is started before awaiting any one path. Keep the same
 // composition order and native 2x pixels while reusing immutable surfaces.
 const [g,art,fixed,type]=await Promise.all([geometry,artPromise,fixedPromise,textPromise,decorations]);
 const {assets,leaf}=preparedScene(),parts=[art,...fixed,...type.layers].map(p=>[p.x,p.y,leaf(p.image)]);
 parts.push([0,0,['g',...g.size,type.description.map(p=>[p.x,p.y,leaf(p.image)])]]);
 const out=Scene.renderPrepared(['g',...g.size,parts],assets);
 canvas.width=out.width;canvas.height=out.height;canvas.getContext('2d').drawImage(out,0,0);
 return {overflow:type.overflow,missing:art.missing};
}
