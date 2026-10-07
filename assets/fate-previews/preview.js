(() => {
'use strict';
const script=document.currentScript,base=script.dataset.wikiBase,lang=script.dataset.previewLang;
let catalog;
function load(){return catalog||(catalog=fetch(script.dataset.catalogUrl).then(r=>{if(!r.ok)throw Error('Card preview catalog unavailable');return r.json();}).catch(e=>{catalog=null;throw e;}));}
const box=document.createElement('aside');box.id='fate-card-preview';box.hidden=true;box.setAttribute('role','tooltip');
const title=document.createElement('h2'),strip=document.createElement('div');strip.className='preview-cards';box.append(title,strip);document.body.append(box);
let active,timer,generation=0;
function cardLink(target){const a=target.closest?.('a[href]');if(!a)return;const url=new URL(a.href,location.href);if(url.origin!==location.origin||!url.pathname.startsWith(base+'/'))return;const match=url.pathname.slice(base.length).match(/^\/(?:en|zh)\/cards\/(\d+)\.html$/);if(!match)return;const id=Number(match[1]);a.dataset.cardPreview=String(id-(Math.floor(id/10000)%100)*10000);return a;}
function close(){clearTimeout(timer);generation++;box.hidden=true;active?.removeAttribute('aria-describedby');active=null;}
function position(link){const a=link.getBoundingClientRect(),r=box.getBoundingClientRect(),m=12;box.style.left=Math.max(m,Math.min(a.left,innerWidth-r.width-m))+'px';box.style.top=Math.max(m,Math.min(a.bottom+m+r.height<=innerHeight-m?a.bottom+m:a.top-r.height-m,innerHeight-r.height-m))+'px';}
async function show(link){clearTimeout(timer);if(active===link&&!box.hidden)return;const token=++generation;active?.removeAttribute('aria-describedby');active=link;box.hidden=true;let data;try{data=await load();}catch{return;}if(token!==generation||active!==link||!link.isConnected)return;const group=data.groups[link.dataset.cardPreview];if(!group)return;link.setAttribute('aria-describedby',box.id);const name=data.names[link.dataset.cardPreview]||link.textContent;title.textContent=name;strip.replaceChildren();box.style.width=Math.min(936,group.length*176+(group.length-1)*6+32)+'px';strip.style.setProperty('--preview-count',group.length);
 for(const card of group){const fig=document.createElement('figure'),label=document.createElement('figcaption'),im=new Image();label.textContent=card.label;im.alt=name+' — '+card.label;im.dataset.cardKey=card.id+'_'+lang;im.src=window.YxpCards?window.YxpCards.source(im.dataset.cardKey):base+'/assets/cards/'+im.dataset.cardKey+'.webp';if(link.closest('.treasure-pool')&&String(card.id)===link.dataset.cardInstance)fig.classList.add('selected');if(!data.phaseGroups.includes(link.dataset.cardPreview))fig.append(label);fig.append(im);strip.append(fig);}
 box.hidden=false;position(link);
}
function schedule(){clearTimeout(timer);timer=setTimeout(close,160);}
document.addEventListener('pointerover',e=>{const a=cardLink(e.target);if(a&&!a.contains(e.relatedTarget))show(a);});
document.addEventListener('pointerout',e=>{const a=cardLink(e.target);if(a&&!a.contains(e.relatedTarget))schedule();});
document.addEventListener('focusin',e=>{const a=cardLink(e.target);if(a)show(a);});
document.addEventListener('focusout',e=>{if(cardLink(e.target))schedule();});
box.addEventListener('pointerenter',()=>clearTimeout(timer));box.addEventListener('pointerleave',schedule);
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
document.addEventListener('pointerdown',e=>{if(!box.contains(e.target)&&!cardLink(e.target))close();});
document.addEventListener('scroll',()=>{if(active===document.activeElement)position(active);else close();},true);window.addEventListener('resize',close);
})();
