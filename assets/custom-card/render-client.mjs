// Keep editable-card rasterization and PNG encoding off the UI thread.
export function loadImage(url){
 return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Image failed to load'));image.src=url;});
}
export function createRenderer(base,catalog){
 let worker,disabled=false,sequence=0;
 const pending=new Map();
 function stop(error){
  disabled=true;worker?.terminate();worker=null;
  for(const request of pending.values())request.reject(error);
  pending.clear();
 }
 function start(){
  if(!worker){
   worker=new Worker(new URL('./render-worker.mjs?v=62adc1c2209c2653',import.meta.url),{type:'module'});
   worker.onmessage=({data})=>{
    const request=pending.get(data.id);if(!request)return;
    pending.delete(data.id);
    data.error?request.reject(new Error(data.error)):request.resolve(data);
   };
   worker.onerror=event=>{event.preventDefault();stop(new Error(event.message||'Card worker unavailable'));};
   worker.onmessageerror=()=>stop(new Error('Card worker response unavailable'));
   worker.postMessage({type:'init',base:String(base),catalog});
  }
  return worker;
 }
 async function fallback(state,uploads,scale){
  const {renderCard}=await import('./render.mjs?v=62adc1c2209c2653');
  const canvas=document.createElement('canvas'),result=await renderCard(canvas,state,catalog,base,uploads,scale);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('Preview image could not be encoded');
  return {...result,blob,width:canvas.width,height:canvas.height};
 }
 return async function render(state,uploads={},scale=2){
  if(!disabled&&typeof Worker!=='undefined'&&typeof OffscreenCanvas!=='undefined'){
   try{
    const active=start(),id=++sequence,local={};
    // Upload URLs stay in this browser; no image is sent to a server.
    for(const slot of ['A','B'])if(uploads[slot])local[slot]={url:uploads[slot].url};
    return await new Promise((resolve,reject)=>{
     pending.set(id,{resolve,reject});
     try{active.postMessage({id,state,uploads:local,scale});}catch(error){pending.delete(id);reject(error);}
    });
   }catch(error){stop(error);}
  }
  return fallback(state,uploads,scale);
 };
}
