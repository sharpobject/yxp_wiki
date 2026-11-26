import {renderCard} from './render.mjs?v=32ca270e2756c9d2';
let catalog,base;
self.onmessage=async({data})=>{
 if(data.type==='init'){catalog=data.catalog;base=new URL(data.base);return;}
 try{
  const canvas=new OffscreenCanvas(1,1);
  const result=await renderCard(canvas,data.state,catalog,base,data.uploads,data.scale);
  const blob=await canvas.convertToBlob({type:'image/png'});
  self.postMessage({id:data.id,...result,blob,width:canvas.width,height:canvas.height});
 }catch(error){self.postMessage({id:data.id,error:error.message||String(error)});}
};
