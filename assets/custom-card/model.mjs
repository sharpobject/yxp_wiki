export const defaults = {name:'Cloud Sword - Reverie',cn:'梦中云剑',text:'[color:#9D1022|6] ATK\nGain 1 Sword Intent.',phase:3,level:0,dream:false,mark:'SectBottom_1',costType:'qi',cost:1,language:'en',fusion:false,a:'1000001',b:'1000011',flipA:false,flipB:false,zoomA:1,zoomB:1,xA:0,xB:0,yA:0,yB:0};
export function normalize(input,catalog){
 const result={...defaults},issues=[];
 const ids=new Set(catalog.cards.map(c=>c.id));
 for(const key of ['name','cn','text']) if(typeof input[key]==='string')result[key]=input[key].slice(0,key==='text'?600:key==='cn'?30:100);
 for(const key of ['dream','fusion','flipA','flipB']) if(key in input)result[key]=input[key]===true||input[key]==='1';
 for(const [key,min,max] of [['phase',1,6],['level',0,2],['cost',0,99],['zoomA',1,3],['zoomB',1,3],['xA',-1,1],['xB',-1,1],['yA',-1,1],['yB',-1,1]]){
  if(!(key in input))continue;const n=Number(input[key]);if(Number.isFinite(n))result[key]=Math.min(max,Math.max(min,['phase','level','cost'].includes(key)?Math.round(n):n));else issues.push(key);
 }
 for(const key of ['a','b']){
  const value=key in input?input[key]:result[key];
  if(ids.has(value)||value==='upload')result[key]=value;
  else {result[key]=catalog.cards[0].id;issues.push(key);}
 }
 if(input.language==='zh'||input.language==='en')result.language=input.language;
 if(['none','qi','hp'].includes(input.costType))result.costType=input.costType;
 if(input.mark==='none'||Object.hasOwn(catalog.marks,input.mark))result.mark=input.mark;
 return {state:result,issues};
}
export function decode(search,catalog){
 const p=new URLSearchParams(search);
 if(p.has('v')&&p.get('v')!=='1')return {state:normalize({},catalog).state,issues:['version']};
 return normalize(Object.fromEntries(p),catalog);
}
export function encode(state,{view=true}={}){
 const p=new URLSearchParams({v:'1'});
 for(const key of Object.keys(defaults)){
  const value=state[key];
  p.set(key,typeof value==='boolean'?(value?'1':'0'):String(value));
 }
 if(view)p.set('view','1');
 return p.toString();
}
