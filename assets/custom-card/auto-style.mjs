import {applyPhraseStyles} from './phrase-style.mjs?v=d5f66228c86962b9';
import {richChars,BODY} from './native-layout.mjs?v=d5f66228c86962b9';
const escape=s=>s.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&');
export function autoStyle(text,language,lexicon){
 const parts=text.split(/(\[[^\]]+\])/g),overrides=[];let plain='',offset=0;
 for(const part of parts){const chars=richChars(part);if(/^\[[^\]]+\]$/.test(part))overrides.push([offset,chars]);plain+=chars.map(c=>c.char).join('');offset+=chars.length;}
 const result=inferPlain(plain,language,lexicon);
 applyPhraseStyles(plain,language,lexicon,result);
 for(const [at,chars] of overrides)for(let i=0;i<chars.length;i++)result[at+i]=chars[i];
 return result;
}
function inferPlain(text,language,lexicon){
 const plain=new Set(['3','ATK','HP','攻','生命','use','Times','次','Spirit','Cloud','Formation','Unrestrained','概率','卡组','卡組','Force Cap','气势上限','氣勢上限','崩拳']);
 const words=(lexicon[language]||lexicon.zh).filter(w=>!plain.has(w)),parts=[text];
 const keyword=new RegExp(words.filter(x=>x!=='3').map(escape).join('|'),'gu');
 const numericColors={'DEF':'#9a6212','防':'#9a6212','Qi':'#2c81bf','灵气':'#2c81bf','靈氣':'#2c81bf','Sword Intent':'#cf3521','剑意':'#cf3521','劍意':'#cf3521'},result=[];
 for(const part of parts){
  // Input here is already decoded: literal brackets must not become markup again.
  const chars=richChars(part,false);
  for(const match of part.matchAll(keyword)){
   const start=match.index,term=match[0],end=start+term.length;
   if(/[A-Za-z]/.test(term[0])&&/[A-Za-z]/.test(part[start-1]||''))continue;
   if(/[A-Za-z]/.test(term.at(-1))&&/[A-Za-z]/.test(part[end]||'')&&!(term==='Debuff'&&/^s(?:[^A-Za-z]|$)/.test(part.slice(end))))continue;
   const prefix=part.slice(0,start);
   if((prefix.match(/"/g)||[]).length%2||prefix.lastIndexOf('“')>prefix.lastIndexOf('”')||prefix.lastIndexOf('「')>prefix.lastIndexOf('」'))continue;
   const before=part.slice(0,start),after=part.slice(end);
   // Action/stance headings are keywords; the same words in prose are not.
   if(/^(Use|使用|Fist|拳)$/.test(term)&&!/^\s*[:：]/.test(after))continue;
   if(/^(Continuous|Growth|Post Action|持续|持續|成长|成長|后招|後招)$/.test(term)&&/^\s*(?:card|Card|牌)/.test(after))continue;
   if(/^(击伤|擊傷)$/.test(term)&&/^值/.test(after))continue;
   if(term==='Exchange'&&/^ Card Chance/.test(after))continue;
   if(term==='Upgrade'&&!/^\s*(?:[:：]|(?:the )?next\b|it\b|\d+\s+(?:more|times?\b))/.test(after))continue;
   if(/^(升级|升級)$/.test(term)&&/合成[，,]?(?:将其|將其)$/.test(before))continue;
   if(/^(升级|升級)$/.test(term)&&!/^[:：]|^下\d/.test(after)&&!/(?:将其(?:永久)?|將其(?:永久)?|就多|其)$/.test(before))continue;
   if(term==='Qi'&&(/^ cost\b/i.test(after)||/\b(?:costs?|consumes?)\s+(?:up to\s+)?\d+\s*$/i.test(before)))continue;
   if(/^(灵气|靈氣)$/.test(term)&&/(?:无需|無需|消耗|耗)\s*\d*$/.test(before))continue;
   if(/^(持续|持續)$/.test(term)&&/^\d+回合/.test(after))continue;
   if(term==='消耗'&&!(start===0||/\n\s*$/.test(before)))continue;
   if(/^(激活)$/.test(term)&&/(?:已|后|後)$/.test(before))continue;
   if(/^(伤害|傷害)$/.test(term)&&/(?:命元|攻或|%|％)$/.test(before))continue;
   if(/^(耗生命)$/.test(term)&&!/^[:：]/.test(after))continue;
   if(term==='Chase'&&/(?:opponent's |do not |cannot )$/.test(before))continue;
   if(/^(再次行动|再次行動)$/.test(term)&&/(?:对方触发|對方觸發|未触发|未觸發)$/.test(before))continue;
   const styled=richChars('['+term+']'),index=Array.from(part.slice(0,start)).length;
   for(let i=0;i<styled.length;i++)chars[index+i]=styled[i];
  }
  for(const m of part.matchAll(/(?:Continuous|持续|持續)\s*:?\s*(?:\d+|X(?:\s*[+]\s*\d+)?)\s*(Times|次)/g)){
   const start=m.index+m[0].lastIndexOf(m[1]),idx=Array.from(part.slice(0,start)).length;
   for(let k=0;k<Array.from(m[1]).length;k++)chars[idx+k].bold=true;
  }
  let offset=0;
  for(const line of part.split('\n')){
   // Exhaust is a purple standalone card label, not the resource-spending verb.
   const exhaust=line.match(/^(\s*)(Exhaust|耗尽|耗盡)\s*$/u);
   if(exhaust){
    const start=offset+Array.from(exhaust[1]).length;
    for(let i=start;i<start+Array.from(exhaust[2]).length;i++){chars[i].color='#b21d81';chars[i].bold=false;}
   }
   const atk=line.match(/^(\s*)(\d+(?:[~～-]\d+)?)\s*(?:ATK|攻)/u);
   const stat=line.match(/^(\s*)(DEF|Qi|Sword Intent|防|灵气|靈氣|剑意|劍意)(\s*[+＋-]\s*)(\d+(?:[~～-]\d+)?)/u);
   const paint=(start,len,c)=>{for(let i=offset+Array.from(line.slice(0,start)).length;i<offset+Array.from(line.slice(0,start+len)).length;i++){if(/\d/.test(chars[i].char)){chars[i].color=c;chars[i].bold=false;}}};
   if(atk&&Number(atk[2])!==0)paint(atk[1].length,atk[2].length,'#9d1022');
   if(stat)paint(stat[1].length+stat[2].length+stat[3].length,stat[4].length,numericColors[stat[2]]);
   const threshold=line.match(/(?:Qi is greater than |(?:Qi|灵气|靈氣)\s*>\s*)([1-9]\d*)/);
   if(threshold)paint(threshold.index+threshold[0].length-threshold[1].length,threshold[1].length,'#2c81bf');
   offset+=Array.from(line).length+1;
  }
  result.push(...chars);
 }
 return result;
}
export function markup(chars){
 let out='',i=0;
 while(i<chars.length){const first=chars[i];if(first.char==='\n'){out+='\n';i++;continue;}let j=i+1;while(j<chars.length&&chars[j].bold===first.bold&&chars[j].color===first.color&&chars[j].char!=='\n')j++;
  const value=chars.slice(i,j).map(c=>c.char).join('');
  if(first.bold)out+='[style:'+first.color+':b|'+value+']';else if(first.color!==BODY)out+='[color:'+first.color+'|'+value+']';else out+='[plain|'+value+']';i=j;
 }return out;
}
