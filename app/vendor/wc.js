const WC = (() => {
'use strict';

const LEVELS = ['A1','A2','B1','B2','C1','C2'];
const POS = {n:'noun',noun:'noun',v:'verb',verb:'verb',adj:'adj',a:'adj',adjective:'adj',adv:'adv',adverb:'adv',phr:'phrase',phrase:'phrase',prep:'prep',conj:'conj',pron:'pron',idiom:'phrase'};
const POS_NAME = {en:{noun:'Nouns',verb:'Verbs',adj:'Adjectives',adv:'Adverbs',phrase:'Phrases'},uz:{noun:'Otlar',verb:'Feʼllar',adj:'Sifatlar',adv:'Ravishlar',phrase:'Iboralar'}};
const CYR = /[Ѐ-ӿ]/;

/* Uzbek Latin: o' and g' written with any apostrophe become ʻ; other apostrophes inside Uzbek words become ʼ (tutuq belgisi) */
const uzFix = s => String(s||'').replace(/([oOgG])['`’‘ʼ]/g,'$1ʻ').replace(/(\w)['`’‘](\w)/g,'$1ʼ$2');
const idOf = w => w.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const splitList = s => String(s||'').split(',').map(x=>x.trim()).filter(Boolean);
const words = s => s.trim().split(/\s+/).filter(Boolean);

function parse(src){
  const out = {title:'',id:'',level:'',text:'',uses:[],games:{mode:'all',only:[],minus:[]},cards:[],blocks:{groups:[],scales:[],sorts:[],stories:[],parts:{parts:{},words:[]}},
               errors:[],warnings:[],notes:[]};
  const err=(ln,m)=>out.errors.push({ln,m}), warn=(ln,m)=>out.warnings.push({ln,m}), note=(ln,m)=>out.notes.push({ln,m});
  const lines = String(src||'').replace(/\r/g,'').split('\n');
  let card=null, story=null, rawGroups=[];
  const endStory=()=>{ if(story){ story.s=story.s.trim(); if(story.s) out.blocks.stories.push(story); story=null } };

  lines.forEach((raw,i)=>{
    const ln=i+1;
    const line=raw.replace(/\s+\/\/.*$/,'').replace(/^\/\/.*$/,'');
    const t=line.trim();
    if(CYR.test(t)) err(ln,'Cyrillic letters found. Switch the keyboard to Latin and retype this line.');
    if(story){
      if(!t){ endStory(); return }
      if(/^extra\s*:/i.test(t)){ story.extra=splitList(t.replace(/^extra\s*:/i,'')); return }
      if(!t.startsWith('@')){ story.s+=' '+t; return }
      endStory();
    }
    if(!t) return;
    // header
    if(t.startsWith('## ')){ out.title=t.slice(3).trim(); card=null; return }
    let m;
    if((m=t.match(/^level\s+(\S+)$/i))){ const L=m[1].toUpperCase(); if(!LEVELS.includes(L)) err(ln,`Level must be one of ${LEVELS.join(', ')}.`); out.level=L; return }
    if((m=t.match(/^text\s+(uz|en)$/i))){ out.text=m[1].toLowerCase(); return }
    if((m=t.match(/^id\s+(\S+)$/i))){ out.id=m[1]; return }
    if((m=t.match(/^use\s+(\S+)$/i))){ out.uses.push(m[1]); return }
    if((m=t.match(/^games\s+(.+)$/i))){ const g=words(m[1]); out.games={mode:g[0]==='all'?'all':'only',only:g.filter(x=>x!=='all'&&!x.startsWith('-')),minus:g.filter(x=>x.startsWith('-')).map(x=>x.slice(1))}; return }
    // blocks
    if(t.startsWith('@')){
      card=null;
      if((m=t.match(/^@group\s+([^:]+):\s*(.+)$/i))){ const w=splitList(m[2]); if(w.length!==4) err(ln,`A group needs exactly 4 words (found ${w.length}).`); rawGroups.push({c:m[1].trim(),w,ln}); return }
      if((m=t.match(/^@scale\s+([^:]+):\s*(.+)$/i))){
        const items=m[2].split('<').map(x=>x.trim()).filter(Boolean).map(x=>{ const g=x.match(/^(.+?)\s*\((.+)\)$/); return g?[g[1].trim(),g[2].trim()]:[x,x] });
        if(items.length<3||items.length>5) err(ln,'A scale needs 3 to 5 words, from lowest to highest, joined with <.');
        out.blocks.scales.push({q:m[1].trim(),lo:items[0]&&items[0][1],hi:items[items.length-1]&&items[items.length-1][1],w:items}); return }
      if((m=t.match(/^@sort\s+([^:]+):\s*(.+)$/i))){
        const bins=[], items=[];
        m[2].split('|').forEach((b,bi)=>{ const bm=b.match(/^\s*([^=]+)=\s*(.+)$/); if(!bm){ err(ln,'Write each bin as Name = word, word.'); return }
          bins.push(bm[1].trim()); splitList(bm[2]).forEach(x=>{ const h=x.match(/^(.+?)\s*\((.+)\)$/); items.push([h?h[1].trim():x,bi,h?h[2].trim():'']) }) });
        if(bins.length<2) err(ln,'A sort needs at least 2 bins.'); if(items.length<6) warn(ln,'A sort works best with 6 or more words.');
        out.blocks.sorts.push({q:m[1].trim(),bins,items}); return }
      if((m=t.match(/^@story\s+(.+)$/i))){ story={t:m[1].trim(),s:'',extra:[],ln}; return }
      if((m=t.match(/^@parts\s+([^=]+)=\s*([^|]+)\|\s*(.+)$/i))){
        const pieces=m[2].split('+').map(x=>x.trim()).filter(Boolean).map(x=>{ const g=x.match(/^(.+?)\s*\((.+)\)$/); const p=(g?g[1]:x).trim(); const gloss=g?g[2].trim():'';
          const type=p.endsWith('-')?'pre':p.startsWith('-')?'suf':'root'; return {p:p.replace(/^-|-$/g,''),type,gloss} });
        const w=m[1].trim();
        if(pieces.map(x=>x.p).join('')!==w.toLowerCase()) warn(ln,`The pieces of "${w}" do not spell the word exactly (${pieces.map(x=>x.p).join('+')}). Fine for spelling changes, but check it.`);
        pieces.forEach(x=>{ if(!out.blocks.parts.parts[x.p]) out.blocks.parts.parts[x.p]=[x.type,x.gloss] });
        out.blocks.parts.words.push({w,p:pieces.map(x=>x.p),d:m[3].trim()}); return }
      err(ln,'Unknown block. Use @group, @scale, @sort, @story or @parts.'); return;
    }
    // word line: word | pos | meaning | uzbek
    if(t.includes('|')&&!/^[>!=~?+*]/.test(t)){
      const f=t.split('|').map(x=>x.trim());
      if(f.length<3||!f[0]||!f[2]){ err(ln,'A word line is: word | part of speech | meaning | Uzbek (optional).'); card=null; return }
      const pos=POS[f[1].toLowerCase()];
      if(!pos) err(ln,`Unknown part of speech "${f[1]}". Use n, v, adj, adv or phr.`);
      card={id:idOf(f[0]),w:f[0],p:pos||'other',en:f[2],uz:f[3]?uzFix(f[3]):'',sentences:[],ant:'',syn:'',confuse:[],sp:[],alt:[],diff:0,ln};
      if(f[3]&&uzFix(f[3])!==f[3]) note(ln,'Uzbek letters oʻ / gʻ were normalised.');
      if(out.cards.some(c=>c.id===card.id)) err(ln,`"${f[0]}" is already in this homework.`);
      out.cards.push(card); return;
    }
    // detail lines belong to the last word
    if(/^(>>|[>!=~?+*])/.test(t)){
      if(!card){ err(ln,'This line must come under a word line.'); return }
      if(t.startsWith('>')){
        const safe=t.startsWith('>>'); let body=t.slice(safe?2:1).trim(); let dis=[];
        const bar=body.lastIndexOf('|'); if(bar>-1){ dis=splitList(body.slice(bar+1)); body=body.slice(0,bar).trim() }
        const br=body.match(/\[([^\]]+)\]/g)||[];
        if(br.length!==1){ err(ln,`A sentence needs exactly one [word] in brackets (found ${br.length}).`); return }
        const form=br[0].slice(1,-1).trim(), s=body.replace(br[0],'___'), full=body.replace(br[0],form);
        const stem=card.w.toLowerCase().slice(0,Math.min(4,card.w.length-1));
        if(!form.toLowerCase().startsWith(stem)&&!card.alt.map(x=>x.toLowerCase()).includes(form.toLowerCase())) warn(ln,`"${form}" does not look like a form of "${card.w}". Check it, or add it with + if it is a real form.`);
        if(new RegExp('\\b'+card.w.toLowerCase().slice(0,Math.max(4,card.w.length-2)),'i').test(s)) warn(ln,`The sentence also contains "${card.w}" outside the gap, which gives the answer away.`);
        dis.forEach(d=>{ if(d.toLowerCase()===form.toLowerCase()) err(ln,`The distractor "${d}" is the answer itself.`) });
        if(dis.length&&dis.length!==3) warn(ln,'Give 3 distractors, or none (then the games choose them).');
        card.sentences.push({s,f:form,full,dis,safe,words:words(full).length});
        if(safe&&words(full).length>12) warn(ln,'Sentences for word order (>>) work best with 12 words or fewer.');
        return;
      }
      const k=t[0], v=t.slice(1).trim();
      if(k==='!'){ card.ant=v; return }
      if(k==='='){ card.syn=v; return }
      if(k==='~'){ card.confuse.push(...splitList(v).map(idOf)); return }
      if(k==='?'){ card.sp.push(...splitList(v).map(x=>x.toLowerCase())); return }
      if(k==='+'){ card.alt.push(...splitList(v)); return }
      if(k==='*'){ const d=+v; if(![1,2,3].includes(d)) err(ln,'Difficulty is 1, 2 or 3.'); card.diff=d; return }
    }
    err(ln,'This line is not understood. Word lines need | between fields; details start with > >> ! = ~ ? + or *.');
  });
  endStory();

  /* header checks */
  if(!out.title) err(0,'Add a title line starting with ## .');
  if(!out.level) err(0,'Add a level line, for example: level A2');
  if(!out.text) out.text = ['A1','A2'].includes(out.level)?'uz':'en';
  if(!out.id) out.id = idOf(out.title||'homework').slice(0,40);
  if(out.cards.length<4) err(0,`A homework needs at least 4 words (found ${out.cards.length}).`);

  /* card checks and derived fields */
  const ids=new Set(out.cards.map(c=>c.id)), defs=new Map();
  out.cards.forEach(c=>{
    c.d = out.text==='uz'&&c.uz ? c.uz : c.en;
    if(!c.diff){ const n=c.w.replace(/[^a-z]/gi,'').length; c.diff = n<=5?1:n<=8?2:3 }
    const key=c.d.toLowerCase(); if(defs.has(key)) err(c.ln,`"${c.w}" has the same meaning as "${defs.get(key)}". Two words with one meaning make a choice unfair.`); else defs.set(key,c.w);
    if(new RegExp('\\b'+c.w.toLowerCase().slice(0,Math.max(4,c.w.length-2)),'i').test(c.en+' '+c.uz)) warn(c.ln,`The meaning of "${c.w}" contains the word itself.`);
    c.sp.forEach(x=>{ if(ids.has(idOf(x))||x===c.w.toLowerCase()) err(c.ln,`The misspelling "${x}" is a real word in this homework.`) });
    if(!c.sentences.length) warn(c.ln,`"${c.w}" has no sentence: games with sentences will skip it.`);
    const s0=c.sentences[0]; c.s=s0?s0.s:''; c.f=s0?s0.f:c.w;
  });
  /* look-alikes become pairs only when both words are in the homework */
  const confuse=[]; out.cards.forEach(c=>c.confuse.forEach(o=>{ if(ids.has(o)&&!confuse.some(p=>p.includes(c.id)&&p.includes(o))) confuse.push([c.id,o]) }));
  out.confuse=confuse;
  /* groups: every 3 make one Connections board; a word may appear in only one group of a board */
  for(let i=0;i+3<=rawGroups.length;i+=3){
    const board=rawGroups.slice(i,i+3), all=board.flatMap(g=>g.w.map(x=>x.toLowerCase()));
    if(new Set(all).size!==all.length) err(board[0].ln,'A word appears in two groups of the same board.');
    out.blocks.groups.push(board.map(g=>({c:g.c,w:g.w})));
  }
  if(rawGroups.length%3) warn(rawGroups[rawGroups.length-1].ln,`Groups come in threes (one board = 3 groups). ${rawGroups.length%3} group(s) left over are not used.`);
  /* stories need at least 3 gaps */
  out.blocks.stories.forEach(st=>{ const n=(st.s.match(/\[[^\]]+\]/g)||[]).length; if(n<3) err(st.ln,`The story "${st.t}" needs at least 3 [words] (found ${n}).`) });
  /* sort: if none written, sort the homework's own words by part of speech (always exact) */
  if(!out.blocks.sorts.length){
    const by={}; out.cards.forEach(c=>{ if(POS_NAME.en[c.p]) (by[c.p]=by[c.p]||[]).push(c) });
    const keys=Object.keys(by).filter(k=>by[k].length>=3).slice(0,3);
    if(keys.length>=2){ out.blocks.sorts.push({q:out.text==='uz'?'Qaysi soʻz turkumi?':'Which part of speech?',bins:keys.map(k=>POS_NAME[out.text][k]),items:keys.flatMap((k,bi)=>by[k].slice(0,5).map(c=>[c.w,bi,c.d])),auto:true}); note(0,'Sorting Office will sort these words by part of speech (no @sort written).') }
  }
  out.ok = !out.errors.length;
  return out;
}

/* ───────── The games and what each needs. Tier is hidden from students; evidence is what the engine may conclude. ───────── */
const single = c => /^[a-z]+$/i.test(c.w);
const withS = h => h.cards.filter(c=>c.s);
const GAMES = [
  // key, title, kind, tier, evidence, play, min words, need(h) → '' or the reason it is not available
  {key:'gameshow',title:'The Big Word Show',file:'the-big-word-show',tier:1,ev:'weak',play:'solo',need:h=>h.cards.length>=8?'':'needs 8 words'},
  {key:'whack',title:'Whack-a-Word',file:'whack-a-word',tier:1,ev:'weak',play:'solo',need:h=>h.cards.length>=6?'':'needs 6 words'},
  {key:'pairs',title:'Star Pairs',file:'star-pairs',tier:1,ev:'weak',play:'solo',need:h=>h.cards.length>=6?'':'needs 6 words'},
  {key:'spelling',title:'Spell-Check Sprint',file:'spell-check-sprint',tier:1,ev:'weak',play:'solo',need:h=>h.cards.filter(c=>c.sp.length).length>=6?'':'needs 6 words with misspellings (?)'},
  {key:'castle',title:'Defend the Castle',file:'defend-the-castle',tier:1,ev:'weak',play:'solo',legacy:'words',need:h=>h.cards.length>=8?'':'needs 8 words'},
  {key:'mark',title:'Secret Letters',file:'secret-letters',tier:1,ev:'medium',play:'solo',need:h=>withS(h).length>=6?'':'needs 6 words with sentences (>)'},
  {key:'connect',title:'Word Connections',file:'word-connections',tier:2,ev:'medium',play:'solo',need:h=>h.blocks.groups.length?'':'needs 3 @group lines'},
  {key:'sort',title:'Sorting Office',file:'sorting-office',tier:2,ev:'medium',play:'solo',need:h=>h.blocks.sorts.length?'':'needs a @sort, or 3+ words in two parts of speech'},
  {key:'rank',title:'Power Meter',file:'power-meter',tier:2,ev:'medium',play:'solo',need:h=>h.blocks.scales.length>=2?'':'needs 2 @scale lines'},
  {key:'parts',title:'Word Lab',file:'word-lab',tier:2,ev:'medium',play:'solo',need:h=>h.blocks.parts.words.length>=5?'':'needs 5 @parts lines'},
  {key:'story',title:'Silly Story',file:'silly-story',tier:2,ev:'medium',play:'solo',need:h=>h.blocks.stories.length?'':'needs a @story'},
  {key:'detective',title:'Word Detective',file:'word-detective',tier:2,ev:'medium',play:'solo',legacy:'words',need:h=>withS(h).filter(c=>c.ant).length>=6?'':'needs 6 words with a sentence (>) and an opposite (!)'},
  {key:'clash',title:'Antonym Clash',file:'antonym-clash',tier:2,ev:'medium',play:'solo',legacy:'words',need:h=>h.cards.filter(c=>c.ant&&c.syn).length>=6?'':'needs 6 words with an opposite (!) and a synonym (=)'},
  {key:'ghost',title:'Ghost Race',file:'ghost-race',tier:3,ev:'strong',play:'solo',need:h=>h.cards.length>=6?'':'needs 6 words'},
  {key:'balloons',title:'Balloon Rescue',file:'balloon-rescue',tier:3,ev:'medium',play:'solo',need:h=>h.cards.filter(single).length>=8?'':'needs 8 one-word items'},
  {key:'scramble',title:'Letter Tiles',file:'letter-tiles',tier:3,ev:'medium',play:'solo',need:h=>h.cards.filter(c=>single(c)&&c.w.length>=4).length>=6?'':'needs 6 one-word items of 4+ letters'},
  {key:'crossword',title:'Crossword',file:'crossword',tier:3,ev:'strong',play:'solo',need:h=>h.cards.filter(single).length>=8?'':'needs 8 one-word items'},
  {key:'falling',title:'Falling Words',file:'falling-words',tier:3,ev:'strong',play:'solo',legacy:'words',need:h=>h.cards.length>=8?'':'needs 8 words'},
  {key:'escape',title:'Escape Room',file:'escape-room',tier:3,ev:'strong',play:'solo',legacy:'lists',need:h=>h.cards.filter(single).length>=8?'':'needs 8 one-word items'},
  {key:'boss',title:'Boss Word',file:'boss-word',tier:4,ev:'strong',play:'solo',need:h=>withS(h).length>=6?'':'needs 6 words with sentences (>)'},
  {key:'fix',title:'Fix the Sentence',file:'fix-the-sentence',tier:4,ev:'strong',play:'solo',legacy:'lists',need:h=>withS(h).length>=6?'':'needs 6 words with sentences (>)'},
  {key:'unjumble',title:'Unjumble',file:'unjumble',tier:4,ev:'strong',play:'solo',legacy:'lists',need:h=>h.cards.filter(c=>c.sentences.some(s=>s.safe&&s.words<=12)).length>=4?'':'needs 4 word-order sentences (>>)'},
  {key:'duel',title:'Word Duel',file:'word-duel',tier:2,ev:'medium',play:'multi',need:h=>h.cards.length>=8?'':'needs 8 words'},
  {key:'tug',title:'Tug of War',file:'tug-of-war',tier:1,ev:'weak',play:'multi',need:h=>h.cards.length>=8?'':'needs 8 words'},
  {key:'royale',title:'Word Royale',file:'word-royale',tier:3,ev:'strong',play:'multi',need:h=>h.cards.length>=10?'':'needs 10 words'},
  {key:'heist',title:'The Vault Heist',file:'vault-heist',tier:3,ev:'strong',play:'multi',need:h=>h.cards.length>=9?'':'needs 9 words'},
  {key:'classcastle',title:'Class Castle',file:'class-castle',tier:1,ev:'weak',play:'class',legacy:'lists',need:h=>h.cards.length>=8?'':'needs 8 words'},
];
/* blocks from a classwork code: `use <id>` in a homework pulls that code's groups, scales, sorts, stories and word parts */
function merge(h,lib){
  (h.uses||[]).forEach(id=>{ const src=lib[id]; if(!src){ h.warnings.push({ln:0,m:`use ${id}: no saved code with this id.`}); return }
    const o=parse(src); if(!o.ok){ h.warnings.push({ln:0,m:`use ${id}: that code has errors, its blocks were skipped.`}); return }
    const b=h.blocks, ob=o.blocks; b.groups.push(...ob.groups); b.scales.push(...ob.scales); b.stories.push(...ob.stories);
    if(ob.sorts.length&&!ob.sorts[0].auto){ b.sorts=b.sorts.filter(x=>!x.auto); b.sorts.push(...ob.sorts) }
    Object.assign(b.parts.parts,ob.parts.parts); b.parts.words.push(...ob.parts.words);
    h.notes.push({ln:0,m:`use ${id}: blocks added from "${o.title}".`}) });
  return h;
}
function availability(h){
  return GAMES.map(g=>{
    let why=h.ok?g.need(h):'fix the errors first';
    if(!why&&h.games.mode==='only'&&!h.games.only.includes(g.key)) why='not listed in games';
    if(!why&&h.games.minus.includes(g.key)) why='turned off in games';
    return Object.assign({},g,{ok:!why,why});
  });
}

/* ───────── The content each game receives. Kit games read cards and blocks; the older games get the shape they were written for. ───────── */
function forGame(h,key,seed=1){
  const rnd=mulberry(seed);
  // each launch uses one of a word's sentences, so a word does not always come with the same one
  const cards=h.cards.map(c=>{ const s=c.sentences.length?c.sentences[Math.floor(rnd()*c.sentences.length)]:null;
    return {id:c.id,w:c.w,p:c.p,d:c.d,s:s?s.s:'',f:s?s.f:c.w,ant:c.ant,syn:c.syn,sp:c.sp.slice(0,2).concat(c.sp.length<2?[]:[]),alt:c.alt,diff:c.diff} });
  const wg={id:h.id,game:key,text:h.text,cards,confuse:h.confuse,blocks:{groups:h.blocks.groups,scales:h.blocks.scales,sorts:h.blocks.sorts,stories:h.blocks.stories,parts:h.blocks.parts}};
  const g=GAMES.find(x=>x.key===key);
  if(g&&g.legacy==='words'){
    if(key==='detective') wg.legacy=cards.filter(c=>c.s&&c.ant).map(c=>({id:c.id,w:c.w,p:c.p,d:c.d,a:c.ant,s:c.s,f:c.f,diff:c.diff}));
    else if(key==='clash') wg.legacy=cards.filter(c=>c.ant&&c.syn).map(c=>({id:c.id,w:c.w,p:c.p,a:c.ant,s:c.syn,diff:c.diff}));
    else wg.legacy=cards.map(c=>({id:c.id,w:c.w,d:c.d,alt:c.alt,diff:c.diff}));
  }
  if(g&&g.legacy==='lists'){
    let L;
    if(key==='fix'){
      // the wrong word must be clearly wrong: a hand-written distractor, otherwise a word of another part of speech
      L={text:h.text,words:Object.fromEntries(cards.map(c=>[c.id,c.d])),items:h.cards.filter(c=>c.sentences.length).map(c=>{ const s=c.sentences[0];
        const mis=s.dis[0]||(h.cards.find(o=>o.p!==c.p&&single(o))||h.cards.find(o=>o.id!==c.id)).w;
        return {wid:c.id,s:s.s,f:s.f,alt:c.alt,mis,diff:c.diff} })};
    } else if(key==='unjumble'){
      L={text:h.text,max:12,items:h.cards.flatMap(c=>c.sentences.filter(s=>s.safe&&s.words<=12).slice(0,1).map(s=>({wid:c.id,s:s.full,w:s.f,d:c.d})))};
    } else L={text:h.text,words:cards.map(c=>({id:c.id,w:c.w,d:c.d,alt:c.alt,diff:c.diff}))};
    wg.lists={a2:L,c1:L};
  }
  return wg;
}

/* ───────── The engine bank: the same shape as the vocab engine's content tables (words, sentences, puzzles). Status is draft until the teacher approves. ───────── */
function bank(h){
  const lv=h.level;
  return {
    words:h.cards.map(c=>({id:c.id,word:c.w,pos:c.p,level:lv,def:c.en,def_level:lv,uz:c.uz,accepted:c.alt,lookalikes:c.confuse,fakes:c.sp,homework:h.id,status:'draft'})),
    sentences:h.cards.flatMap(c=>c.sentences.map((s,i)=>({id:`${c.id}-s${i+1}`,word_id:c.id,text:s.s,answer:s.f,accepted:c.alt.filter(a=>a.toLowerCase()!==s.f.toLowerCase()),level:lv,
      formats:s.dis.length===3?['choose_context','type_context']:['type_context'],distractors:s.dis,status:'draft'}))),
    puzzles:h.blocks.groups.map((b,i)=>({id:`${h.id}-p${i+1}`,groups:b}))
  };
}

/* ───────── A test from the same code: 4 sections, fixed by a seed so every student in a class can get the same or a shuffled paper ───────── */
function test(h,seed=7,size=12){
  const rnd=mulberry(seed), sh=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
  const pool=sh(h.cards), per=Math.max(2,Math.round(size/4)), items=[];
  const opts=(c,field)=>{ const bad=new Set([c.id,...h.confuse.filter(p=>p.includes(c.id)).flat()]); const same=sh(h.cards.filter(o=>!bad.has(o.id)&&o.p===c.p)), other=sh(h.cards.filter(o=>!bad.has(o.id)&&o.p!==c.p));
    return sh([c,...[...same,...other].slice(0,3)]).map(o=>({t:o[field],ok:o.id===c.id})) };
  pool.slice(0,per).forEach(c=>items.push({sec:'A',kind:'meaning',ev:'weak',wid:c.id,q:c.d,opts:opts(c,'w')}));
  sh(h.cards.filter(c=>c.sentences.some(s=>s.dis.length===3))).slice(0,per).forEach(c=>{ const s=c.sentences.find(x=>x.dis.length===3);
    items.push({sec:'B',kind:'context',ev:'medium',wid:c.id,q:s.s,opts:sh([{t:s.f,ok:true},...s.dis.map(d=>({t:d,ok:false}))])}) });
  const typed=pool.slice(per,per*2+ (items.filter(i=>i.sec==='B').length<per?per:0));
  typed.forEach(c=>items.push({sec:'C',kind:'typed',ev:'strong',wid:c.id,q:c.d,answer:c.w,alt:c.alt,len:c.w.length,first:c.w[0]}));
  sh(h.cards.filter(c=>c.sentences.length&&!typed.includes(c))).slice(0,per).forEach(c=>{ const s=c.sentences[0]; items.push({sec:'D',kind:'typed-context',ev:'strong',wid:c.id,q:s.s,answer:s.f,alt:c.alt,len:s.f.length,first:s.f[0]}) });
  return items;
}
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

return {parse,merge,availability,forGame,bank,test,GAMES,LEVELS,uzFix};
})();