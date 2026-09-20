// Same asset choices, markup and split-card composition as recording viewer fateArtwork.
export function createFateArtwork(entry, language) {
  const span = className => {const el=document.createElement('span');el.className=className;return el;};
  const img = src => {const el=new Image();el.src=window.YxpCards?.sourceUrl(src) ?? src;el.alt='';el.draggable=false;return el;};
  const root=span('hdf-art');root.setAttribute('aria-hidden','true');
  if(entry.compositeCardIds?.length===2){
    const composite=span('fate-composite');
    entry.compositeCardIds.forEach((id,index)=>{const part=span('fate-composite-card '+(index?'second':'first'));part.append(img(`../../assets/cards/${id}_${language}.webp`));composite.append(part);});
    composite.append(span('fate-composite-ink'));root.append(composite);
  }else if(/^Card_\d+\.(?:png|webp)$/.test(entry.iconFile)){
    const crop=span('fate-card-crop');crop.append(img(entry.image));root.append(crop);
  }else root.append(img(entry.image));
  return root;
}
