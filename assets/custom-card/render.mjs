const cache=new Map();
export function loadImage(url){
 if(!cache.has(url))cache.set(url,new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{cache.delete(url);reject(new Error('Image failed to load'));};im.src=url;}));
 return cache.get(url);
}
function surface(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
export function richChars(text,color='#26211c'){
 const out=[];const pattern=/\[color:(#[0-9a-fA-F]{6})\|([^\]]*)\]|\[b\|([^\]]*)\]/g;let last=0;
 function add(s,c=color,bold=false){for(const char of s)out.push({char,color:c,bold});}
 for(const m of text.matchAll(pattern)){add(text.slice(last,m.index));add(m[2]??m[3],m[1]??color,!!m[3]);last=m.index+m[0].length;}
 add(text.slice(last));return out;
}
function textBlock(ctx,text,box,{max=23,min=9,color='#26211c',line=1.24}={}){
 let lines,size;const chars=richChars(text,color);
 const font=(c,n)=> (c.bold?'bold ':'')+n+'px YxpCard, serif';
 for(size=max;size>=min;size--){
  lines=[[]];let width=0;
  for(const c of chars){
   if(c.char==='\n'){lines.push([]);width=0;continue;}
   ctx.font=font(c,size);const cw=ctx.measureText(c.char).width;
   if(width+cw>box[2]&&lines.at(-1).length){
    const old=lines.at(-1),space=old.map(x=>x.char).lastIndexOf(' ');
    const carry=space>0?old.splice(space+1):[];
    if(space>0)old.pop();
    lines.push(carry);width=carry.reduce((sum,x)=>{ctx.font=font(x,size);return sum+ctx.measureText(x.char).width;},0);
   }
   lines.at(-1).push(c);width+=cw;
  }
  if(lines.length*size*line<=box[3])break;
 }
 size=Math.max(min,size);ctx.save();ctx.beginPath();ctx.rect(...box);ctx.clip();ctx.textBaseline='middle';ctx.textAlign='left';
 let y=box[1]+(box[3]-lines.length*size*line)/2+size*line/2;
 if(lines.length*size*line>box[3])y=box[1]+size*line/2;
 for(const row of lines){
  const widths=row.map(c=>{ctx.font=font(c,size);return ctx.measureText(c.char).width;});
  let x=box[0]+(box[2]-widths.reduce((a,b)=>a+b,0))/2;
  row.forEach((c,i)=>{ctx.font=font(c,size);ctx.fillStyle=c.color;ctx.fillText(c.char,x,y);x+=widths[i];});y+=size*line;
 }
 ctx.restore();return lines.length*size*line>box[3];
}
function artLayer(image,w,h,flip,zoom,x,y){
 const c=surface(w,h),ctx=c.getContext('2d');
 if(!image){
  ctx.fillStyle='#ddd9cb';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#b7b3a5';ctx.lineWidth=2;
  for(let i=-h;i<w;i+=24){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+h,h);ctx.stroke();}
  return c;
 }
 const scale=Math.max(w/image.width,h/image.height)*zoom,iw=image.width*scale,ih=image.height*scale;
 ctx.translate(w/2,h/2);if(flip)ctx.scale(-1,1);
 ctx.drawImage(image,-iw/2+x*(iw-w)/2,-ih/2+y*(ih-h)/2,iw,ih);
 return c;
}
export async function renderCard(canvas,state,catalog,base,uploads){
 const image=file=>loadImage(new URL(file,base).href),g=catalog.geometry;
 const getArt=async slot=>state[slot.toLowerCase()]==='upload'?(uploads[slot]?.image||null):image(catalog.cards.find(c=>c.id===state[slot.toLowerCase()]).image);
 const [a,b,frame,titleBg,mark,cost,...fusion]=await Promise.all([
  getArt('A'),state.fusion?getArt('B'):null,image(catalog.frames[state.phase+'-'+(state.dream?'dream':state.level)]),
  state.language==='en'?image(catalog.titleBg):null,
  !state.dream&&state.mark!=='none'&&catalog.marks[state.mark]?image(catalog.marks[state.mark]):null,
  state.costType!=='none'?image(catalog.costs[state.costType]):null,
  ...(state.fusion?[...catalog.fusion.masks,catalog.fusion.line].map(image):[])
 ]);
 const out=surface(616,1016),ctx=out.getContext('2d');ctx.scale(2,2);ctx.translate(4,0);
 const [w,h]=catalog.fusion.size;
 let art=artLayer(a,w,h,state.flipA,state.zoomA,state.xA,state.yA);
 if(state.fusion){
  const combined=surface(w,h),cc=combined.getContext('2d');
  [a,b].forEach((im,i)=>{
   const s=i?'B':'A',layer=surface(w,h),lc=layer.getContext('2d');
   lc.drawImage(artLayer(im,w,h,state['flip'+s],state['zoom'+s],state['x'+s],state['y'+s]),...catalog.fusion.offsets[i]);
   lc.globalCompositeOperation='destination-in';lc.drawImage(fusion[i],0,0,w,h);cc.drawImage(layer,0,0);
  });
  cc.drawImage(fusion[2],0,0,w,h);art=combined;
 }
 ctx.drawImage(art,...g.art);ctx.drawImage(frame,0,0,300,508);
 if(mark){ctx.globalAlpha=.59;ctx.drawImage(mark,...g.mark);ctx.globalAlpha=1;}
 if(titleBg){ctx.save();ctx.beginPath();ctx.rect(0,0,300,508);ctx.clip();ctx.drawImage(titleBg,...g.titleBg);ctx.restore();}
 if(cost)ctx.drawImage(cost,-4,0,308,508);
 let overflow=false;
 if(state.language==='en')overflow=textBlock(ctx,state.name,g.title,{max:24,min:10,color:'#fff',line:1.06});
 const chars=Array.from(state.cn),[vx,vy,vw,vh]=g.vertical,vs=Math.min(29,vh/Math.max(chars.length,1));
 ctx.font=vs+'px YxpCard, serif';ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.strokeStyle='#30302e';ctx.lineWidth=1.8;
 chars.forEach((c,i)=>{const y=vy+vs*(i+.5);ctx.strokeText(c,vx+vw/2,y);ctx.fillText(c,vx+vw/2,y);});
 overflow=textBlock(ctx,state.text,state.language==='zh'?g.rulesZh:g.rules,{max:state.language==='zh'?25:22})||overflow;
 if(cost){ctx.font='bold 33px YxpCard, serif';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.strokeStyle='#30302e';ctx.lineWidth=2.3;const [x,y,w,h]=g.cost;ctx.strokeText(String(state.cost),x+w/2,y+h/2);ctx.fillText(String(state.cost),x+w/2,y+h/2);}
 canvas.width=out.width;canvas.height=out.height;canvas.getContext('2d').drawImage(out,0,0);
 return {overflow,missing:(!a)||(state.fusion&&!b)};
}
