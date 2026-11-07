// grammar-engine.mjs
// The grammar engine: reads packs written in the special code, builds questions as plain data,
// grades answers, and decides what each student gets next. Pure logic: no DOM, no network, no AI.
// Runs the same in the browser (<script type="module">) and in Node (tests).
//
// Flow for one question:
//   const plan = nextQuestion(state, bank, sessionId)        // what to ask and why (does not change state)
//   const q    = buildQuestion(bank, plan)                    // the question as data for the UI
//   ...UI shows q, student answers -> response...
//   const { event, log } = submitAnswer(state, bank, sessionId, plan, q, response, rtMs, eventId)
//   // save `event` online (append-only); `state` is already updated
//
// Everything a student has done is a list of events. replay(events) rebuilds the exact state,
// which makes corrections (accepting an answer later) exact.

export const ENGINE_VERSION = '1.0.0';

/* =====================================================================
   1. Settings (every number the engine uses, in one place)
   ===================================================================== */
export const CONFIG = {
  steps: 12,                 // 6 tiers x easy/hard
  streakToMoveUp: 3,         // correct in a row, each in a different sentence
  wrongRowToDrop: 2,         // wrong in a row at one step -> down one step
  comebackMin: 2,            // a missed rule returns after 2..4 questions
  comebackMax: 4,
  maxSameTypeInRow: 2,       // never the same type 3 times in a row
  recentTypeWindow: 6,
  recentItemWindow: 3,
  reviewDays: [1, 3, 7, 30], // days until the next review after each pass
  secureAfterReviews: 3,     // learned for good after passing +1, +3, +7
  reviewFailStep: 8,         // a failed review sends the rule back to Tier 5 easy
  reviewEvery: 4,            // in homework, one due review from older rules every 4 questions
  sessionMax: { class: 40, home: 45, review: 20 },
  rapidBaseMs: { choice: 700, tap: 700, match: 1500, selects: 1500, type: 1200, slots: 1500, tiles: 1500, rightwrong: 900, fix: 1500, sort: 2000, pair: 1500, dialog: 2000, chain: 1500 },
  rapidPerCharMs: 12,        // reading time added per visible character
  rapidWindow: 6,            // 2 rapid answers in the last 6 -> options appear after a delay
  rapidLimit: 2,
  slowDownMs: 1500,
  secondaryCredit: true      // gaps of other rules inside texts/dialogs/chains count for those rules
};

/* =====================================================================
   2. Small utilities
   ===================================================================== */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashSeed(...parts) {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= 0x9e; h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
export function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const pick = (a, rng) => a[Math.floor(rng() * a.length)];
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
const clone = o => JSON.parse(JSON.stringify(o));

/* =====================================================================
   3. Parser: special code -> pack
   ===================================================================== */
function parseGap(raw) {
  let s = raw, rule = null, base = null;
  s = s.replace(/#([\w.-]+)/, (_, r) => { rule = r; return ''; });
  s = s.replace(/\(([^)]*)\)/, (_, b) => { base = b.trim(); return ''; });
  const parts = s.split('~').map(x => x.trim()).filter(Boolean);
  const acc = (parts[0] || '').split('|').map(x => x.trim()).filter(Boolean);
  return { answer: acc[0] || '', accepted: acc, distractors: parts.slice(1), base, rule };
}
export function parseSentence(text) {
  const segs = []; const re = /\{([^}]*)\}/g; let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) segs.push({ t: text.slice(last, m.index) });
    segs.push({ gap: parseGap(m[1]) });
    last = re.lastIndex;
  }
  if (last < text.length) segs.push({ t: text.slice(last) });
  return segs;
}

