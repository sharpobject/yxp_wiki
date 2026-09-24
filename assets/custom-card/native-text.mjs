import {round,richChars,NativeLayout} from './native-layout.mjs?v=af016d688cd37902';
const clamp=x=>Math.max(0,Math.min(255,round(x)));
export const PROBE='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789御空剑阵禦空劍陣防灵气靈氣造成伤害傷害卡组組再次行动動';
export function bitmap(w,h){return {width:w,height:h,data:new Uint8ClampedArray(w*h*4)};}
function color(hex){return hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16));}
export function composite(dst,src,x,y){
 x=round(x);y=round(y);const a=dst.data,b=src.data;
 for(let yy=Math.max(0,-y);yy<Math.min(src.height,dst.height-y);yy++)for(let xx=Math.max(0,-x);xx<Math.min(src.width,dst.width-x);xx++){
  const i=(yy*src.width+xx)*4,j=((yy+y)*dst.width+xx+x)*4,sa=b[i+3];if(!sa)continue;
  const da=a[j+3],alpha=sa+da*(255-sa)/255;
  for(let k=0;k<3;k++)a[j+k]=clamp((b[i+k]*sa+a[j+k]*da*(255-sa)/255)/alpha);
  a[j+3]=clamp(alpha);
 }
}
function crop(im,x,y,w,h){const out=bitmap(w,h);for(let row=0;row<h;row++)out.data.set(im.data.subarray(((row+y)*im.width+x)*4,((row+y)*im.width+x+w)*4),row*w*4);return out;}
export function bounds(im){let l=im.width,t=im.height,r=0,b=0;for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++)if(im.data[(y*im.width+x)*4+3]){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x+1);b=Math.max(b,y+1);}return r?[l,t,r,b]:null;}
function decode(plane){if(!plane.pixels)plane.pixels=Uint8Array.from(atob(plane[4]),c=>c.charCodeAt(0));return plane.pixels;}
function padPlane(p,n,fill=0){const [w,h,x,y]=p,a=new Uint8Array((w+2*n)*(h+2*n));a.fill(fill);const old=decode(p);for(let row=0;row<h;row++)a.set(old.subarray(row*w,(row+1)*w),(row+n)*(w+2*n)+n);const out=[w+2*n,h+2*n,x+n,y+n];out.pixels=a;return out;}
export function sample(p,w,h,ox=0,oy=0){
 const src=decode(p),sw=p[0],sh=p[1],out=new Uint8Array(w*h),sx=w/sw,sy=h/sh;
 for(let y=0;y<h;y++){const fy=(y+.5-oy)/sy-.5,y0=Math.floor(fy),vy=fy-y0,a=Math.max(0,Math.min(sh-1,y0)),b=Math.max(0,Math.min(sh-1,y0+1));
  for(let x=0;x<w;x++){const fx=(x+.5-ox)/sx-.5,x0=Math.floor(fx),vx=fx-x0,c=Math.max(0,Math.min(sw-1,x0)),d=Math.max(0,Math.min(sw-1,x0+1));out[y*w+x]=round((src[a*sw+c]*(1-vx)+src[a*sw+d]*vx)*(1-vy)+(src[b*sw+c]*(1-vx)+src[b*sw+d]*vx)*vy);}
 }return out;
}
function shader(sdf,w,h,mat,size,bold,faceDistance,outlineDistance,fill){
 const base=Math.max(1,mat.gradient_scale*size/30),ratio=mat.scale_ratio_a,soft=mat.outline_softness||0,weight=((bold?mat.weight_bold:mat.weight_normal)/4+mat.face_dilate)*ratio*.5;
 const fd=base*faceDistance/(1+soft*ratio*base*faceDistance),od=base*outlineDistance/(1+soft*ratio*base*outlineDistance),fb=(.5-weight)*fd-.5,ob=(.5-weight)*od-.5,fo=mat.outline_width*ratio*.5*fd,oo=mat.outline_width*ratio*.5*od;
 const face=bitmap(w,h),outline=mat.outline_width>0?bitmap(w,h):null,oc=mat.outline_color?.slice(0,3).map(v=>clamp(v*255))||[0,0,0];
 for(let i=0;i<sdf.length;i++){
  const p=i*4;face.data.set(fill,p);face.data[p+3]=clamp((sdf[i]/255*fd-fb-(mat.outline_width>0?fo:0))*255);
  if(outline){outline.data.set(oc,p);outline.data[p+3]=clamp((sdf[i]/255*od-ob+oo)*255);}
 }return {face,outline};
}
export class NativeText extends NativeLayout{
 line(input,size,{kind='body',spacing=0,shaderSize=size,language='en',phaseX=0,phaseY=0}={}){
  size=Math.max(1,round(size));shaderSize=Math.max(1,round(shaderSize));
  const isolated=kind!=='body',tag=language==='en'?'EN':'CJK',scale=size/this.m.pointSize,c=this.c,chars=typeof input==='string'?Array.from(input,char=>({char,bold:false,color:'#ffffff'})):input;
  const extra=isolated?Math.ceil(10*scale):0,pad=Math.max(4,round(size*.25))+extra,baseline=pad+round(27*scale),width=Math.max(1,round(this.width(chars.map(c=>c.char).join(''),size,spacing))+2*pad),height=Math.max(1,round(42*scale)+2*pad),out=bitmap(width,height);
  let cursor=pad;
  for(const item of chars){
   const ch=item.char,g=this.glyph(ch),bold=item.bold;
   if(ch===' '){cursor+=this.m.spaceAdvance*scale+spacing*.01*size;continue;}
   let p=g[4]?g[3]:g[3][isolated?(kind==='title'?'t':'v'):(bold?'b':'n')];
   if(g[4]&&isolated)p=padPlane(p,10);else if(g[4]&&bold)p=padPlane(p,Math.max(1,round(size*.05)),128);
   const mat=isolated?{...this.m.outline,face_dilate:c[(kind==='title'?'TITLE':'VERTICAL_NAME')+'_FACE_DILATE'],outline_width:c[(kind==='title'?'TITLE':'VERTICAL_NAME')+'_OUTLINE_WIDTH']}:{...this.m.body,face_dilate:c['DESC_FACE_DILATE_'+tag+'_'+(bold?'BOLD':'NORMAL')]};
   const prefix=kind==='title'?'TITLE':'VERTICAL_NAME',faceDistance=isolated?c[prefix+'_FACE_DISTANCE_SCALE']:c['DESC_SDF_DISTANCE_SCALE_'+tag+'_'+(bold?'BOLD':'NORMAL')],outlineDistance=isolated?c[prefix+'_OUTLINE_DISTANCE_SCALE']:faceDistance;
   const left=cursor+(g[1]-p[2])*scale,top=baseline-(g[2]+p[3])*scale,x=isolated?Math.floor(left+phaseX):round(left),y=isolated?Math.floor(top+phaseY):round(top);
   const w=Math.max(1,round(p[0]*scale)),h=Math.max(1,round(p[1]*scale)),pixels=sample(p,w,h,isolated?left+phaseX-x:0,isolated?top+phaseY-y:0);
   const fill=isolated?c.TITLE_FONT_COLOR.map((v,i)=>clamp(v*this.m.outline.face_color[i]*255)):color(item.color);
   const {face,outline}=shader(pixels,w,h,mat,shaderSize,bold,faceDistance,outlineDistance,fill);
   if(outline)composite(out,outline,x,y);composite(out,face,x,y);cursor+=g[0]*scale+spacing*.01*size;
  }
  return isolated&&width>extra*2&&height>extra*2?crop(out,extra,extra,width-2*extra,height-2*extra):out;
 }
 layers(state,scale=1){
  const c=this.c,offset=Math.ceil(3.6517858482*scale),box=a=>a.map((v,i)=>v*scale+(i%2===0?offset:0)),layers=[];
  const center=(text,size,kind,spacing,shaderSize,cx,y,height)=>{
   const opts={kind,spacing,shaderSize,language:state.language},probe=this.line(text,size,opts),xf=cx-probe.width/2,yf=y+(height-probe.height)/2,x=Math.floor(xf),yy=Math.floor(yf);
   layers.push({x,y:yy,image:this.line(text,size,{...opts,phaseX:xf-x,phaseY:yf-yy})});
  };
  const vb=box(c.VERTICAL_NAME_RECT),vs=Math.max(1,round(c.VERTICAL_NAME_FONT_SIZE_UI*this.m.uiScale[1]*scale)),slot=Math.max(1,c.VERTICAL_NAME_SLOT_HEIGHT_UI*vs/c.VERTICAL_NAME_FONT_SIZE_UI),gap=c.VERTICAL_NAME_LINE_GAP_UI*scale,chars=Array.from(state.cn),vh=chars.length*slot+Math.max(0,chars.length-1)*gap;
  let vy=vb[1]+Math.max(0,(vb[3]-vb[1]-vh)/2)+c.VERTICAL_NAME_OFFSET_Y_UI*scale;
  if(chars.length>=6)vy=Math.max(vy,vb[1]+Math.max(0,(vb[3]-vb[1]-(6*slot+5*gap))/2)+c.VERTICAL_NAME_OFFSET_Y_UI*scale);
  for(const char of chars){center(char,vs*c.VERTICAL_NAME_GLYPH_SCALE,'vertical',0,round(vs/scale*c.VERTICAL_NAME_GLYPH_SCALE),(vb[0]+vb[2])/2+c.VERTICAL_NAME_OFFSET_X_UI*scale,vy,slot);vy+=slot+gap;}
  let overflow=false;
  if(state.language==='en'){
   const fit=this.title(state.name,scale),b=box(c.titleRect);overflow=fit.overflow;let y=b[1]+Math.max(0,(b[3]-b[1]-fit.rows.length*fit.lineHeight)/2);
   for(const row of fit.rows){center(row,fit.size*c.TITLE_GLYPH_SCALE_EN,'title',fit.spacing,fit.size/scale*c.TITLE_GLYPH_SCALE_EN,(b[0]+b[2])/2,y,fit.lineHeight);y+=fit.lineHeight;}
  }
  const fit=this.description(state.text,state.language,scale),tag=state.language==='en'?'EN':'CJK',b=box(c['DESC_TEXT_DRAW_RECT_'+tag]),fontsize=Math.max(1,round(fit.size)),shaderSize=Math.max(1,round(fontsize/scale)),total=fit.rows.length?fit.firstHeight+(fit.rows.length-1)*fit.lineHeight+fit.rows.slice(0,-1).filter(r=>r.gap).length*fit.paragraphGap:0;
  const centerOffset=(b[3]-b[1]-total)/2;let y=b[1]+(centerOffset<0?centerOffset:Math.floor(centerOffset));
  const opts={spacing:c['DESC_CHARACTER_SPACING_'+tag],shaderSize,language:state.language},probe=this.line(richChars(PROBE),fontsize,opts),bb=bounds(probe),yoffset=bb?round((fit.lineHeight-(bb[3]-bb[1]))/2-bb[1]):0,description=[];
  for(const {row,gap} of fit.rows){const glyphScale=c['DESC_GLYPH_SCALE_'+tag],image=this.line(row,fontsize*glyphScale,{...opts,shaderSize:round(shaderSize*glyphScale)});description.push({x:round((b[0]+b[2])/2-image.width/2),y:round(y+yoffset),image});y+=fit.lineHeight+(gap?fit.paragraphGap:0);}
  return {layers,description,blockScale:c['DESC_BLOCK_SCALE_'+tag],blockCenter:[(b[0]+b[2])/2,(b[1]+b[3])/2],overflow:overflow||fit.overflow};
 }
}
const chunkCache=new Map();let metaPromise;
export async function loadNativeText(base,text){
 metaPromise??=fetch(new URL('native-font.json',base),{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Native font unavailable');return r.json();}).catch(e=>{metaPromise=null;throw e;});
 const meta=await metaPromise,groups=new Set(Array.from(text+PROBE+'\ufffd ',c=>Math.floor(c.codePointAt(0)/256))),glyphs={};
 await Promise.all([...groups].map(async n=>{
  const name=meta.chunks[n];if(!name)return;
  if(!chunkCache.has(n))chunkCache.set(n,fetch(new URL(name,base)).then(async r=>{if(!r.ok)throw Error('Native glyphs unavailable');return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();}).catch(e=>{chunkCache.delete(n);throw e;}));
  Object.assign(glyphs,await chunkCache.get(n));
 }));
 return new NativeText(meta,glyphs);
}
