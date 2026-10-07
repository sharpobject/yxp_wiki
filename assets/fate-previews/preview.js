(() => {
'use strict';
const data=JSON.parse(document.getElementById('fate-preview-data').textContent);
const box=document.createElement('aside');box.id='fate-card-preview';box.hidden=true;box.setAttribute('role','tooltip');
const title=document.createElement('h2'),strip=document.createElement('div');strip.className='preview-cards';box.append(title,strip);document.body.append(box);
let active,timer;
function close(){clearTimeout(timer);box.hidden=true;active?.removeAttribute('aria-describedby');active=null;}
function position(link){const a=link.getBoundingClientRect(),r=box.getBoundingClientRect(),m=12;box.style.left=Math.max(m,Math.min(a.left,innerWidth-r.width-m))+'px';box.style.top=Math.max(m,Math.min(a.bottom+m+r.height<=innerHeight-m?a.bottom+m:a.top-r.height-m,innerHeight-r.height-m))+'px';}
function show(link){clearTimeout(timer);const group=data.groups[link.dataset.cardPreview];if(!group)return;if(active===link&&!box.hidden)return;active?.removeAttribute('aria-describedby');active=link;link.setAttribute('aria-describedby',box.id);title.textContent=link.textContent;strip.replaceChildren();const offered=!!link.closest('.treasure-chest-pool');box.classList.toggle('has-offered-level',offered);
 for(const card of group){const fig=document.createElement('figure'),label=document.createElement('figcaption'),im=new Image();label.textContent=card.label;im.alt=link.textContent+' — '+card.label;im.dataset.cardKey=card.id+'_'+data.lang;im.src=window.YxpCards?window.YxpCards.source(im.dataset.cardKey):data.base+'/assets/cards/'+im.dataset.cardKey+'.webp';if(String(card.id)===link.dataset.cardInstance){fig.classList.add('selected');if(offered){const badge=document.createElement('span');badge.className='offered-badge';badge.textContent=data.lang==='zh'?'宝箱提供此等级':'Offered by Treasure Chest';label.append(badge);}}fig.append(label,im);strip.append(fig);}
 box.hidden=false;position(link);
}
function schedule(){clearTimeout(timer);timer=setTimeout(close,160);}
document.addEventListener('pointerover',e=>{const a=e.target.closest('a[data-card-preview]');if(a&&!a.contains(e.relatedTarget))show(a);});
document.addEventListener('pointerout',e=>{const a=e.target.closest('a[data-card-preview]');if(a&&!a.contains(e.relatedTarget))schedule();});
document.addEventListener('focusin',e=>{const a=e.target.closest('a[data-card-preview]');if(a)show(a);});
document.addEventListener('focusout',e=>{if(e.target.closest('a[data-card-preview]'))schedule();});
box.addEventListener('pointerenter',()=>clearTimeout(timer));box.addEventListener('pointerleave',schedule);
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
document.addEventListener('pointerdown',e=>{if(!box.contains(e.target)&&!e.target.closest('a[data-card-preview]'))close();});
document.addEventListener('scroll',e=>{if(box.contains(e.target))return;if(active===document.activeElement)position(active);else close();},true);window.addEventListener('resize',close);
})();
