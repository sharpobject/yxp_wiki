import {defaults,decode,encode,normalize} from './model.mjs?v=16a1f4162c40880b';
import {renderCard,loadImage} from './render.mjs?v=16a1f4162c40880b';
import {richChars} from './native-layout.mjs?v=16a1f4162c40880b';
const root=document.querySelector('#card-studio'),ui=root.dataset.language,t=(en,zh)=>ui==='zh'?zh:en;
const base=new URL('./',import.meta.url),$=s=>root.querySelector(s);
let catalog,state,view=new URLSearchParams(location.search).get('view')==='1',uploads={},undo=[],redo=[],renderSerial=0,pickerSlot='A',libraryLimit=60;
const initialSearch=location.search;let drawTimer;
function scheduleDraw(){clearTimeout(drawTimer);renderSerial++;$('#preview').dataset.ready='false';$('#download').disabled=true;drawTimer=setTimeout(draw,80);}
const field=(label,name,extra='')=>'<label class="field">'+label+'<input data-field="'+name+'" '+extra+'></label>';
const select=(label,name,options)=>'<label class="field">'+label+'<select data-field="'+name+'">'+options.map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('')+'</select></label>';
function slot(s){
 return '<div class="art-slot" id="slot-'+s+'"><div class="art-slot-head"><img class="art-thumb" alt=""><div><strong>'+t('Artwork ','画作 ')+s+'</strong><small class="art-name"></small></div></div><div class="art-buttons"><button type="button" data-browse="'+s+'">'+t('Choose art','选择画作')+'</button><button type="button" data-upload="'+s+'">'+t('Upload','上传')+'</button><input type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" data-file="'+s+'"></div><label class="studio-toggle"><input type="checkbox" data-field="flip'+s+'">'+t('Flip horizontally · Dream','水平翻转 · 梦')+'</label><details><summary>'+t('Adjust crop','调整裁剪')+'</summary>'+[['zoom',t('Zoom','缩放'),1,3],['x',t('Horizontal','水平'),-1,1],['y',t('Vertical','垂直'),-1,1]].map(([key,label,min,max])=>'<label class="crop-field">'+label+'<input aria-label="'+label+' '+s+'" data-field="'+key+s+'" type="range" min="'+min+'" max="'+max+'" step=".01"></label>').join('')+'</details></div>';
}
function status(message){$('#studio-status').textContent=message;}
function buildUI(){
 root.innerHTML='<div class="studio-heading"><div><p class="eyebrow">'+t('Imagine · Compose · Share','想象 · 创作 · 分享')+'</p><h1>'+t('Custom card studio','自定义卡牌工坊')+'</h1><p>'+t('A card that could have been. Make it yours.','把灵感化为一张属于你的卡牌。')+'</p></div><div class="studio-actions"><button id="edit-view" hidden>'+t('Remix this card','编辑这张卡牌')+'</button><button id="download" disabled>'+t('Download PNG','下载 PNG')+'</button><button class="primary" id="share" disabled>'+t('Copy share link','复制分享链接')+'</button></div></div>'+
 '<p id="studio-status" class="studio-status" role="status" aria-live="polite"></p><input class="share-url" id="share-url" aria-label="'+t('Share link','分享链接')+'" readonly hidden><div id="warning" class="studio-warning" role="status" hidden></div>'+
 '<div class="studio-grid"><aside class="studio-preview"><span class="preview-label">'+t('Your creation','你的作品')+'</span><canvas id="preview" width="616" height="1016" role="img" aria-label="'+t('Custom card preview','自定义卡牌预览')+'"></canvas><p>'+t('Fan-made card · Yi Xian Pai','弈仙牌 · 同人卡牌')+'</p></aside><div class="studio-editor">'+
 '<section class="studio-panel"><h2><span class="step">01</span>'+t('Card text','卡牌文字')+'</h2><div class="panel-content studio-fields">'+field(t('English name','英文名'),'name','maxlength="100"')+field(t('Chinese name · vertical','中文名 · 竖排'),'cn','maxlength="30"')+
 '<label class="field span-two">'+t('Rules text','效果描述')+'<textarea data-field="text" maxlength="600" rows="4"></textarea></label><div class="span-two"><div class="studio-format"><input type="color" id="text-color" value="#9d1022" aria-label="Text color"><button data-format="color">'+t('Apply color','应用颜色')+'</button><button data-format="bold">'+t('Bold text','加粗文字')+'</button><button data-format="plain">'+t('Plain text','普通文字')+'</button></div><label class="studio-toggle"><input type="checkbox" data-field="autoStyle">'+t('Automatically style game keywords and stats','自动标注游戏关键词与数值')+'</label><p class="hint">'+t('Select text, then apply a style. Explicit styles override automatic formatting. Line breaks are preserved.','选中文字后应用样式。手动样式优先于自动标注，并保留换行。')+'</p></div></div></section>'+
 '<section class="studio-panel"><h2><span class="step">02</span>'+t('Artwork','卡面画作')+'</h2><div class="panel-content"><div class="art-mode"><label class="studio-toggle"><input type="checkbox" data-field="fusion">'+t('Fuse two artworks','融合两幅画作')+'</label><button id="swap" hidden>'+t('Swap A ↔ B','交换 A ↔ B')+'</button></div><div class="art-slots">'+slot('A')+slot('B')+'</div><p class="hint">'+t('Use any card’s art, or upload your own. Uploads stay in this tab and PNG exports; share links omit them.','可使用任意卡牌画作或自行上传。上传的图片仅保留在当前标签页和导出的 PNG 中，不会包含在分享链接里。')+'</p></div></section>'+
 '<section class="studio-panel"><h2><span class="step">03</span>'+t('Frame & details','边框与细节')+'</h2><div class="panel-content studio-fields">'+
 select(t('Phase','境界'),'phase',[[1,t('Qi Refining','炼气')],[2,t('Foundation','筑基')],[3,t('Virtuoso','金丹')],[4,t('Immortality','元婴')],[5,t('Incarnation','化神')],[6,t('Void','返虚')]])+
 select(t('Card level','卡牌等级'),'level',[[0,'1'],[1,'2'],[2,'3']])+
 select(t('Card language','卡面语言'),'language',[['en','English'],['zh','简体中文'],['tw','繁體中文']])+
 select(t('Watermark','底纹'),'mark',[['none',t('None','无')]])+
 select(t('Cost type','消耗类型'),'costType',[['none',t('None','无')],['qi',t('Qi','灵气')],['hp',t('HP','生命')]])+field(t('Cost','消耗'),'cost','type="number" min="0" max="99"')+
 '<label class="studio-toggle span-two"><input type="checkbox" data-field="dream">'+t('Dream frame','梦境边框')+'</label></div></section>'+
 '<div class="studio-footer"><div class="studio-actions"><button id="undo" disabled>'+t('Undo','撤销')+'</button><button id="redo" disabled>'+t('Redo','重做')+'</button><button id="reset">'+t('Reset','重置')+'</button></div><small>'+t('Your changes live in the URL.','你的修改保存在网址中。')+'</small></div></div></div>'+
 '<dialog class="art-dialog" aria-labelledby="library-title"><div class="dialog-top"><div class="dialog-title"><h2 id="library-title">'+t('Choose artwork','选择画作')+'</h2><button id="close-library" aria-label="'+t('Close art library','关闭画作库')+'">✕</button></div><input id="art-search" type="search" placeholder="'+t('Search English, Chinese, or card ID…','搜索英文名、中文名或卡牌 ID…')+'" aria-label="'+t('Search artwork','搜索画作')+'"><p class="hint" id="result-count"></p></div><div class="art-library"></div><button class="library-more" id="library-more">'+t('Show more','显示更多')+'</button></dialog>';
 const marks={SectBottom_1:t('Cloud Spirit Sword Sect','云灵剑宗'),SectBottom_2:t('Heptastar Pavilion','七星阁'),SectBottom_3:t('Five Elements Alliance','五行道盟'),SectBottom_4:t('Duan Xuan Sect','锻玄宗'),SectBottom_5:t('Pure Nothingness Sect','无极道宗'),CareerBottom_1:t('Elixirist','炼丹师'),CareerBottom_2:t('Fuluist','符咒师'),CareerBottom_3:t('Musician','琴师'),CareerBottom_4:t('Painter','画师'),CareerBottom_5:t('Formation Master','阵法师'),CareerBottom_6:t('Plant Master','灵植师'),CareerBottom_7:t('Fortune Teller','命理师'),artifact:t('Artifact','法宝'),pet:t('Spiritual pet','灵宠')};
 for(const key of Object.keys(catalog.marks)){const option=document.createElement('option');option.value=key;option.textContent=marks[key]||key;$('[data-field="mark"]').append(option);}
}
function snapshot(){return {state:{...state},uploads:{...uploads}};}
function restore(s){state=s.state;uploads=s.uploads;}
function remember(){undo.push(snapshot());if(undo.length>60)undo.shift();redo=[];}
function updateURL(){
 const query=encode(state,{view});
 history.replaceState(null,'',location.pathname+'?'+query);
 const langLink=document.querySelector('header a.lang');if(langLink)langLink.search=query;
}
function sync(){
 root.classList.toggle('studio-view',view);$('#edit-view').hidden=!view;
 for(const el of root.querySelectorAll('[data-field]')){const value=state[el.dataset.field];if(el.type==='checkbox')el.checked=value;else el.value=value;}
 $('#slot-B').hidden=!state.fusion;$('#swap').hidden=!state.fusion;$('.art-slots').classList.toggle('fusion',state.fusion);
 $('[data-field="mark"]').disabled=state.dream;$('[data-field="level"]').disabled=state.dream;$('[data-field="cost"]').disabled=state.costType==='none';
 for(const s of ['A','B']){
  const entry=catalog.cards.find(c=>c.id===state[s.toLowerCase()]),el=$('#slot-'+s);
  const upload=state[s.toLowerCase()]==='upload',record=uploads[s];
  el.querySelector('.art-name').textContent=upload?(record?.name||t('Upload not included','未包含上传图片')):entry[ui];
  const im=el.querySelector('img');im.style.transform=state['flip'+s]?'scaleX(-1)':'';
  if(upload&&!record)im.removeAttribute('src');else im.src=upload?record.url:new URL(entry.image,base).href;
 }
 $('#undo').disabled=!undo.length;$('#redo').disabled=!redo.length;
 const hasUpload=state.a==='upload'||(state.fusion&&state.b==='upload');
 $('#warning').hidden=!hasUpload;$('#warning').textContent=hasUpload?t('Uploaded art is not included in share links. Recipients will see a placeholder. Download the PNG to share the complete card.','分享链接不包含上传的图片，收件人会看到占位图。请下载 PNG 以分享完整卡牌。'):'';
 $('#preview').setAttribute('aria-label',(state.name||state.cn)+' — '+state.text);
 updateURL();scheduleDraw();
}
async function draw(){
 const serial=++renderSerial,snapshot={...state},canvas=document.createElement('canvas');
 $('#download').disabled=true;
 try{
  const result=await renderCard(canvas,snapshot,catalog,base,uploads);if(serial!==renderSerial)return;
  const target=$('#preview');target.width=canvas.width;target.height=canvas.height;target.getContext('2d').drawImage(canvas,0,0);
  $('#download').disabled=false;$('#share').disabled=false;
  target.dataset.ready='true';
  if(result.overflow){$('#studio-status').dataset.renderError='1';status(t('Text is too long to fit. Shorten the rules or name.','文字过长，请缩短效果描述或卡名。'));}
  else if($('#studio-status').dataset.renderError){status('');delete $('#studio-status').dataset.renderError;}
 }catch(error){if(serial!==renderSerial)return;status(t('Could not render the card. Check your connection and retry.','无法渲染卡牌，请检查网络后重试。'));$('#studio-status').dataset.renderError='1';console.error(error);}
}
function changed(){status('');$('#share-url').hidden=true;sync();}
function library(){
 const query=$('#art-search').value.trim().toLocaleLowerCase();
 const results=catalog.cards.filter(c=>(c.en+' '+c.zh+' '+c.id).toLocaleLowerCase().includes(query));
 $('#result-count').textContent=results.length+' '+t('artworks · choose for ','幅画作 · 选择用于 ')+pickerSlot;
 const grid=$('.art-library');grid.replaceChildren();
 for(const c of results.slice(0,libraryLimit)){
  const b=document.createElement('button');b.className='art-choice';b.type='button';b.setAttribute('aria-label',c[ui]+' · '+c.id);
  const im=document.createElement('img');im.src=new URL(c.image,base).href;im.alt='';im.loading='lazy';
  const span=document.createElement('span');span.textContent=c[ui];b.append(im,span);
  b.onclick=()=>{remember();state[pickerSlot.toLowerCase()]=c.id;state['zoom'+pickerSlot]=1;state['x'+pickerSlot]=state['y'+pickerSlot]=0;state['flip'+pickerSlot]=false;$('.art-dialog').close();changed();};
  grid.append(b);
 }
 if(!results.length){const p=document.createElement('p');p.textContent=t('No art matches. Try another name or ID.','没有匹配的画作，请尝试其他名称或 ID。');grid.append(p);}
 $('#library-more').hidden=results.length<=libraryLimit;
}
async function upload(s,file){
 if(!file)return;
 if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>20*1024*1024){status(t('Choose a PNG, JPEG, WebP or GIF smaller than 20 MB.','请选择小于 20 MB 的 PNG、JPEG、WebP 或 GIF。'));return;}
 const url=URL.createObjectURL(file);
 try{
  const image=await loadImage(url);
  // Bound decoded work and retain local uploads for undo, without URL serialization.
  if(image.width*image.height>40000000)throw new Error('Image too large');
  remember();uploads[s]={url,image,name:file.name};state[s.toLowerCase()]='upload';state['zoom'+s]=1;state['x'+s]=state['y'+s]=0;changed();
 }catch{URL.revokeObjectURL(url);status(t('This image could not be opened. Try a smaller PNG or JPEG.','无法打开这张图片，请尝试较小的 PNG 或 JPEG。'));}
}
function bind(){
 let editingField=null;
 root.addEventListener('focusin',e=>{if(e.target.dataset.field)editingField=null;});
 root.addEventListener('input',e=>{
  const key=e.target.dataset.field;if(!key)return;
  if(editingField!==key){remember();editingField=key;}
  state[key]=e.target.type==='checkbox'?e.target.checked:e.target.value;
  state=normalize(state,catalog).state;status('');$('#share-url').hidden=true;
  // Do not replace a focused text field or move its caret while typing.
  const active=document.activeElement,selection=['text','textarea'].includes(active.type)?[active.selectionStart,active.selectionEnd]:null;
  sync();if(selection)active.setSelectionRange(...selection);
 });
 root.addEventListener('change',e=>{editingField=null;if(e.target.dataset.file){upload(e.target.dataset.file,e.target.files[0]);e.target.value='';}});
 root.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.dataset.browse){pickerSlot=button.dataset.browse;libraryLimit=60;$('#art-search').value='';library();$('.art-dialog').showModal();$('#art-search').focus();}
  if(button.dataset.upload)$('[data-file="'+button.dataset.upload+'"]').click();
  if(button.dataset.format){
   const el=$('[data-field="text"]'),a=el.selectionStart,b=el.selectionEnd,chosen=el.value.slice(a,b)||t('text','文字');
   remember();
   const selection=richChars(chosen),visible=selection.map(c=>c.char).join(''),bold=button.dataset.format==='bold'||(button.dataset.format==='color'&&selection.every(c=>c.bold));
   const color=button.dataset.format==='color'?$('#text-color').value:(selection[0]?.color||'#3d3935');
   const token=button.dataset.format==='plain'?'[plain|'+visible+']':'[style:'+color+':'+(bold?'b':'n')+'|'+visible+']';
   state.text=(el.value.slice(0,a)+token+el.value.slice(b)).slice(0,600);changed();el.focus();el.setSelectionRange(a,a+token.length);
  }
 });
 $('#close-library').onclick=()=>$('.art-dialog').close();
 $('#art-search').oninput=()=>{libraryLimit=60;library();};
 $('#library-more').onclick=()=>{libraryLimit+=60;library();};
 $('#swap').onclick=()=>{remember();[state.a,state.b]=[state.b,state.a];for(const k of ['flip','zoom','x','y'])[state[k+'A'],state[k+'B']]=[state[k+'B'],state[k+'A']];[uploads.A,uploads.B]=[uploads.B,uploads.A];changed();};
 $('#undo').onclick=()=>{if(!undo.length)return;redo.push(snapshot());restore(undo.pop());changed();};
 $('#redo').onclick=()=>{if(!redo.length)return;undo.push(snapshot());restore(redo.pop());changed();};
 $('#reset').onclick=()=>{remember();state=normalize({...defaults,language:ui},catalog).state;changed();};
 $('#edit-view').onclick=()=>{view=false;sync();};
 $('#share').onclick=async()=>{
  const url=new URL(location.href);url.search=encode(state);url.hash='';
  const field=$('#share-url');field.value=url.href;field.hidden=false;
  const omitted=state.a==='upload'||(state.fusion&&state.b==='upload');
  try{await navigator.clipboard.writeText(url.href);status(omitted?t('Link copied. Uploaded art is omitted; use PNG for the complete card.','链接已复制。上传图片已省略，完整卡牌请使用 PNG。'):t('Share link copied.','分享链接已复制。'));}
  catch{field.focus();field.select();status(t('Copy the selected link to share your card.','复制已选中的链接即可分享卡牌。'));}
 };
 $('#download').onclick=async()=>{
  const exported=document.createElement('canvas');$('#download').disabled=true;
  try{await renderCard(exported,{...state},catalog,base,{...uploads},2);}catch(error){status(t('Export failed. Please retry.','导出失败，请重试。'));$('#download').disabled=false;return;}
  $('#download').disabled=false;
  const link=document.createElement('a');link.download=(state.name||state.cn||'custom-card').replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,80)+'.png';
  exported.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob);link.href=url;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);},'image/png');
 };
}
try{
 const response=await fetch(new URL('catalog.json',base),{cache:'no-cache'});if(!response.ok)throw new Error('Catalog unavailable');catalog=await response.json();
 const parsed=decode(initialSearch,catalog);state=parsed.state;
 if(!new URLSearchParams(initialSearch).has('v'))state.language=ui;
 buildUI();bind();status(t('Loading the card font…','正在加载卡牌字体…'));
 sync();status(parsed.issues.length?t('Some invalid link settings were reset.','链接中的部分无效设置已重置。'):'');
}catch(error){root.replaceChildren();const p=document.createElement('p');p.textContent=t('The card studio could not load. Please reload to try again.','卡牌工坊加载失败，请刷新重试。');root.append(p);console.error(error);}
