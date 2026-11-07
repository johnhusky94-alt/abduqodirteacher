/* =====================================================================
   CORE — shared by every part of the site
   1. utils  2. time  3. one way to judge typed answers  4. store (event log)
   5. sound, speech, Doni, toast
   ===================================================================== */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const uid = (p = 'e') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
function hash(s) { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffleS(arr, seed) { const r = rng(hash(seed)); const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const wcount = t => (String(t || '').trim().match(/\S+/g) || []).length;
const sum = a => a.reduce((x, y) => x + y, 0);
const by = k => (a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0);

/* ---------------- 2. Time (Tashkent device time; teacher can set a test clock) ---------------- */
const T = {
  DAY: 864e5,
  offset: 0,
  now() { return Date.now() + T.offset; },
  date(ms) { return new Date(ms == null ? T.now() : ms); },
  mins(hm) { const [h, m] = String(hm).split(':'); return (+h) * 60 + (+m); },
  weekStart(ms) { const d = T.date(ms); d.setHours(0, 0, 0, 0); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d.getTime(); },
  /* the moment of a weekday (0=Mon) and hh:mm in the week starting at monday ms */
  at(monday, di, hm) { const d = new Date(monday); d.setDate(d.getDate() + di); const m = T.mins(hm); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.getTime(); },
  addWeeks(monday, n) { const d = new Date(monday); d.setDate(d.getDate() + 7 * n); return d.getTime(); },
  dayNum(ms) { const d = T.date(ms); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); },
  hm(ms) { const d = T.date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); },
  iso(ms) { const d = T.date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
};
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYFULL = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
const UZD = { Mon: 'Dushanba', Tue: 'Seshanba', Wed: 'Chorshanba', Thu: 'Payshanba', Fri: 'Juma', Sat: 'Shanba', Sun: 'Yakshanba' };
const UZM = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const ENM = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ms => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][T.date(ms).getDay()];
const uzWhen = ms => `${UZD[DOW(ms)]}, ${T.date(ms).getDate()}-${UZM[T.date(ms).getMonth()]}, ${T.hm(ms)}`;
const enWhen = ms => `${DOW(ms)} ${T.date(ms).getDate()} ${ENM[T.date(ms).getMonth()]}, ${T.hm(ms)}`;
function uzLeft(ms) { const m = Math.max(0, Math.round(ms / 6e4)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mi = m % 60; return d ? `${d} kun ${h} soat` : h ? `${h} soat ${mi} daqiqa` : `${mi} daqiqa`; }
const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function weekLabel(monday) { const a = T.date(monday), b = T.date(monday + 5 * T.DAY); return `${a.getDate()} ${ENM[a.getMonth()]} – ${b.getDate()} ${ENM[b.getMonth()]}`; }
function weekLabelUz(monday) { const a = T.date(monday), b = T.date(monday + 5 * T.DAY); return `${a.getDate()}-${UZM[a.getMonth()]} – ${b.getDate()}-${UZM[b.getMonth()]}`; }

/* ---------------- 3. One way to judge typed answers (every part of the site) ----------------
   Never a false wrong for: case, spaces, punctuation, apostrophe look-alikes, dashes/hyphens,
   Cyrillic look-alike letters, contractions (isn't = is not, I'm = I am …), the answer typed with
   the words before the gap. Grammar and spelling inside the answer still count. "'s" is never
   expanded (he's = he is OR he has): full forms are contracted for comparison instead. */
const N = (() => {
  const CYR = { 'а': 'a', 'е': 'e', 'о': 'o', 'с': 'c', 'р': 'p', 'х': 'x', 'у': 'y', 'і': 'i', 'к': 'k', 'м': 'm', 'т': 't', 'н': 'h', 'в': 'b', 'ј': 'j', 'ѕ': 's', 'ё': 'e', 'А': 'a', 'Е': 'e', 'О': 'o', 'С': 'c', 'Р': 'p', 'Х': 'x', 'У': 'y', 'І': 'i', 'К': 'k', 'М': 'm', 'Т': 't', 'Н': 'h', 'В': 'b' };
  const CYR_RE = /[аеосрхуікмтнвјѕёАЕОСРХУІКМТНВ]/g;
  const hasCyr = s => /[Ѐ-ӿ]/.test(String(s || ''));
  function base(raw) {
    let s = String(raw == null ? '' : raw).normalize('NFKC').replace(/[​-‍﻿­⁠]/g, '');
    s = s.replace(/[‘’‛ʼʻ´`′ʹ]/g, "'").replace(/[“”«»]/g, '"');
    s = s.replace(/[‐-―−]/g, '-').replace(CYR_RE, c => CYR[c] || c);
    s = s.toLowerCase().replace(/[\s  - 　]+/g, ' ');
    s = s.replace(/\s*'\s*/g, "'").replace(/-/g, ' ');           // hyphens never decide right or wrong
    s = s.replace(/[,;:!?"()\[\]]/g, ' ').replace(/\.+(\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/^'+|'+$/g, '').trim();
    return s;
  }
  function expand(s) {
    return s.replace(/\bim\b/g, "i'm").replace(/\b(i|you|we|they)ve\b/g, "$1've")
      .replace(/\b(do|does|did|has|have|had|is|are|was|were|could|would|should)nt\b/g, "$1n't").replace(/\bcant\b/g, "can't")
      .replace(/\bcan't\b/g, 'can not').replace(/\bcannot\b/g, 'can not').replace(/\bwon't\b/g, 'will not')
      .replace(/n't\b/g, ' not').replace(/'m\b/g, ' am').replace(/'re\b/g, ' are').replace(/'ve\b/g, ' have').replace(/'ll\b/g, ' will')
      .replace(/\s+/g, ' ').trim();
  }
  const contractS = s => s.replace(/\b(he|she|it|who|that|there|what|where|here)\s+(has|is)\b/g, "$1's");
  const key = s => contractS(expand(base(s)));
  function variants(ans, prev) {
    const out = new Set(); const pw = String(prev || '').split(' ').filter(Boolean);
    const list = [ans]; for (let k = 1; k <= pw.length; k++) list.push(pw.slice(-k).join(' ') + ' ' + ans);
    list.forEach(x => out.add(key(x)));
    return out;
  }
  /* accepted: array of right answers; opts.prev: words before the gap (answer may be typed with them) */
  function check(input, accepted, opts = {}) {
    const k = key(input);
    if (!k) return { ok: false, empty: true, cyr: hasCyr(input) };
    const ok = (accepted || []).some(a => variants(a, opts.prev).has(k));
    let almost = false;
    if (!ok) { const a0 = key(accepted[0] || ''); const lim = a0.length <= 6 ? 1 : 2; almost = lev(k, a0) <= lim; }
    return { ok, almost: !ok && almost, cyr: hasCyr(input), input: k };
  }
  function lev(a, b) { const n = a.length, m = b.length; if (Math.abs(n - m) > 3) return 9; const d = []; for (let i = 0; i <= n; i++) d[i] = [i]; for (let j = 0; j <= m; j++) d[0][j] = j;
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) { d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); }
    return d[n][m]; }
  const same = (a, b) => key(a) === key(b);
  /* Uzbek Latin: oʻ gʻ with one character, tutuq belgisi ʼ */
  const uzFix = s => String(s || '').replace(/([oOgG])['`’‘ʼ]/g, '$1ʻ').replace(/(\w)['`’‘](\w)/g, '$1ʼ$2');
  /* hyphen rule: a one-word answer with hyphens (brother-in-law) shows its hyphens; students type the letters */
  const hyphenParts = a => { a = String(a || '').trim(); return a && !/\s/.test(a) && /[A-Za-z]-[A-Za-z]/.test(a) ? a.split('-') : null; };
  return { base, expand, key, check, same, lev, hasCyr, uzFix, hyphenParts };
})();

/* ---------------- 4. Store: one database object, one append-only event log ----------------
   Everything a student does is an event. Results, achko, gold, word stages, trophies are all
   computed from events + teacher overrides, so a teacher correction recomputes history exactly.
   Test mode ("view as student") runs on a copy: nothing is saved. */
const STORE_KEY = 'ingliz-sayt-v1';
const Store = {
  db: null, sandbox: false, listeners: [], castles: {}, noStore: false,
  /* the database lives on the server (net.js): saving sends the changes, nothing is kept only in this browser */
  save() { this._cache = {}; if (this.sandbox) return; Net.changed(); },
  _cache: {},
  enterSandbox() { this._real = this.db; this.db = JSON.parse(JSON.stringify(this.db)); this.sandbox = true; this._cache = {}; this._castleSandbox = {}; },
  leaveSandbox() { if (this._real) this.db = this._real; this._real = null; this.sandbox = false; this._cache = {}; this._castleSandbox = {}; },
  ev(sid, kind, data) {
    const e = Object.assign({ id: uid('e'), sid, kind, ts: T.now() }, data);
    this.db.events.push(e); this._cache = {}; this.save(); return e;
  },
  events(sid) { const c = this._cache['ev:' + sid]; if (c) return c; const r = this.db.events.filter(e => e.sid === sid); this._cache['ev:' + sid] = r; return r; },
  okOf(e) { const o = this.db.overrides[e.id]; return o ? o.ok : e.ok; },
  memo(key, fn) { if (key in this._cache) return this._cache[key]; const v = fn(); this._cache[key] = v; return v; },
  /* castle state: one per student, loaded with the database and sent on its own */
  castleGet(sid) { if (this.sandbox && this._castleSandbox[sid]) return this._castleSandbox[sid]; const c = this.castles[sid]; return c ? JSON.parse(JSON.stringify(c)) : null; },
  castleSet(sid, st) { if (this.sandbox) { this._castleSandbox[sid] = st; return; } this.castles[sid] = JSON.parse(JSON.stringify(st)); Net.castle(sid, this.castles[sid]); },
};

/* ---------------- 5. Sound (code only), speech, Doni, toast ---------------- */
const Snd = (() => {
  let ctx = null; const on = () => { try { return localStorage.getItem('snd') !== '0'; } catch (e) { return true; } };
  function tone(f, d, type = 'sine', vol = .12, when = 0) {
    if (!on()) return; try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f; g.gain.value = vol; o.connect(g); g.connect(ctx.destination); const t = ctx.currentTime + when;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.start(t); o.stop(t + d + .02); } catch (e) {} }
  return { on, toggle() { try { localStorage.setItem('snd', on() ? '0' : '1'); } catch (e) {} },
    ok() { tone(660, .12, 'triangle'); tone(990, .16, 'triangle', .1, .09); },
    no() { tone(220, .18, 'sine', .08); }, tap() { tone(520, .05, 'square', .04); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, .18, 'triangle', .1, i * .09)); } };
})();
const Speech = {
  say(text) { try { if (!('speechSynthesis' in window)) return toast('Bu qurilmada talaffuz yo‘q'); const u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB';
    const vs = speechSynthesis.getVoices(); const v = vs.find(x => /^en(-|_)GB/i.test(x.lang)) || vs.find(x => /^en/i.test(x.lang)); if (v) u.voice = v; u.rate = .9;
    speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {} },
};
try { if ('speechSynthesis' in window) speechSynthesis.getVoices(); } catch (e) {}
function toast(msg) { const t = $('#toast'); if (!t) return; t.innerHTML = `<div class="toast">${esc(msg)}</div>`; clearTimeout(toast.t); toast.t = setTimeout(() => t.innerHTML = '', 2600); }

/* Doni: code-drawn mascot; appears only at real moments, names what the student did, one tap closes */
const Doni = {
  last: 0,
  svg(mood = 'happy', leaves = 1) {
    const eyes = mood === 'calm' ? '<path d="M41 59 Q46 55 51 59M69 59 Q74 55 79 59" stroke="#1C1C1E" stroke-width="3.4" stroke-linecap="round" fill="none"/>'
      : mood === 'surprised' ? '<circle cx="46" cy="57" r="7" fill="#1C1C1E"/><circle cx="74" cy="57" r="7" fill="#1C1C1E"/><circle cx="48" cy="54" r="2.2" fill="#fff"/><circle cx="76" cy="54" r="2.2" fill="#fff"/>'
      : mood === 'sleepy' ? '<path d="M41 59 Q46 62 51 59M69 59 Q74 62 79 59" stroke="#1C1C1E" stroke-width="3.2" stroke-linecap="round" fill="none"/>'
      : '<path d="M40 60 Q46 52 52 60M68 60 Q74 52 80 60" stroke="#1C1C1E" stroke-width="3.6" stroke-linecap="round" fill="none"/>';
    const mouth = mood === 'surprised' ? '<ellipse cx="60" cy="77" rx="5" ry="6" fill="#1C1C1E"/>' : mood === 'calm' || mood === 'sleepy' ? '<path d="M53 76 Q60 80 67 76" stroke="#1C1C1E" stroke-width="3.2" stroke-linecap="round" fill="none"/>' : '<path d="M47 71 Q60 90 73 71 Z" fill="#1C1C1E"/><path d="M53 80 Q60 86 67 80 Q60 77 53 80Z" fill="#FF6F8E"/>';
    return `<svg class="doni-svg ${mood}" viewBox="0 0 120 120" aria-hidden="true"><ellipse cx="60" cy="112" rx="28" ry="5" fill="rgba(0,0,0,.18)"/><g class="bod">
      ${mood === 'party' ? '<path d="M14 30l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="#fff"/><circle cx="104" cy="24" r="3.5" fill="#FFE07A"/><circle cx="98" cy="44" r="2.5" fill="#fff"/>' : ''}
      <path d="M60 22 Q59 14 62 7" stroke="#138A3D" stroke-width="3.5" stroke-linecap="round" fill="none"/><ellipse cx="69" cy="9" rx="8" ry="4.5" fill="#34C063" transform="rotate(-25 69 9)"/>
      ${leaves > 1 ? '<ellipse cx="52" cy="12" rx="7" ry="4" fill="#2BAA55" transform="rotate(25 52 12)"/>' : ''}${leaves > 2 ? '<ellipse cx="66" cy="0" rx="5.5" ry="3.5" fill="#5BD47F" transform="rotate(-60 66 0)"/>' : ''}
      <path d="M60 20 C89 20 103 37 103 64 C103 91 87 106 60 106 C33 106 17 91 17 64 C17 37 31 20 60 20Z" fill="#fff"/>
      <ellipse cx="36" cy="71" rx="7" ry="4.5" fill="#FF8FB3" opacity=".55"/><ellipse cx="84" cy="71" rx="7" ry="4.5" fill="#FF8FB3" opacity=".55"/>${eyes}${mouth}</g></svg>`;
  },
  enabled() { try { return localStorage.getItem('doni') !== '0'; } catch (e) { return true; } },
  show(mood, text, sub, force) {
    if (!this.enabled()) return; const n = Date.now(); if (!force && n - this.last < 9000) return; this.last = n;
    const h = $('#doni'); if (!h) return;
    h.innerHTML = `<div class="doni-pop" role="status">${this.svg(mood, this.leaves || 1)}<div class="doni-bubble"><b>${esc(text)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div></div>`;
    if (mood === 'party') Snd.win(); else Snd.tap();
    clearTimeout(this.t); this.t = setTimeout(() => { h.innerHTML = ''; }, 4200);
  },
};
document.addEventListener('click', e => { if (e.target.closest('.doni-pop')) $('#doni').innerHTML = ''; });