export function parsePack(src) {
  const P = { id: 'pack', title: '', meta: {}, rules: {}, ruleOrder: [], confuse: [], tl: {}, tlOrder: [], items: [], errors: [] };
  String(src).split(/\r?\n/).forEach((raw, idx) => {
    const ln = idx + 1, line = raw.trim();
    if (!line || line.startsWith('//')) return;
    if (line[0] === '#') {
      const m = line.match(/^#(\w+)\s*(.*)$/);
      if (!m) { P.errors.push({ line: ln, msg: 'Directive without a name' }); return; }
      const k = m[1], rest = m[2], parts = rest.split('|').map(s => s.trim());
      if (k === 'pack') { P.id = parts[0] || 'pack'; P.title = parts[1] || ''; }
      else if (k === 'rule') {
        const r = { id: parts[0], name: parts[1] || parts[0] };
        parts.slice(2).forEach(p => { const f = p.match(/^(\w+):\s*(.*)$/); if (f) r[f[1]] = f[2]; });
        if (!r.id) P.errors.push({ line: ln, msg: '#rule needs an id' });
        else { if (P.rules[r.id]) P.errors.push({ line: ln, msg: `Rule ${r.id} defined twice` }); P.rules[r.id] = r; P.ruleOrder.push(r.id); }
      }
      else if (k === 'confuse') P.confuse.push(rest.split(/\s+/).filter(Boolean));
      else if (k === 'tl') { P.tl[parts[0]] = parts[1] || ''; P.tlOrder.push(parts[0]); }
      else if (k === 'lesson') rest.split(/\s+/).forEach(kv => { const [a, b] = kv.split('='); if (a) P.meta[a] = isNaN(+b) ? b : +b; });
      else P.meta[k] = rest;
      return;
    }
    const fields = line.split(/\s\|\s/);
    const head = fields[0].trim().split(/\s+/);
    if (head.length < 2 || fields.length < 2) { P.errors.push({ line: ln, msg: 'Item needs "id rule | sentence"' }); return; }
    const it = { id: head[0], rule: head[1], kind: head[2] || 's', line: ln, raw: line, f: {} };
    if (!['s', 'text', 'dialog', 'chain'].includes(it.kind)) P.errors.push({ line: ln, msg: `Unknown kind "${it.kind}"` });
    fields.slice(2).forEach(fd => {
      const f = fd.match(/^(\w+):\s*([\s\S]*)$/);
      if (f) it.f[f[1]] = f[2].trim(); else P.errors.push({ line: ln, msg: `Field without a name: "${fd.slice(0, 30)}"` });
    });
    const body = fields[1];
    if (it.kind === 'chain') it.steps = body.split(/\s>>\s/).map(parseSentence);
    else if (it.kind === 'dialog') it.turns = body.split(/\s\/\/\s/).map(parseSentence);
    else it.segs = parseSentence(body);
    if (it.f.q) {
      const [qq, ans] = it.f.q.split(/\s=\s/);
      const o = (ans || '').split('~').map(s => s.trim()).filter(Boolean);
      it.q = { text: (qq || '').trim(), answer: o[0], others: o.slice(1) };
    }
    if (P.items.some(x => x.id === it.id)) P.errors.push({ line: ln, msg: `Item id ${it.id} used twice` });
    P.items.push(it);
  });
  P.items.forEach(it => { it.pack = P.id; it.key = `${P.id}:${it.id}`; });
  return P;
}

/* =====================================================================
   4. Bank: several packs together (rules keep their IDs across packs)
   ===================================================================== */
export function buildBank(packs) {
  const B = { packs: {}, rules: {}, ruleOrder: [], confuse: [], tl: {}, tlOrder: [], items: [], byKey: {}, warnings: [] };
  packs.forEach(P => {
    B.packs[P.id] = P;
    P.ruleOrder.forEach(r => {
      if (!B.rules[r]) { B.rules[r] = P.rules[r]; B.ruleOrder.push(r); }
      else if (B.rules[r].name !== P.rules[r].name) B.warnings.push(`Rule ${r} has a different formula in pack ${P.id}; the first one is used.`);
    });
    P.confuse.forEach(g => B.confuse.push(g));
    P.tlOrder.forEach(k => { if (!(k in B.tl)) { B.tl[k] = P.tl[k]; B.tlOrder.push(k); } });
    P.items.forEach(it => { B.items.push(it); B.byKey[it.key] = it; });
  });
  return B;
}
const TENSE = (B, r) => (B.rules[r] || {}).tense || r;
function confusables(B, rule) {
  const out = new Set();
  B.confuse.forEach(g => { if (g.includes(rule)) g.forEach(r => { if (r !== rule) out.add(r); }); });
  return [...out];
}
function itemSegsList(it) { return it.segs ? [it.segs] : (it.turns || it.steps || []); }
/** All rules an item touches: its main rule and any #rule inside its gaps. */
export function rulesOfItem(it) {
  const s = new Set([it.rule]);
  itemSegsList(it).forEach(segs => gapsOf(segs).forEach(g => { if (g.rule) s.add(g.rule); }));
  return [...s];
}

/* =====================================================================
   5. Answer checking for typed answers
   ===================================================================== */
const CYR = { 'а': 'a', 'е': 'e', 'о': 'o', 'с': 'c', 'р': 'p', 'х': 'x', 'у': 'y', 'і': 'i', 'А': 'a', 'Е': 'e', 'О': 'o', 'С': 'c', 'Р': 'p', 'Х': 'x', 'У': 'y', 'І': 'i' };
export function hasCyrillic(s) { return /[аеосрхуіАЕОСРХУІ]/.test(s || ''); }
export function norm(s) {
  s = String(s || '').normalize('NFKC').replace(/[​-‍﻿­]/g, '');
  s = s.replace(/[’‘ʼʻ´`′]/g, "'");
  s = s.replace(/[аеосрхуіАЕОСРХУІ]/g, c => CYR[c]);
  s = s.toLowerCase().replace(/\s+/g, ' ').replace(/\s*'\s*/g, "'").trim();
  s = s.replace(/^["']+/, '').replace(/[.!?,;:"]+$/, '').trim();
  return s;
}
export function expand(s) {
  return s
    .replace(/\bim\b/g, "i'm").replace(/\b(i|you|we|they)ve\b/g, "$1've")
    .replace(/\b(do|does|did|has|have|had|is|are|was|were|could|would|should)nt\b/g, "$1n't").replace(/\bcant\b/g, "can't")
    .replace(/\bcan't\b/g, 'can not').replace(/\bcannot\b/g, 'can not').replace(/\bwon't\b/g, 'will not')
    .replace(/n't\b/g, ' not').replace(/'m\b/g, ' am').replace(/'re\b/g, ' are').replace(/'ve\b/g, ' have').replace(/'ll\b/g, ' will')
    .replace(/\s+/g, ' ').trim();
}
// "'s" is never expanded (he's = he is OR he has); instead the full forms are contracted for comparison.
const contractS = s => s.replace(/\b(he|she|it|who|that|there|what|where)\s+(has|is)\b/g, "$1's");
function variantsOf(ans, prev) {
  const base = [ans]; const pw = (prev || '').split(' ').filter(Boolean);
  for (let k = 1; k <= pw.length; k++) base.push(pw.slice(-k).join(' ') + ' ' + ans);
  const out = new Set();
  base.forEach(b => { const n = expand(norm(b)); out.add(n); out.add(contractS(n)); });
  return out;
}
/** key = { accepted: [...], prev: 'words before the gap' }. Spaces, capitals, end punctuation, apostrophes,
    Cyrillic look-alikes and contractions never make an answer wrong. The answer may be typed with the
    words before it ("my brother has worked"). Grammar and spelling inside the form still count. */
export function checkTyped(input, key) {
  const inp = expand(norm(input));
  if (!inp) return false;
  return key.accepted.some(a => variantsOf(a, key.prev).has(inp));
}

/* =====================================================================
   6. Sentence helpers
   ===================================================================== */
export function gapsOf(segs) { return segs.filter(s => s.gap).map(s => s.gap); }
export function fill(segs, subs = {}) {
  let gi = -1;
  return segs.map(s => { if (s.gap) { gi++; return subs[gi] != null ? subs[gi] : s.gap.answer; } return s.t; }).join('');
}
export function tokensOf(segs, subs = {}) {
  const toks = []; let gi = -1;
  segs.forEach(s => {
    if (s.gap) {
      gi++; const txt = subs[gi] != null ? subs[gi] : s.gap.answer;
      txt.split(' ').filter(Boolean).forEach(w => toks.push({ w, tgt: true, gi, err: subs[gi] != null, rule: s.gap.rule }));
    } else {
      const t = s.t;
      t.split(/\s+/).forEach((p, i) => {
        if (!p) return;
        if (i === 0 && !/^\s/.test(t) && toks.length) toks[toks.length - 1].w += p; else toks.push({ w: p, tgt: false });
      });
    }
  });
  return toks;
}
export function prevWords(segs, gi) {
  let k = -1;
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].gap) {
      k++;
      if (k === gi) {
        const p = segs[i - 1];
        if (!p || !p.t || !/\s$/.test(p.t)) return null;
        return p.t.trim().split(/\s+/).map(w => w.replace(/[^\w']/g, '')).filter(Boolean).join(' ') || null;
      }
    }
  }
  return null;
}
const distr = (g, lv, n) => (lv === 'easy' ? g.distractors.slice(-n) : g.distractors.slice(0, n));
const segView = segs => { let gi = -1; return segs.map(s => (s.gap ? { gap: ++gi } : { t: s.t })); };
const isS = x => x.kind === 's';
function splitHalves(it) {
  const toks = tokensOf(it.segs); let last = -1;
  toks.forEach((t, i) => { if (t.tgt) last = i; });
  if (last < 0 || last >= toks.length - 1) return null;
  const R = toks.slice(last + 1).map(t => t.w).join(' ');
  return R.length > 2 ? { L: toks.slice(0, last + 1).map(t => t.w).join(' '), R } : null;
}
function decoyWords(items, exclude, n, rng) {
  const ex = new Set(exclude.map(w => w.toLowerCase())); const pool = [];
  items.forEach(it => gapsOf(it.segs || []).forEach(g => g.distractors.forEach(d => d.split(' ').forEach(w => {
    if (!ex.has(w.toLowerCase()) && !pool.includes(w)) pool.push(w);
  }))));
  return shuffle(pool, rng).slice(0, n);
}
function sentenceParts(it) {
  const full = fill(it.segs).trim(); const pm = full.match(/[.?!]$/); const punct = pm ? pm[0] : '';
  return { full, punct, words: full.slice(0, full.length - punct.length).split(' ') };
}
function orderSet(it, full) {
  const s = new Set([norm(full)]);
  (it.f.order || '').split(';').map(x => x.trim()).filter(Boolean).forEach(x => s.add(norm(x)));
  return [...s];
}
function letterOptions(list, rng) {
  // list: [{text|tl|..., ok}] -> shuffled with stable ids a, b, c, d
  const sh = shuffle(list, rng);
  const ids = 'abcdefgh';
  return { options: sh.map((o, i) => { const { ok, ...rest } = o; return { id: ids[i], ...rest }; }), correct: ids[sh.findIndex(o => o.ok)] };
}

/* =====================================================================
   7. Tiers and the 24 question types
   ===================================================================== */
export const TIERS = [
  { n: 1, name: 'Notice', uz: 'Koʻr', types: ['tap', 'odd', 'spot'] },
  { n: 2, name: 'Understand', uz: 'Tushun', types: ['meaning', 'timeline', 'match', 'situation'] },
  { n: 3, name: 'Choose', uz: 'Tanla', types: ['gap', 'ab', 'correct', 'multi'] },
  { n: 4, name: 'Build', uz: 'Tuz', types: ['type', 'bank', 'unscramble', 'parts', 'transform'] },
  { n: 5, name: 'Fix & contrast', uz: 'Tuzat', types: ['rightwrong', 'find', 'fix', 'sort', 'pair'] },
  { n: 6, name: 'Use', uz: 'Qoʻlla', types: ['dialog', 'chain', 'uz', 'multi'] }
];
// Types a review question may use (always at hard level), strongest evidence first.
export const REVIEW_TYPES = ['sort', 'pair', 'fix', 'rightwrong', 'dialog', 'chain', 'uz', 'multi', 'transform', 'type', 'correct', 'odd'];

export const TYPES = {};
export const TYPE_ORDER = [];
function def(id, tier, name, from, avail, build) { TYPES[id] = { id, n: TYPE_ORDER.length + 1, tier, name, from, avail, build }; TYPE_ORDER.push(id); }

const sameTense = (B, it) => B.items.filter(x => isS(x) && x !== it && TENSE(B, x.rule) === TENSE(B, it.rule));
const diffTense = (B, it) => B.items.filter(x => isS(x) && TENSE(B, x.rule) !== TENSE(B, it.rule));
const hintOf = (B, q) => (q.level === 'easy' ? (B.rules[q.rule] || {}).name || null : null);

// Each build(B, it, q, rng) fills q.ui, q.prompt, q.payload, q.key, q.answerText, q.readChars and optionally q.gapRules.
def('tap', 1, 'Tap the form', '{gap}', (B, it) => isS(it), (B, it, q) => {
  const toks = tokensOf(it.segs), tz = TENSE(B, it.rule);
  const tg = toks.map((t, i) => (t.tgt ? i : -1)).filter(i => i >= 0);
  Object.assign(q, { ui: 'tap', prompt: { en: `Tap the ${tz} verb.`, uz: `${tz} feʼlini bosing.` },
    payload: { tokens: toks.map(t => t.w), need: q.level === 'easy' ? tg.length : null, single: false },
    key: { targets: tg }, answerText: tg.map(i => toks[i].w).join(' '), readChars: fill(it.segs).length });
});
def('odd', 1, 'Odd one out', '{gap} + lines of a #confuse rule', (B, it) => isS(it) && diffTense(B, it).length > 0 && sameTense(B, it).length >= 2, (B, it, q, rng) => {
  const tz = TENSE(B, it.rule); const same = [it, ...shuffle(sameTense(B, it), rng).slice(0, q.level === 'easy' ? 1 : 2)]; const odd = pick(diffTense(B, it), rng);
  const { options, correct } = letterOptions([...same.map(x => ({ text: fill(x.segs), ok: false })), { text: fill(odd.segs), ok: true }], rng);
  Object.assign(q, { ui: 'choice', prompt: { en: `Which sentence is not ${tz}?`, uz: `Qaysi gap ${tz} emas?` }, payload: { options },
    key: { correct }, answerText: fill(odd.segs), feedback: `Bu gap ${TENSE(B, odd.rule)}. ${odd.f.fb || ''}`.trim(),
    readChars: options.reduce((n, o) => n + o.text.length, 0), extraItems: [...same.slice(1), odd].map(x => x.key) });
});
def('spot', 1, 'Spot it in a text', '{gap} of several lines', (B, it) => it.kind === 'text' || (isS(it) && diffTense(B, it).length > 0 && sameTense(B, it).length > 0), (B, it, q, rng) => {
  const tz = TENSE(B, it.rule);
  const parts = it.kind === 'text' ? [it] : shuffle([it, pick(sameTense(B, it), rng), pick(diffTense(B, it), rng)], rng);
  const toks = []; parts.forEach(p => tokensOf(p.segs).forEach(t => { t.tgt = t.tgt && TENSE(B, t.rule || p.rule) === tz; toks.push(t); }));
  const tg = toks.map((t, i) => (t.tgt ? i : -1)).filter(i => i >= 0);
  Object.assign(q, { ui: 'tap', prompt: { en: `Tap every ${tz} verb in the text.`, uz: `Matndagi barcha ${tz} feʼllarini bosing.` },
    payload: { tokens: toks.map(t => t.w), need: q.level === 'easy' ? tg.length : null, single: false },
    key: { targets: tg }, answerText: tg.map(i => toks[i].w).join(', '), readChars: toks.reduce((n, t) => n + t.w.length + 1, 0) });
});
def('meaning', 2, 'Meaning check', 'q:', (B, it) => isS(it) && !!it.q, (B, it, q, rng) => {
  const { options, correct } = letterOptions([{ text: it.q.answer, ok: true }, ...it.q.others.map(o => ({ text: o, ok: false }))], rng);
  Object.assign(q, { ui: 'choice', prompt: { en: it.q.text, uz: 'Maʼnosiga qarab javob bering.' }, payload: { sentence: fill(it.segs), options },
    key: { correct }, answerText: it.q.answer, readChars: fill(it.segs).length + it.q.text.length });
});
def('timeline', 2, 'Timeline pick', 'tl:', (B, it) => isS(it) && it.f.tl in B.tl, (B, it, q, rng) => {
  const k = it.f.tl; const others = shuffle(B.tlOrder.filter(x => x !== k), rng).slice(0, q.level === 'easy' ? 1 : 2);
  const { options, correct } = letterOptions([k, ...others].map(x => ({ tl: x, caption: q.level === 'easy' ? B.tl[x] : null, ok: x === k })), rng);
  Object.assign(q, { ui: 'choice', prompt: { en: 'Which timeline matches the sentence?', uz: 'Gapga mos vaqt chizigʻini tanlang.' }, payload: { sentence: fill(it.segs), options, timeline: true },
    key: { correct }, answerText: B.tl[k], readChars: fill(it.segs).length });
});
def('match', 2, 'Match halves', '{gap} splits the line', (B, it) => isS(it) && !!splitHalves(it), (B, it, q, rng) => {
  const n = q.level === 'easy' ? 3 : 4; const set = [it];
  shuffle(B.items.filter(x => isS(x) && x !== it && splitHalves(x)), rng).forEach(x => {
    if (set.length < n && !set.some(y => splitHalves(y).R === splitHalves(x).R || splitHalves(y).L === splitHalves(x).L)) set.push(x);
  });
  const H = set.map(splitHalves); const order = shuffle(H.map((h, i) => i), rng);
  Object.assign(q, { ui: 'match', prompt: { en: 'Match the halves.', uz: 'Gap boʻlaklarini juftlang.' },
    payload: { left: H.map(h => h.L), right: order.map(i => H[i].R) }, key: { pairs: H.map((h, i) => order.indexOf(i)) },
    answerText: H.map(h => `${h.L} ${h.R}`).join(' · '), readChars: H.reduce((s, h) => s + h.L.length + h.R.length, 0), extraItems: set.slice(1).map(x => x.key) });
});
def('situation', 2, 'Situation → sentence', 'sit:', (B, it) => isS(it) && !!it.f.sit, (B, it, q, rng) => {
  const g = gapsOf(it.segs)[0];
  const { options, correct } = letterOptions([{ text: fill(it.segs), ok: true }, ...distr(g, q.level, q.level === 'easy' ? 2 : 3).map(d => ({ text: fill(it.segs, { 0: d }), ok: false }))], rng);
  Object.assign(q, { ui: 'choice', prompt: { en: 'Read the situation. Which sentence fits?', uz: 'Vaziyatga mos gapni tanlang.' }, payload: { situation: it.f.sit, options },
    key: { correct }, answerText: fill(it.segs), readChars: it.f.sit.length + options.reduce((n, o) => n + o.text.length, 0) });
});
def('gap', 3, 'Gap multiple choice', '{answer ~distractors}', (B, it) => isS(it), (B, it, q, rng) => {
  const g = gapsOf(it.segs)[0];
  const { options, correct } = letterOptions([{ text: g.answer, ok: true }, ...distr(g, q.level, q.level === 'easy' ? 2 : 3).map(d => ({ text: d, ok: false }))], rng);
  Object.assign(q, { ui: 'choice', prompt: { en: 'Choose the right form.', uz: 'Toʻgʻri shaklni tanlang.' }, hint: hintOf(B, q),
    payload: { segments: segView(it.segs), options }, key: { correct }, answerText: g.answer, readChars: fill(it.segs).length });
});
def('ab', 3, 'A or B toggle', '{answer ~first distractor}', (B, it) => isS(it), (B, it, q, rng) => {
  const g = gapsOf(it.segs)[0];
  const { options, correct } = letterOptions([{ text: g.answer, ok: true }, { text: distr(g, q.level, 1)[0], ok: false }], rng);
  Object.assign(q, { ui: 'choice', prompt: { en: 'Tap the right words in the sentence.', uz: 'Gapdagi toʻgʻri soʻzlarni bosing.' }, hint: hintOf(B, q),
    payload: { segments: segView(it.segs), options, inline: true }, key: { correct }, answerText: g.answer, readChars: fill(it.segs).length });
});
def('correct', 3, 'Correct sentence', '{answer ~distractors}', (B, it) => isS(it), (B, it, q, rng) => {
  const g = gapsOf(it.segs)[0];
  const { options, correct } = letterOptions([{ text: fill(it.segs), ok: true }, ...distr(g, q.level, q.level === 'easy' ? 2 : 3).map(d => ({ text: fill(it.segs, { 0: d }), ok: false }))], rng);
  Object.assign(q, { ui: 'choice', prompt: { en: 'Which sentence is correct?', uz: 'Qaysi gap toʻgʻri?' }, hint: hintOf(B, q), payload: { options },
    key: { correct }, answerText: fill(it.segs), readChars: options.reduce((n, o) => n + o.text.length, 0) });
});
def('multi', 3, 'Multi-gap text', 'text item, or 3 lines joined', (B, it) => it.kind === 'text' || isS(it), (B, it, q, rng) => {
  const parts = it.kind === 'text' ? [it] : [it, ...shuffle(B.items.filter(x => isS(x) && x !== it), rng).slice(0, 2)];
  const blocks = [], gaps = [], answers = [], gapRules = [];
  parts.forEach(p => {
    const view = []; p.segs.forEach(sg => {
      if (sg.gap) {
        const g = sg.gap; view.push({ gap: gaps.length });
        gaps.push({ options: shuffle([g.answer, ...distr(g, q.level, q.level === 'easy' ? 2 : 3)], rng) });
        answers.push(g.answer); gapRules.push(g.rule || p.rule);
      } else view.push({ t: sg.t });
    }); blocks.push(view);
  });
  Object.assign(q, { ui: 'selects', prompt: { en: 'Fill every gap.', uz: 'Barcha boʻsh joylarni toʻldiring.' }, payload: { blocks, gaps },
    key: { answers }, gapRules, answerText: parts.map(p => fill(p.segs)).join(' '), feedback: parts.map(p => p.f.fb).filter(Boolean)[0] || null,
    readChars: parts.reduce((n, p) => n + fill(p.segs).length, 0), extraItems: parts.slice(1).map(x => x.key) });
});
def('type', 4, 'Type the form', '(base)', (B, it) => isS(it) && !!gapsOf(it.segs)[0].base, (B, it, q) => {
  const g = gapsOf(it.segs)[0];
  Object.assign(q, { ui: 'type', prompt: { en: 'Write the right form.', uz: 'Toʻgʻri shaklni yozing.' }, hint: hintOf(B, q),
    payload: { segments: segView(it.segs), base: g.base, placeholder: q.level === 'easy' ? g.answer[0] + '…' : '' },
    key: { accepted: g.accepted, prev: prevWords(it.segs, 0) }, answerText: g.answer, readChars: fill(it.segs).length });
});
def('bank', 4, 'Word bank', '{answer} of 2–3 lines + distractors as decoys', (B, it) => isS(it), (B, it, q, rng) => {
  const set = [it, ...shuffle(B.items.filter(x => isS(x) && x !== it && gapsOf(x.segs)[0].answer !== gapsOf(it.segs)[0].answer), rng).slice(0, q.level === 'easy' ? 1 : 2)];
  const answers = set.map(x => gapsOf(x.segs)[0].answer); const decoys = [];
  set.forEach(x => gapsOf(x.segs)[0].distractors.forEach(d => { if (!answers.includes(d) && !decoys.includes(d)) decoys.push(d); }));
  const chips = shuffle([...answers, ...shuffle(decoys, rng).slice(0, q.level === 'easy' ? 1 : 3)], rng);
  Object.assign(q, { ui: 'slots', prompt: { en: 'Fill the gaps with words from the box.', uz: 'Boʻsh joylarni qutidagi soʻzlar bilan toʻldiring.' },
    payload: { sentences: set.map(x => segView(x.segs)), chips }, key: { answers }, gapRules: set.map(x => x.rule),
    answerText: set.map(x => fill(x.segs)).join(' · '), readChars: set.reduce((n, x) => n + fill(x.segs).length, 0) + chips.join(' ').length, extraItems: set.slice(1).map(x => x.key) });
});
def('unscramble', 4, 'Unscramble', 'the whole line (+ order:)', (B, it) => isS(it), (B, it, q, rng) => {
  const { full, punct, words } = sentenceParts(it); const extra = q.level === 'hard' ? decoyWords([it], words, 2, rng) : [];
  Object.assign(q, { ui: 'tiles', prompt: { en: 'Put the words in order.', uz: 'Soʻzlarni tartib bilan qoʻying.' },
    payload: { tiles: shuffle([...words, ...extra], rng), auto: q.level === 'easy' ? words.length : null, punct },
    key: { accepted: orderSet(it, full), punct }, answerText: full, readChars: full.length });
});
def('parts', 4, 'Build from parts', '{answer} with 2+ words', (B, it) => isS(it) && gapsOf(it.segs)[0].answer.split(' ').length >= 2, (B, it, q, rng) => {
  const g = gapsOf(it.segs)[0], aw = g.answer.split(' '); const dec = [];
  g.distractors.forEach(d => d.split(' ').forEach(w => { if (!aw.includes(w) && !dec.includes(w)) dec.push(w); }));
  Object.assign(q, { ui: 'tiles', prompt: { en: 'Build the verb from the pieces.', uz: 'Feʼlni boʻlaklardan yasang.' }, hint: hintOf(B, q),
    payload: { segments: segView(it.segs), tiles: shuffle([...aw, ...dec.slice(0, q.level === 'easy' ? 1 : 3)], rng), auto: aw.length, punct: '' },
    key: { exact: g.answer }, answerText: g.answer, readChars: fill(it.segs).length });
});
def('transform', 4, 'Transform', 'from:', (B, it) => isS(it) && !!it.f.from, (B, it, q) => {
  const g = gapsOf(it.segs)[0];
  Object.assign(q, { ui: 'type', prompt: { en: 'Change the sentence.', uz: 'Gapni oʻzgartiring.' }, hint: hintOf(B, q),
    payload: { from: it.f.from, segments: segView(it.segs), base: q.level === 'easy' ? g.base : null },
    key: { accepted: g.accepted, prev: prevWords(it.segs, 0) }, answerText: g.answer, readChars: it.f.from.length + fill(it.segs).length });
});
def('rightwrong', 5, 'Right or wrong?', '{answer ~distractors}', (B, it) => isS(it), (B, it, q, rng) => {
  const g = gapsOf(it.segs)[0], wrong = rng() < 0.55, d = distr(g, q.level, 1)[0];
  const toks = tokensOf(it.segs, wrong ? { 0: d } : {});
  Object.assign(q, { ui: 'rightwrong', prompt: { en: 'Is this sentence right or wrong?', uz: 'Bu gap toʻgʻrimi yoki notoʻgʻri? Notoʻgʻri boʻlsa, xatoni bosing.' },
    payload: { tokens: toks.map(t => t.w) }, key: { wrong, errIdx: toks.map((t, i) => (t.err ? i : -1)).filter(i => i >= 0) },
    answerText: wrong ? `Wrong: ${d} → ${g.answer}` : 'Right', readChars: fill(it.segs).length });
});
def('find', 5, 'Find the mistake', '{answer ~distractors}', (B, it) => isS(it), (B, it, q) => {
  const g = gapsOf(it.segs)[0], d = distr(g, q.level, 1)[0], toks = tokensOf(it.segs, { 0: d });
  Object.assign(q, { ui: 'tap', prompt: { en: 'Tap the mistake.', uz: 'Xatoni bosing.' }, payload: { tokens: toks.map(t => t.w), need: null, single: true },
    key: { targets: toks.map((t, i) => (t.err ? i : -1)).filter(i => i >= 0), single: true }, answerText: `${d} → ${g.answer}`, readChars: fill(it.segs).length });
});
def('fix', 5, 'Fix the mistake', '{answer ~distractors}', (B, it) => isS(it), (B, it, q) => {
  const g = gapsOf(it.segs)[0], d = distr(g, q.level, 1)[0], toks = tokensOf(it.segs, { 0: d });
  Object.assign(q, { ui: 'fix', prompt: { en: 'Find the mistake and fix it.', uz: 'Xatoni toping va tuzating.' }, payload: { tokens: toks.map(t => t.w) },
    key: { errIdx: toks.map((t, i) => (t.err ? i : -1)).filter(i => i >= 0), accepted: g.accepted, prev: prevWords(it.segs, 0) },
    answerText: `${d} → ${g.answer}`, readChars: fill(it.segs).length });
});
def('sort', 5, 'Sort into two', 'lines of two #confuse rules', (B, it) => isS(it) && confusables(B, it.rule).length > 0 && diffTense(B, it).length >= 2, (B, it, q, rng) => {
  const n = q.level === 'easy' ? 2 : 3; const A = TENSE(B, it.rule), Bt = TENSE(B, confusables(B, it.rule)[0]);
  const rows = shuffle([it, ...shuffle(sameTense(B, it), rng).slice(0, n - 1), ...shuffle(diffTense(B, it), rng).slice(0, n)], rng);
  Object.assign(q, { ui: 'sort', prompt: { en: 'Sort the sentences.', uz: 'Gaplarni ajrating.' }, payload: { rows: rows.map(x => fill(x.segs)), bins: [A, Bt] },
    key: { bins: rows.map(x => (TENSE(B, x.rule) === A ? 0 : 1)) }, rowRules: rows.map(x => x.rule),
    answerText: rows.map(x => `${fill(x.segs)} → ${TENSE(B, x.rule)}`).join(' · '), feedback: `${(B.rules[it.rule] || {}).uz || ''} ${(B.rules[confusables(B, it.rule)[0]] || {}).uz || ''}`.trim(),
    readChars: rows.reduce((s, x) => s + fill(x.segs).length, 0), extraItems: rows.filter(x => x !== it).map(x => x.key) });
});
def('pair', 5, 'Contrast pair', 'pair: + sit: on two lines', (B, it) => isS(it) && !!it.f.pair && !!it.f.sit && B.items.some(x => x !== it && x.f.pair === it.f.pair && x.f.sit), (B, it, q, rng) => {
  const mate = B.items.find(x => x !== it && x.f.pair === it.f.pair && x.f.sit); const S = shuffle([it, mate], rng), C = shuffle([it, mate], rng);
  Object.assign(q, { ui: 'pair', prompt: { en: 'Which sentence fits each situation?', uz: 'Har bir vaziyatga mos gapni tanlang.' },
    payload: { sentences: S.map(x => fill(x.segs)), contexts: C.map(x => x.f.sit) }, key: { map: C.map(c => S.indexOf(c)) }, rowRules: C.map(x => x.rule),
    answerText: C.map(c => `${c.f.sit} → ${fill(c.segs)}`).join(' · '), feedback: `${it.f.fb || ''} ${mate.f.fb || ''}`.trim(),
    readChars: [...S, ...C].reduce((s, x) => s + fill(x.segs).length, 0), extraItems: [mate.key] });
});
def('dialog', 6, 'Dialogue fill', 'dialog item', (B, it) => it.kind === 'dialog', (B, it, q, rng) => {
  const select = q.level === 'easy'; const gaps = [], keys = [], gapRules = [];
  const turns = it.turns.map((segs, ti) => {
    const view = []; let gi = -1;
    segs.forEach(sg => {
      if (sg.gap) {
        gi++; const g = sg.gap; view.push({ gap: gaps.length });
        gaps.push(select ? { options: shuffle([g.answer, ...distr(g, 'easy', 2)], rng) } : { base: g.base });
        keys.push({ answer: g.answer, accepted: g.accepted, prev: prevWords(segs, gi) }); gapRules.push(g.rule || it.rule);
      } else view.push({ t: sg.t });
    });
    return { side: ti % 2 ? 'b' : 'a', segments: view };
  });
  Object.assign(q, { ui: 'dialog', prompt: { en: 'Complete the conversation.', uz: 'Suhbatni toʻldiring.' }, payload: { turns, gaps, input: select ? 'select' : 'type' },
    key: { gaps: keys, input: select ? 'select' : 'type' }, gapRules, answerText: it.turns.map(t => fill(t)).join(' / '), readChars: it.turns.reduce((n, t) => n + fill(t).length, 0) });
});
def('chain', 6, 'Sentence chain', 'chain item', (B, it) => it.kind === 'chain', (B, it, q, rng) => {
  const steps = [], answers = [], gapRules = [];
  it.steps.forEach(segs => {
    const g = gapsOf(segs)[0];
    const { options, correct } = letterOptions([{ text: g.answer, ok: true }, ...distr(g, q.level, q.level === 'easy' ? 2 : 3).map(d => ({ text: d, ok: false }))], rng);
    steps.push({ segments: segView(segs), options }); answers.push(correct); gapRules.push(g.rule || it.rule);
  });
  Object.assign(q, { ui: 'chain', prompt: { en: 'Answer step by step.', uz: 'Bosqichma-bosqich javob bering.' }, payload: { steps },
    key: { answers }, gapRules, answerText: it.steps.map(s => fill(s)).join(' '), readChars: it.steps.reduce((n, s) => n + fill(s).length, 0) });
});
def('uz', 6, 'Uzbek → English tiles', 'uz:', (B, it) => isS(it) && !!it.f.uz, (B, it, q, rng) => {
  const { full, punct, words } = sentenceParts(it);
  Object.assign(q, { ui: 'tiles', prompt: { en: 'Translate with the tiles.', uz: 'Plitkalar bilan inglizchaga tarjima qiling.' },
    payload: { uz: it.f.uz, tiles: shuffle([...words, ...decoyWords([it], words, q.level === 'easy' ? 1 : 3, rng)], rng), auto: null, punct },
    key: { accepted: orderSet(it, full), punct }, answerText: full, readChars: it.f.uz.length });
});

/* =====================================================================
   8. Build a question from a plan, grade a response
   ===================================================================== */
/** plan = { type, item (key), level, tier, rule, seed } -> question data for the UI. */
export function buildQuestion(B, plan) {
  const it = B.byKey[plan.item]; if (!it) throw new Error(`Unknown item ${plan.item}`);
  const T = TYPES[plan.type]; if (!T) throw new Error(`Unknown type ${plan.type}`);
  if (!T.avail(B, it)) throw new Error(`Type ${plan.type} cannot be built from ${plan.item}`);
  const rng = mulberry32(plan.seed >>> 0);
  const q = { v: 1, type: T.id, typeName: T.name, tier: plan.tier || T.tier, tierName: TIERS[(plan.tier || T.tier) - 1].name, level: plan.level,
    rule: plan.rule || it.rule, item: it.key, hint: null, feedback: null, gapRules: null, rowRules: null, extraItems: [] };
  T.build(B, it, q, rng);
  if (!q.feedback) q.feedback = it.f.fb || (B.rules[q.rule] || {}).uz || null;
  q.slowDown = !!plan.slowDown; q.delayOptionsMs = plan.slowDown ? CONFIG.slowDownMs : 0;
  return q;
}

/** Returns { ok, perRule: { ruleId: true|false }, detail }. */
export function grade(q, r) {
  r = r || {}; let ok = false; const detail = {};
  const k = q.key;
  switch (q.ui) {
    case 'choice': ok = r.choice === k.correct; break;
    case 'tap': ok = k.single ? k.targets.includes((r.selected || [])[0]) : sameSet(r.selected || [], k.targets); break;
    case 'match': ok = Array.isArray(r.pairs) && k.pairs.every((p, i) => r.pairs[i] === p); break;
    case 'selects': detail.gaps = k.answers.map((a, i) => (r.values || [])[i] === a); ok = detail.gaps.every(Boolean); break;
    case 'type': ok = checkTyped(r.text, k); if (hasCyrillic(r.text)) detail.cyrillic = true; break;
    case 'slots': detail.gaps = k.answers.map((a, i) => (r.values || [])[i] === a); ok = detail.gaps.every(Boolean); break;
    case 'tiles': {
      const joined = (r.tiles || []).join(' ');
      ok = k.exact != null ? joined === k.exact : k.accepted.includes(norm(joined + (k.punct || '')));
      break;
    }
    case 'rightwrong': ok = k.wrong ? (r.verdict === 'wrong' && k.errIdx.includes(r.tapped)) : r.verdict === 'right'; break;
    case 'fix': ok = k.errIdx.includes(r.tapped) && checkTyped(r.text, k); break;
    case 'sort': detail.gaps = k.bins.map((b, i) => (r.bins || [])[i] === b); ok = detail.gaps.every(Boolean); break;
    case 'pair': detail.gaps = k.map.map((m, i) => (r.map || [])[i] === m); ok = detail.gaps.every(Boolean); break;
    case 'dialog': detail.gaps = k.gaps.map((g, i) => { const v = (r.values || [])[i]; return k.input === 'select' ? v === g.answer : checkTyped(v, g); }); ok = detail.gaps.every(Boolean); break;
    case 'chain': detail.gaps = k.answers.map((a, i) => (r.choices || [])[i] === a); ok = detail.gaps.every(Boolean); break;
    default: throw new Error(`Unknown ui ${q.ui}`);
  }
  // Per-rule result: multi-gap questions credit every rule they contain.
  const perRule = {};
  const owners = q.gapRules || q.rowRules;
  if (owners && detail.gaps) {
    owners.forEach((rule, i) => { perRule[rule] = (perRule[rule] !== false) && !!detail.gaps[i]; });
    if (!(q.rule in perRule)) perRule[q.rule] = ok;
  } else perRule[q.rule] = ok;
  return { ok, perRule, detail };
}

/** A correct response for any question (used by tests and by the teacher's "show answer"). */
export function correctResponse(q) {
  const k = q.key;
  switch (q.ui) {
    case 'choice': return { choice: k.correct };
    case 'tap': return { selected: k.single ? [k.targets[0]] : k.targets.slice() };
    case 'match': return { pairs: k.pairs.slice() };
    case 'selects': return { values: k.answers.slice() };
    case 'type': return { text: k.accepted[0] };
    case 'slots': return { values: k.answers.slice() };
    case 'tiles': {
      if (k.exact != null) return { tiles: k.exact.split(' ') };
      const tiles = q.payload.tiles.slice(); const want = q.answerText.replace(/[.?!]$/, '').split(' ');
      return { tiles: want.filter(w => tiles.includes(w)) };
    }
    case 'rightwrong': return k.wrong ? { verdict: 'wrong', tapped: k.errIdx[0] } : { verdict: 'right' };
    case 'fix': return { tapped: k.errIdx[0], text: k.accepted[0] };
    case 'sort': return { bins: k.bins.slice() };
    case 'pair': return { map: k.map.slice() };
    case 'dialog': return { values: k.gaps.map(g => g.answer) };
    case 'chain': return { choices: k.answers.slice() };
  }
  return {};
}
/** Minimum time (ms) a real answer needs; faster answers give no evidence. */
export function rapidThreshold(q) {
  return (CONFIG.rapidBaseMs[q.ui] || 800) + CONFIG.rapidPerCharMs * (q.readChars || 0) + (q.delayOptionsMs || 0);
}

/* =====================================================================
   9. Student state, sessions and events
   ===================================================================== */
export function newStudentState() {
  return { v: 1, rules: {}, sessions: {}, hist: { types: [], items: [], ctx: [] }, rapid: [], applied: 0 };
}
function rs(S, r) {
  if (!S.rules[r]) S.rules[r] = { step: 0, streak: 0, used: [], wrongRow: 0, lastQ: -1, attempts: 0, correct: 0,
    reviewLevel: 0, reviewDue: null, lastReviewDay: null, secure: false, everLearned: false, learnedDay: null };
  return S.rules[r];
}
export const stepName = s => (s >= 12 ? 'Learned' : `Tier ${Math.floor(s / 2) + 1} ${TIERS[Math.floor(s / 2)].name} · ${s % 2 ? 'hard' : 'easy'}`);

/** Status of a rule for "My grammar" and the teacher view. */
export function ruleStatus(S, r, day) {
  const s = S.rules[r]; if (!s) return { status: 'new', step: 0, label: 'Not started' };
  if (s.step < 12) return { status: s.everLearned ? 'relearn' : 'learning', step: s.step, label: stepName(s.step), streak: s.streak };
  if (s.secure) return { status: 'secure', step: 12, label: 'Learned for good', reviewDue: s.reviewDue, due: s.reviewDue != null && day >= s.reviewDue };
  return { status: 'reviewing', step: 12, label: `Learned · review ${s.reviewLevel + 1} of ${CONFIG.secureAfterReviews}`, reviewDue: s.reviewDue, due: s.reviewDue != null && day >= s.reviewDue };
}

/** Start a session. Returns the event to save; also applies it. mode: 'class' | 'home' | 'review'. */
export function startSession(S, B, { id, mode, packIds = [], day, seed, target }) {
  if (!['class', 'home', 'review'].includes(mode)) throw new Error('mode must be class, home or review');
  const packTarget = Math.min(...packIds.map(p => (B.packs[p] && B.packs[p].meta.target) || 6), 6);
  const ev = { kind: 'session', id, mode, packIds, day, seed: seed >>> 0, target: target || packTarget || 6 };
  applyEvent(S, B, ev);
  return ev;
}
function lessonRules(B, packIds) {
  const set = new Set();
  packIds.forEach(p => { const P = B.packs[p]; if (P) P.items.forEach(it => rulesOfItem(it).forEach(r => set.add(r))); });
  return B.ruleOrder.filter(r => set.has(r));
}
const EMPTY = { step: 0, streak: 0, used: [], wrongRow: 0, lastQ: -1, everLearned: false };
const peek = (S, r) => S.rules[r] || EMPTY; // read-only: never creates state
function sessionGoal(sess) { return sess.mode === 'class' ? sess.target * 2 : 12; }
function activeLearning(S, B, sess) {
  if (sess.mode === 'review') return [];
  const lessons = lessonRules(B, sess.packIds);
  const relearn = Object.keys(S.rules).filter(r => S.rules[r].everLearned && S.rules[r].step < 12 && B.rules[r]);
  const all = [...new Set([...lessons, ...relearn])];
  return all.filter(r => peek(S, r).step < sessionGoal(sess));
}
function dueReviews(S, B, sess, exclude = []) {
  return Object.keys(S.rules)
    .filter(r => B.rules[r] && !exclude.includes(r))
    .filter(r => { const s = S.rules[r]; return s.step >= 12 && s.reviewDue != null && sess.day >= s.reviewDue && s.lastReviewDay !== sess.day; })
    .filter(r => !sess.reviewed.includes(r))
    .sort((a, b) => S.rules[a].reviewDue - S.rules[b].reviewDue);
}

/* =====================================================================
   10. Choosing the next question (pure: reads state, never changes it)
   ===================================================================== */
export function nextQuestion(S, B, sessionId) {
  const sess = S.sessions[sessionId]; if (!sess) throw new Error(`No session ${sessionId}`);
  if (sess.qn >= CONFIG.sessionMax[sess.mode]) return null;
  const rng = mulberry32(hashSeed(sess.seed, sess.qn, 'next'));
  const why = [];
  const learn = activeLearning(S, B, sess);
  const lessons = lessonRules(B, sess.packIds);
  let rule = null, mode = 'learn', fromRequeue = null;

  const due = sess.requeue.find(e => e.at <= sess.qn && (learn.includes(e.rule) || (e.mode === 'review' && dueReviews(S, B, sess).includes(e.rule))));
  if (due) {
    rule = due.rule; mode = due.mode || 'learn'; fromRequeue = due.id;
    const ago = sess.qn - due.from; why.push(`Comeback: ${rule} was wrong ${ago} question${ago === 1 ? '' : 's'} ago. Same rule, different sentence.`);
  } else if (sess.mode === 'review') {
    const d = dueReviews(S, B, sess); if (!d.length) return null;
    rule = d[0]; mode = 'review'; why.push(`Review: ${rule} was due on day ${S.rules[rule].reviewDue} (today is day ${sess.day}).`);
  } else {
    const d = sess.mode === 'home' ? dueReviews(S, B, sess, lessons) : [];
    if (d.length && sess.qn > 0 && sess.qn % CONFIG.reviewEvery === CONFIG.reviewEvery - 1) {
      rule = d[0]; mode = 'review'; why.push(`Mixed review of an older rule: ${rule} was due on day ${S.rules[rule].reviewDue}.`);
    } else if (learn.length) {
      rule = learn.slice().sort((a, b) => peek(S, a).step - peek(S, b).step || peek(S, a).lastQ - peek(S, b).lastQ)[0];
      why.push(`Weakest rule now: ${rule} (${stepName(peek(S, rule).step)}).`);
    } else if (d.length) {
      rule = d[0]; mode = 'review'; why.push(`Lesson goals met; reviewing ${rule}, due on day ${S.rules[rule].reviewDue}.`);
    } else return null;
  }

  const s = peek(S, rule);
  const tier = mode === 'review' ? 6 : Math.floor(s.step / 2) + 1;
  const level = mode === 'review' ? 'hard' : (s.step % 2 ? 'hard' : 'easy');
  const itemsFor = t => B.items.filter(it => it.rule === rule && TYPES[t].avail(B, it));
  let types = (mode === 'review' ? REVIEW_TYPES : TIERS[tier - 1].types).filter(t => itemsFor(t).length);
  if (!types.length) types = TYPE_ORDER.filter(t => itemsFor(t).length); // last resort: any type the pack supports
  if (!types.length) return null;
  const last = S.hist.types.slice(-CONFIG.maxSameTypeInRow);
  let cand = types.filter(t => !(last.length === CONFIG.maxSameTypeInRow && last.every(x => x === t)));
  if (!cand.length) cand = types;
  const recent = S.hist.types.slice(-CONFIG.recentTypeWindow);
  const scored = cand.map((t, i) => ({ t, sc: recent.filter(x => x === t).length + (mode === 'review' ? i * 0.15 : 0) + rng() * 0.9 })).sort((a, b) => a.sc - b.sc);
  const type = scored[0].t;
  why.push(`Type "${TYPES[type].name}": allowed ${mode === 'review' ? 'for reviews' : `at Tier ${tier}`}; used ${recent.filter(x => x === type).length}× in the last ${CONFIG.recentTypeWindow}.`);

  const lastCtx = S.hist.ctx[S.hist.ctx.length - 1];
  const recentItems = S.hist.items.slice(-CONFIG.recentItemWindow);
  const items = itemsFor(type).map(it => ({ it,
    sc: (s.used.includes(it.key) ? 3 : 0) + (recentItems.includes(it.key) ? 2 : 0) + (it.f.ctx && it.f.ctx === lastCtx ? 1 : 0) + rng() * 0.5 }))
    .sort((a, b) => a.sc - b.sc);
  const item = items[0].it;
  why.push(`Sentence ${item.id}${item.f.ctx ? ` (${item.f.ctx})` : ''}: ${s.used.includes(item.key) ? 'reused (no fresh sentence left)' : 'not used in this streak'}${item.f.ctx && item.f.ctx === lastCtx ? '; same theme as last (no other option)' : ''}.`);
  why.push(`Level ${level}: ${level === 'easy' ? 'rule hint, fewer options, obvious distractors.' : 'no hint, all distractors, closest mistakes first.'}`);

  const rapidRecent = S.rapid.slice(-CONFIG.rapidWindow).filter(Boolean).length;
  const slowDown = rapidRecent >= CONFIG.rapidLimit;
  if (slowDown) why.push(`Slow-down: ${rapidRecent} answers in the last ${CONFIG.rapidWindow} were too fast to count; options appear after ${CONFIG.slowDownMs / 1000} s.`);

  return { session: sessionId, qn: sess.qn, mode, rule, type, item: item.key, level, tier, fromRequeue, slowDown,
    seed: hashSeed(sess.seed, sess.qn, item.key, type), why };
}

/* =====================================================================
   11. Recording an answer
   ===================================================================== */
/** Grades, builds the event (to save online) and applies it. eventId must be unique (e.g. crypto.randomUUID()). */
export function submitAnswer(S, B, sessionId, plan, q, response, rtMs, eventId) {
  const g = grade(q, response);
  const rapid = typeof rtMs === 'number' && rtMs < rapidThreshold(q);
  const ev = { kind: 'answer', id: eventId, session: sessionId, day: S.sessions[sessionId].day, qn: plan.qn, mode: plan.mode, rule: plan.rule,
    type: plan.type, item: plan.item, level: plan.level, tier: plan.tier, fromRequeue: plan.fromRequeue || null,
    ok: g.ok, perRule: g.perRule, rapid, rtMs: rtMs == null ? null : Math.round(rtMs), response, extraItems: q.extraItems || [] };
  const log = applyEvent(S, B, ev);
  return { event: ev, result: g, log };
}

/** Applies one event to the state and returns human-readable log lines. Used live and by replay. */
export function applyEvent(S, B, ev, overrides = {}) {
  S.applied++;
  if (ev.kind === 'session') {
    S.sessions[ev.id] = { id: ev.id, mode: ev.mode, packIds: ev.packIds, day: ev.day, seed: ev.seed, target: ev.target, qn: 0, requeue: [], reviewed: [], nextReq: 1 };
    return [`Session ${ev.id} started (${ev.mode}, day ${ev.day}).`];
  }
  if (ev.kind !== 'answer') return [];
  const sess = S.sessions[ev.session]; if (!sess) return ['Answer for an unknown session ignored.'];
  const log = [];
  const ov = overrides[ev.id];
  const perRule = ov == null ? ev.perRule : Object.fromEntries(Object.keys(ev.perRule).map(r => [r, ov]));
  const ok = ov == null ? ev.ok : ov;
  if (ov != null) log.push(`Teacher correction applied: counted as ${ov ? 'correct' : 'wrong'}.`);

  if (ev.fromRequeue) sess.requeue = sess.requeue.filter(e => e.id !== ev.fromRequeue);
  sess.qn++;
  S.hist.types.push(ev.type); S.hist.items.push(ev.item);
  const it = B.byKey[ev.item]; S.hist.ctx.push(it && it.f.ctx || null);
  ['types', 'items', 'ctx'].forEach(k => { if (S.hist[k].length > 50) S.hist[k] = S.hist[k].slice(-50); });
  S.rapid.push(!!ev.rapid); if (S.rapid.length > 20) S.rapid = S.rapid.slice(-20);

  const s = rs(S, ev.rule); s.attempts++; if (ok) s.correct++; s.lastQ = S.applied;
  const requeue = (rule, m) => {
    const gap = CONFIG.comebackMin + Math.floor(mulberry32(hashSeed(sess.seed, sess.qn, rule, 'rq'))() * (CONFIG.comebackMax - CONFIG.comebackMin + 1));
    sess.requeue.push({ id: sess.nextReq++, rule, mode: m, at: sess.qn + gap, from: sess.qn });
    return gap;
  };

  if (ev.rapid) {
    log.push(`Too fast to count (${ev.rtMs} ms): no evidence, the ladder does not move.`);
    if (!ok) log.push(`${ev.rule} comes back in ${requeue(ev.rule, ev.mode)} questions.`);
    return log;
  }

  if (ev.mode === 'review') {
    sess.reviewed.push(ev.rule);
    if (s.lastReviewDay === ev.day) { log.push('Second review today: it teaches but does not change the schedule.'); return log; }
    s.lastReviewDay = ev.day;
    const rok = perRule[ev.rule] !== false && ok;
    if (rok) {
      s.reviewLevel++;
      if (!s.secure && s.reviewLevel >= CONFIG.secureAfterReviews) { s.secure = true; log.push(`${ev.rule}: passed ${CONFIG.secureAfterReviews} spaced reviews → learned for good.`); }
      s.reviewDue = ev.day + CONFIG.reviewDays[Math.min(s.reviewLevel, CONFIG.reviewDays.length - 1)];
      log.push(`Review passed. Next review on day ${s.reviewDue}.`);
    } else {
      s.secure = false; s.reviewLevel = 0; s.reviewDue = null; s.step = Math.min(s.step, CONFIG.reviewFailStep); s.streak = 0; s.used = []; s.wrongRow = 0;
      log.push(`Review missed → ${ev.rule} goes back to ${stepName(s.step)} and is relearned in the next homework or classwork.`);
    }
    return log;
  }

  // learning question
  const used = [ev.item];
  const goal = sessionGoal(sess);
  const handle = (rule, rok, primary) => {
    const r = rs(S, rule);
    if (!primary) {
      if (!CONFIG.secondaryCredit || r.step >= goal || r.step >= 12) return;
      if (Math.floor(r.step / 2) + 1 > ev.tier) return; // only counts if the question was at or above that rule's tier
    }
    if (rok) {
      r.streak++; used.forEach(k => { if (!r.used.includes(k)) r.used.push(k); }); r.wrongRow = 0;
      if (r.streak >= CONFIG.streakToMoveUp) {
        r.step++; r.streak = 0; r.used = [];
        log.push(`${rule}: ${CONFIG.streakToMoveUp} correct in ${CONFIG.streakToMoveUp} different sentences → ${stepName(r.step)}.`);
        if (r.step >= 12) {
          r.everLearned = true; r.learnedDay = ev.day; r.reviewLevel = 0; r.secure = false; r.reviewDue = ev.day + CONFIG.reviewDays[0];
          log.push(`${rule}: learned today. First review on day ${r.reviewDue}.`);
        } else if (sess.mode === 'class' && r.step >= goal) log.push(`${rule}: reached the lesson target (Tier ${sess.target}). Homework continues from Tier ${sess.target + 1}.`);
      } else log.push(`${rule}${primary ? '' : ' (also in this question)'}: correct, streak ${r.streak}/${CONFIG.streakToMoveUp} at ${stepName(r.step)}.`);
    } else {
      r.streak = 0; r.used = []; r.wrongRow++;
      log.push(`${rule}${primary ? '' : ' (also in this question)'}: wrong, streak reset; comes back in ${requeue(rule, 'learn')} questions with another sentence.`);
      if (r.wrongRow >= CONFIG.wrongRowToDrop) { r.step = Math.max(0, r.step - 1); r.wrongRow = 0; log.push(`${rule}: ${CONFIG.wrongRowToDrop} wrong in a row → down to ${stepName(r.step)}.`); }
    }
  };
  handle(ev.rule, perRule[ev.rule] !== undefined ? perRule[ev.rule] : ok, true);
  Object.keys(perRule).filter(r => r !== ev.rule && B.rules[r]).forEach(r => handle(r, perRule[r], false));
  return log;
}

/** Rebuilds a student's state from all their events. overrides = { eventId: true|false } from teacher corrections. */
export function replay(B, events, overrides = {}) {
  const S = newStudentState();
  events.forEach(ev => applyEvent(S, B, ev, overrides));
  return S;
}

/** True when the session has nothing left to ask (goals met or question limit reached). */
export function sessionDone(S, B, sessionId) { return nextQuestion(S, B, sessionId) === null; }

/** Summary for the end screen and the teacher view. */
export function sessionSummary(S, B, sessionId) {
  const sess = S.sessions[sessionId];
  const rules = [...new Set([...lessonRules(B, sess.packIds), ...sess.reviewed])];
  return { session: sessionId, mode: sess.mode, questions: sess.qn, rules: rules.map(r => ({ rule: r, ...ruleStatus(S, r, sess.day) })) };
}

/* =====================================================================
   12. Validator: checks a pasted pack before it goes live
   ===================================================================== */
/** Returns [{ level: 'fail'|'warn'|'pass', msg }]. Any 'fail' blocks the pack. */
export function validatePack(P, bankForRules) {
  const out = []; const add = (level, msg) => out.push({ level, msg });
  const rules = bankForRules ? { ...bankForRules.rules, ...P.rules } : P.rules;
  P.errors.forEach(e => add('fail', `Line ${e.line}: ${e.msg}`));
  const gaps = []; P.items.forEach(it => itemSegsList(it).forEach((segs, si) => gapsOf(segs).forEach(g => gaps.push({ it, g, si }))));
  P.items.forEach(it => { if (!rules[it.rule]) add('fail', `Line ${it.line}: rule ${it.rule} is not defined.`); });
  gaps.forEach(({ it, g }) => {
    if (g.rule && !rules[g.rule]) add('fail', `Line ${it.line}: gap rule #${g.rule} is not defined.`);
    if (!g.answer) add('fail', `Line ${it.line}: a gap has no answer.`);
    if (g.distractors.length < 2) add('fail', `Line ${it.line}: gap "${g.answer}" needs at least 2 distractors.`);
    if (g.distractors.some(d => g.accepted.some(a => norm(a) === norm(d)))) add('fail', `Line ${it.line}: a distractor of "${g.answer}" is also an accepted answer.`);
    if (new Set(g.distractors.map(norm)).size !== g.distractors.length) add('fail', `Line ${it.line}: repeated distractor in "${g.answer}".`);
    if (/[аеосрхуі]/i.test(g.answer + g.distractors.join(''))) add('fail', `Line ${it.line}: Cyrillic letters inside an English gap.`);
  });
  P.items.filter(isS).forEach(it => { if (gapsOf(it.segs).length !== 1) add('fail', `Line ${it.line}: a sentence item must have exactly one gap.`); });
  P.items.filter(it => it.kind === 'chain').forEach(it => it.steps.forEach((s, i) => { if (gapsOf(s).length !== 1) add('fail', `Line ${it.line}: chain step ${i + 1} must have exactly one gap.`); }));
  P.items.filter(it => it.kind === 'dialog' || it.kind === 'text').forEach(it => { if (itemSegsList(it).reduce((n, s) => n + gapsOf(s).length, 0) < 2) add('warn', `Line ${it.line}: a ${it.kind} item usually has 2 or more gaps.`); });
  const tl = bankForRules ? { ...bankForRules.tl, ...P.tl } : P.tl;
  P.items.filter(x => x.f.tl).forEach(it => { if (!(it.f.tl in tl)) add('fail', `Line ${it.line}: timeline "${it.f.tl}" is not defined with #tl.`); });
  P.items.filter(x => x.f.pair).forEach(it => { if (!P.items.some(y => y !== it && y.f.pair === it.f.pair)) add('fail', `Line ${it.line}: pair "${it.f.pair}" has no partner.`); });
  P.items.filter(x => x.q).forEach(it => { if (it.q.others.length < 2) add('fail', `Line ${it.line}: q: needs a right answer and 2 wrong ones.`); });
  P.confuse.forEach(g => g.forEach(r => { if (!rules[r]) add('fail', `#confuse uses undefined rule ${r}.`); }));
  P.items.filter(x => x.f.uz).forEach(it => { if (/o'|g'|o`|g`/i.test(it.f.uz)) add('warn', `Line ${it.line}: Uzbek text uses ' for oʻ/gʻ; use ʻ.`); });
  P.items.filter(x => x.f.fb).forEach(it => { if (/o'|g'/i.test(it.f.fb)) add('warn', `Line ${it.line}: feedback uses ' for oʻ/gʻ; use ʻ.`); });
  if (!P.meta.target) add('warn', 'No #lesson target=N: classwork will go to Tier 6.');
  if (P.errors.length || out.some(o => o.level === 'fail')) return out;
  const B = buildBank(bankForRules ? [...Object.values(bankForRules.packs).filter(x => x.id !== P.id), P] : [P]);
  P.ruleOrder.forEach(r => {
    const n = B.items.filter(x => x.rule === r).length;
    add(n >= 4 ? 'pass' : 'warn', `${r}: ${n} items${n < 4 ? ' (fewer than 4: the engine will reuse sentences inside a streak)' : ''}.`);
    const perTier = TIERS.map(T => T.types.filter(t => B.items.some(it => it.rule === r && TYPES[t].avail(B, it))).length);
    const thin = perTier.map((c, i) => (c < 2 ? i + 1 : 0)).filter(Boolean);
    add(thin.length ? 'warn' : 'pass', `${r}: types per tier ${perTier.join(' / ')}${thin.length ? ` (Tier ${thin.join(', ')} has little variety; add fields or text/dialog/chain items)` : ''}.`);
    TYPE_ORDER.forEach(t => B.items.filter(it => it.rule === r && TYPES[t].avail(B, it)).forEach(it => ['easy', 'hard'].forEach(level => {
      try { const q = buildQuestion(B, { type: t, item: it.key, level, tier: TYPES[t].tier, rule: r, seed: 1 }); if (!grade(q, correctResponse(q)).ok) add('fail', `Line ${it.line}: ${TYPES[t].name} (${level}) cannot be answered correctly.`); }
      catch (e) { add('fail', `Line ${it.line}: ${TYPES[t].name} (${level}) failed to build: ${e.message}`); }
    })));
  });
  const noUz = P.items.filter(x => isS(x) && !x.f.uz).map(x => x.id);
  if (noUz.length) add('warn', `No uz: on ${noUz.join(', ')} (Uzbek → English tiles unavailable for them).`);
  if (!out.some(o => o.level !== 'pass')) add('pass', 'Pack is ready.');
  return out;
}
