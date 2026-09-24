// Port of native TMP layout. Keep these metrics independent of browser fonts.
export const round=x=>{const n=Math.floor(x),f=x-n;return f===.5?(n%2?n+1:n):Math.round(x);};
export const BODY='#3d3935';
const colors=new Map([['Continuous','#b21d81'],['持续','#b21d81'],['持續','#b21d81'],['Consumption','#b21d81'],['消耗','#b21d81'],['Injured','#9d1022'],['击伤','#9d1022'],['擊傷','#9d1022'],['Chase','#378e89'],['再次行动','#378e89'],['再次行動','#378e89'],['Growth','#527e1d'],['成长','#527e1d'],['成長','#527e1d']]);
export function richChars(text,parseMarkup=true){
 if(parseMarkup)text=text.replace(/<(?:color=)?#([a-f\d]{6})>(.*?)<\/color>/gis,(_,c,t)=>'[color:#'+c+'|'+t.replace(/<\/?(?:size|i)(?:=[^>]+)?>/g,'').replace(/^\[([^\]]*)\]$/,'$1')+']').replace(/<\/?(?:color|size|i)(?:=[^>]+)?>/g,'');
 const out=[];let quoted=false;
 for(const token of text.match(parseMarkup?/\[[^\]]+\]|\d+|[A-Za-z]+|\s+|./gu:/\d+|[A-Za-z]+|\s+|./gu)||[]){
  if(token==='"')quoted=!quoted;
  let value=token,bold=false,color=quoted?BODY:(colors.get(token)||BODY);
  if(parseMarkup&&token.startsWith('[')&&token.endsWith(']')){
   const inner=token.slice(1,-1);
   const explicit=inner.match(/^style:(#[a-f\d]{6}):(b|n)\|([\s\S]*)$/i);
   if(explicit){for(const char of explicit[3])out.push({char,bold:explicit[2]==='b',color:explicit[1].toLowerCase()});continue;}
   if(inner.startsWith('plain|')){for(const char of inner.slice(6))out.push({char,bold:false,color:BODY});continue;}
   const m=inner.match(/^color:(#[a-f\d]{6})\|([\s\S]*)$/i);
   if(m){color=m[1].toLowerCase();value=m[2];}
   else if(inner.startsWith('b|')){value=inner.slice(2);bold=true;color=colors.get(value)||BODY;}
   else if(inner.startsWith('quote:')){value=inner.split('|').slice(1).join('|');color=BODY;}
   else {value=inner.includes('|')?inner.split('|')[0]:inner;const keyword=inner.includes('|')?inner.split('|').slice(1).join('|'):inner;bold=true;color=colors.get(keyword)||BODY;}
  }
  for(const char of value)out.push({char,bold,color});
 }
 return out;
}
const space=c=>!!c&&/^\s$/u.test(c.char);
const trim=a=>{let l=0,h=a.length;while(l<h&&space(a[l]))l++;while(h>l&&space(a[h-1]))h--;return a.slice(l,h);};
export class NativeLayout{
 constructor(meta,glyphs){this.m=meta;this.c=meta.constants;this.glyphs=glyphs;this.leading=new Set(this.c.TMP_LINE_BREAK_LEADING_CHARACTERS);this.following=new Set(this.c.TMP_LINE_BREAK_FOLLOWING_CHARACTERS);}
 glyph(c){return this.glyphs[c]||this.m.missing||this.glyphs['\ufffd'];}
 advance(c,size){return (c===' '?this.m.spaceAdvance:this.glyph(c)[0])*size/this.m.pointSize;}
 width(text,size,spacing=0){const chars=Array.from(text);return chars.reduce((w,c)=>w+this.advance(c,size),0)+Math.max(0,chars.length-1)*spacing*.01*size;}
 rowWidth(row,size,spacing){return row.reduce((w,c)=>w+this.advance(c.char,size)+(c.char===' '&&c.bold?this.c.DEFAULT_FONT_BOLD_SPACE_EXTRA_ADVANCE*size/30:0),0)+Math.max(0,row.length-1)*spacing*.01*size;}
 lineHeight(size,spacing){return Math.max(1,this.m.lineHeight*size/this.m.pointSize+spacing*size*.01);}
 canBreak(c,next){if(!c||space(c))return false;const a=c.char,b=next?.char||'';if(a==='-'&&/[\p{L}\p{N}]/u.test(b))return true;if(this.leading.has(a)||this.following.has(b))return false;const n=a.codePointAt(0);return [[0x1100,0x1200],[0xa960,0xa980],[0xac00,0xd7a0],[0x2e80,0xa000],[0xf900,0xfb00],[0xfe30,0xfe50],[0xff00,0xfff0]].some(([l,h])=>n>l&&n<h);}
 wrap(line,maxWidth,size,spacing,epsilon=0){
  const chars=richChars(line),rows=[];let row=[],emit=-1,carry=-1,width=0;const gap=spacing*.01*size;
  const save=(a,b)=>{emit=a;carry=b;};
  const rebuild=()=>{emit=carry=-1;row.forEach((c,i)=>{if(space(c))save(i,i+1);else if(this.canBreak(c,row[i+1]))save(i+1,i+1);});};
  for(let i=0;i<chars.length;i++){
   const c=chars[i],cw=this.rowWidth([c],size,spacing);
   const overflow=()=>{const w=width+(row.length?gap:0)+cw,hyphen=emit>0&&row[emit-1]?.char==='-';return hyphen&&w>maxWidth-this.c.TMP_HYPHEN_BREAK_MARGIN_UI||w>maxWidth+.0001&&(w>maxWidth+epsilon||hyphen);};
   while(row.length&&!space(c)&&overflow()){
    const emitted=trim(emit>=0?row.slice(0,emit):row);if(emitted.length)rows.push(emitted);
    row=emit>=0?row.slice(carry):[];width=this.rowWidth(row,size,spacing);rebuild();
   }
   if(!row.length&&space(c))continue;
   width+=(row.length?gap:0)+cw;row.push(c);
   if(space(c))save(row.length-1,row.length);else if(this.canBreak(c,chars[i+1]))save(row.length,row.length);
  }
  if(row.length)rows.push(trim(row));return rows.filter(r=>r.length).length?rows.filter(r=>r.length):[[]];
 }
 description(text,lang,scale=1){
  const c=this.c,en=lang==='en',tag=en?'EN':'CJK',box=c['DESC_LAYOUT_RECT_'+tag],spacing=c['DESC_LAYOUT_CHARACTER_SPACING_EN']*(en?1:0)+(en?0:c.DESC_CHARACTER_SPACING_CJK);
  const max=en?c.DESC_FONT_SIZE_MAX_EN_UI:c.DESC_FONT_SIZE_MAX_UI,min=c.DESC_FONT_SIZE_MIN_UI,width=(box[2]-box[0]-2*c.DESC_WRAP_INSET_X)*scale,height=(box[3]-box[1])*scale,epsilon=en?c.TMP_WRAP_WIDTH_EPSILON:0;
  let lo=min,hi=max,ui=max,result;
  const lines=text?text.split(/\r\n|[\n\r\v\f\u001c-\u001e\u0085\u2028\u2029]/u):[];if(lines.at(-1)===''&&text)lines.pop();
  for(let it=0;it<=20;it++){
   const size=Math.max(1,ui*this.m.uiScale[1]*scale),rows=lines.flatMap((line,i)=>{const wrapped=this.wrap(line,width,size,spacing,epsilon);return wrapped.map((row,j)=>({row,gap:i<lines.length-1&&j===wrapped.length-1}));});
   const lineHeight=this.lineHeight(size,c['DESC_LINE_SPACING_'+tag]),firstHeight=this.m.lineHeight*size/this.m.pointSize*c['DESC_LAYOUT_LINE_HEIGHT_SCALE_'+tag],paragraphGap=Math.max(0,c.DESC_PARAGRAPH_SPACING*size*.01);
   const total=rows.length?firstHeight+(rows.length-1)*lineHeight+rows.slice(0,-1).filter(r=>r.gap).length*paragraphGap:0;
   const overflow=total>height+.0001||Math.max(0,...rows.map(r=>this.rowWidth(r.row,size,spacing)))>width+(en?epsilon:.0001);
   result={size,rows,lineHeight,firstHeight,paragraphGap,spacing,overflow};
   if(it===20)break;
   if(overflow){if(ui<=min)break;hi=ui;ui=Math.max(Math.floor((ui-Math.max((ui-lo)/2,.05))*20+.5)/20,min);}
   else if(hi-lo>.051&&ui<max){lo=ui;ui=Math.min(Math.floor((ui+Math.max((hi-ui)/2,.05))*20+.5)/20,max);}
   else break;
  }
  return result;
 }
 title(text,scale=1){
  const c=this.c,b=c.titleRect,w=(b[2]-b[0])*scale,h=(b[3]-b[1])*scale,spacing=c.TITLE_CHARACTER_SPACING_EN;
  const attempt=size=>{const words=text.split(' '),rows=[];let row=words[0];for(const word of words.slice(1)){const next=row+' '+word;if(round(this.width(next,size,spacing))<=w)row=next;else{rows.push(row);row=word;}}rows.push(row);const lineHeight=this.lineHeight(size,c.TITLE_LINE_SPACING);return {size,rows,lineHeight,spacing,overflow:rows.length*lineHeight>h||Math.max(...rows.map(r=>this.width(r,size,spacing)))>w};};
  let lo=Math.max(1,c.TITLE_FONT_SIZE_MIN_UI*this.m.uiScale[1]*scale),hi=Math.max(1,c.TITLE_FONT_SIZE_MAX_UI*this.m.uiScale[1]*scale),best=attempt(hi);if(!best.overflow)return best;best=attempt(lo);
  for(let i=0;i<14;i++){const mid=(lo+hi)/2,r=attempt(mid);if(r.overflow)hi=mid;else{best=r;lo=mid;}}return best;
 }
}
