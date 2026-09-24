// Native effect phrase recognition. Values vary; card IDs and multiline descriptions are never lookup keys.
const delimiters=/[^\n,:：，;；()（）。.!?！？]+|[\n,:：，;；()（）。.!?！？]/gu;
const cache=new WeakMap();
function spans(text,pattern){return [...text.matchAll(pattern)].map(m=>({text:m[0],at:Array.from(text.slice(0,m.index)).length}));}
export function phraseSpans(text){return [...spans(text,delimiters),...spans(text,/[^\n]+/gu)];}
export function phraseTokens(text){return [...text.matchAll(/\d+|[^\d]/gu)].map(m=>({text:m[0],at:Array.from(text.slice(0,m.index)).length}));}
export function phraseKey(tokens){return JSON.stringify(tokens.map(t=>/^\d+$/.test(t.text)?null:t.text));}
export function applyPhraseStyles(text,language,lexicon,chars){
 const library=lexicon.phraseRules;if(library?.version!==1)return;
 const rules=library[language]||library.zh;if(!rules)return;
 let decoded=cache.get(rules);if(!decoded){decoded=new Map();cache.set(rules,decoded);}
 // Larger line patterns run after clauses so they can preserve local conditional context.
 for(const span of phraseSpans(text)){
  const value=span.text.trim();if(!value||Array.from(value).length>200)continue;
  const tokens=phraseTokens(value),key=phraseKey(tokens);
  if(!Object.hasOwn(rules,key))continue;
  if(!decoded.has(key))decoded.set(key,rules[key].flatMap(([n,bold,color])=>Array.from({length:n},()=>({bold,color}))));
  const styles=decoded.get(key);if(styles.length!==tokens.length)continue;
  const start=span.at+Array.from(span.text.slice(0,span.text.indexOf(value))).length;
  tokens.forEach((token,i)=>{
   for(let j=0;j<Array.from(token.text).length;j++)Object.assign(chars[start+token.at+j],styles[i]);
  });
 }
}
