/* =====================================================================
   VOCABULARY ENGINE (plan: vocab-engine-plan.md)
   Ladder (how a word is asked) + FSRS-5 (when it comes back) + honest evidence.
   State is folded from 'meet' and 'vocab' events; teacher overrides recompute it.
   ===================================================================== */
const Vocab = (() => {
  const FSRS = {
    W: [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621],
    DECAY: -0.5, FACTOR: 19 / 81, TARGET: 0.88, MAX_IVL: 180,
    R(t, S) { return Math.pow(1 + FSRS.FACTOR * t / S, FSRS.DECAY); },
    interval(S, r) { return S / FSRS.FACTOR * (Math.pow(r, 1 / FSRS.DECAY) - 1); },
    initD(G) { const W = FSRS.W; return clamp(W[4] - Math.exp(W[5] * (G - 1)) + 1, 1, 10); },
    nextD(D, G) { const W = FSRS.W; const D1 = D + (-W[6] * (G - 3)) * (10 - D) / 9; return clamp(W[7] * FSRS.initD(4) + (1 - W[7]) * D1, 1, 10); },
    recallS(D, S, R, G) { const W = FSRS.W; return S * (1 + Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1) * (G === 2 ? W[15] : 1) * (G === 4 ? W[16] : 1)); },
    forgetS(D, S, R) { const W = FSRS.W; return Math.min(S, W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R))); },
    review(card, G, day) {
      let c;
      if (!card) c = { S: FSRS.W[G - 1], D: FSRS.initD(G), last: day, reps: 1, lapses: G === 1 ? 1 : 0 };
      else { const t = Math.max(0, day - card.last), r = FSRS.R(t, card.S); const S = G === 1 ? FSRS.forgetS(card.D, card.S, r) : FSRS.recallS(card.D, card.S, r, G);
        c = { S: Math.max(0.1, S), D: FSRS.nextD(card.D, G), last: day, reps: card.reps + 1, lapses: card.lapses + (G === 1 ? 1 : 0) }; }
      c.ivl = G === 1 ? 1 : clamp(Math.round(FSRS.interval(c.S, FSRS.TARGET)), 1, FSRS.MAX_IVL); c.due = day + c.ivl; return c;
    },
  };
  // ev: 0 none, 1 weak, 2 medium, 3 strong
  const FMT = {
    meet: { ev: 0, rt: 6000, uz: 'Tanishuv' },
    mc_meaning: { ev: 1, rt: 6000, uz: "Ma'nosini tanlang" },
    mc_word: { ev: 1, rt: 6000, uz: "So'zni tanlang" },
    mc_ctx: { ev: 2, rt: 8000, uz: "Gapga mosini tanlang" },
    type_def: { ev: 3, rt: 8000, typed: true, uz: "So'zni yozing" },
    type_ctx: { ev: 3, rt: 9000, typed: true, use: true, uz: "Gapga yozing" },
    writing: { ev: 3, rt: 0, use: true, uz: 'Yozishda ishlatildi' },
  };
  const EVN = { none: 0, weak: 1, medium: 2, strong: 3 };
  const STAGES = [
    { n: 0, uz: 'Tanishuv', en: 'Meet', c: '#1E74E8', t: '#fff' }, { n: 1, uz: 'Tanish', en: 'Recognize', c: '#6A3DF0', t: '#fff' },
    { n: 2, uz: "Bog'lash", en: 'Connect', c: '#D92F7A', t: '#fff' }, { n: 3, uz: 'Eslash', en: 'Recall', c: '#FF8A1E', t: '#2B1700' },
    { n: 4, uz: 'Ishlatish', en: 'Use', c: '#F5B700', t: '#2B1700' }, { n: 5, uz: "O'zlashtirilgan", en: 'Known', c: '#138A3D', t: '#fff' }];
  const ctxSent = c => (c.sentences || []).filter(s => s.dis && s.dis.length === 3);
  const typeSent = c => (c.sentences || []);

  function newWS(wid) { return { wid, stage: 0, met: false, card: null, fsrsDay: null, fmts2: [], stage4Day: null, lastSeen: null, ok: 0, bad: 0, hist: [], seen: {} }; }
  function ladder(ws, fmt, ev, ok, day, card, sent) {
    const s = ws.stage; let to = s;
    if (!ok) { to = s === 5 ? 3 : Math.max(1, s - 1); ws.fmts2 = []; if (to < 4) ws.stage4Day = null; }
    else if (s <= 1) { if (ev >= 1) to = 2; }
    else if (s === 2) {
      // two correct answers on two DIFFERENT items of context evidence (different sentences, or a context game).
      // A word with one context sentence may finish with a recognition format; a word with none uses two recognition formats.
      const nCtx = card ? ctxSent(card).length : 0, k = fmt + (sent ? '|' + sent : '');
      const accept = ev >= 2 || (ev >= 1 && (nCtx === 0 || (nCtx === 1 && ws.fmts2.some(x => x.startsWith('mc_ctx') || x.startsWith('game:')))));
      if (accept && !ws.fmts2.includes(k)) ws.fmts2.push(k);
      if (ws.fmts2.length >= 2) to = 3;
    } else if (s === 3) { if (ev >= 3) { to = 4; ws.stage4Day = day; } }
    else if (s === 4) { const useOk = card && typeSent(card).length ? FMT[fmt] && FMT[fmt].use || /^game:(boss|fix|unjumble)$/.test(fmt) : ev >= 3; if (useOk && ws.stage4Day != null && day > ws.stage4Day) to = 5; }
    if (to !== s && to === 2) ws.fmts2 = [];
    ws.stage = to; return to;
  }
  function gradeFor(ev, ok, fast) { if (!ok) return 1; if (ev < 3) return 2; return fast ? 4 : 3; }

  /* fold all vocab events of a student → { words: {wid: ws}, theta } */
  function state(sid, cardsById) {
    return Store.memo('voc:' + sid, () => {
      const W = {}; let theta = 0; const rates = [];
      const get = wid => W[wid] || (W[wid] = newWS(wid));
      Store.events(sid).forEach(e => {
        if (e.kind === 'meet') { const ws = get(e.wid); if (!ws.met) { ws.met = true; ws.stage = Math.max(ws.stage, 1); } ws.lastSeen = e.day; ws.hist.push({ day: e.day, fmt: 'meet', ok: true }); return; }
        if (e.kind !== 'vocab') return;
        const ws = get(e.wid); const ok = Store.okOf(e);
        if (ok == null) return;
        if (e.rapid) { ws.hist.push({ day: e.day, fmt: e.fmt, ok, rapid: true }); return; }
        const ev = e.ev != null ? e.ev : (FMT[e.fmt] ? FMT[e.fmt].ev : 1);
        if (ev === 0) return;
        if (!ws.met) { ws.met = true; ws.stage = Math.max(ws.stage, 1); }
        const from = ws.stage;
        const fast = e.rate != null && rates.length >= 3 && e.rate <= rates.slice(-30).sort((a, b) => a - b)[Math.floor(Math.min(rates.length, 30) / 2)];
        if (ev >= 3 && ok && e.rate != null) rates.push(e.rate);
        if (ws.fsrsDay !== e.day) { ws.card = FSRS.review(ws.card, gradeFor(ev, ok, fast), e.day); ws.fsrsDay = e.day; }
        ladder(ws, e.fmt, ev, ok, e.day, cardsById && cardsById[e.wid], e.sent);
        if (ok) ws.ok++; else ws.bad++;
        ws.lastSeen = e.day; if (e.sent) ws.seen[e.sent] = e.day;
        theta += 0.15 * ((ok ? 1 : 0) - sig(theta - (ev - 1.5) * 0.5));
        ws.hist.push({ day: e.day, fmt: e.fmt, ok, from, to: ws.stage, id: e.id, input: e.input });
      });
      return { words: W, theta };
    });
  }
  const sig = x => 1 / (1 + Math.exp(-x));
  const retr = (ws, day) => ws && ws.card ? FSRS.R(Math.max(0, day - ws.card.last), ws.card.S) : null;
  const isDue = (ws, day) => !!(ws && ws.card && day >= ws.card.due && ws.fsrsDay !== day);

  /* ---------------- sessions (one per homework part block) ----------------
     kind: 'new' (lesson words), 'review' (warm-up), 'mix' (final review), 'smart' (Erkin mashq)
     The session is rebuilt from current state each time it asks, so closing a part midway
     and coming back continues exactly where the student is. */
  function Session(o) {
    this.sid = o.sid; this.kind = o.kind; this.cards = o.cards; this.all = o.allCards; this.byId = Object.fromEntries(o.allCards.map(c => [c.id, c]));
    this.min = o.min || 4; this.max = o.max || 24; this.seed = hash(o.seed || (this.sid + this.kind + T.now()));
    this.day = T.dayNum(); this.n = 0; this.shown = []; this.att = {}; this.answered = {}; this.right = 0; this.done = false; this.boss = false; this.extra = o.extra || [];
    const st = state(this.sid, this.byId), day = this.day;
    const mine = new Set(this.cards.map(c => c.id));
    const old = this.all.filter(c => !mine.has(c.id) && st.words[c.id] && st.words[c.id].met);
    this.due = old.filter(c => isDue(st.words[c.id], day)).sort((a, b) => retr(st.words[a.id], day) - retr(st.words[b.id], day)).map(c => c.id);
    if (this.kind === 'review') {
      this.pool = this.due.slice(0, this.max);
      if (this.pool.length < this.min) old.filter(c => !this.pool.includes(c.id) && st.words[c.id].stage < 5).sort((a, b) => st.words[a.id].stage - st.words[b.id].stage).slice(0, this.min - this.pool.length).forEach(c => this.pool.push(c.id));
      if (!this.pool.length) this.pool = this.cards.filter(c => st.words[c.id] && st.words[c.id].met).map(c => c.id).slice(0, this.max);
    } else if (this.kind === 'new') { this.pool = this.due.slice(0, 4); this.newIds = this.cards.map(c => c.id); }
    else if (this.kind === 'mix') { this.pool = this.cards.map(c => c.id).concat(this.due.filter(x => !mine.has(x))).slice(0, Math.max(this.min, this.max - 1)); }
    else { const met = this.all.filter(c => st.words[c.id] && st.words[c.id].met); met.sort((a, b) => (retr(st.words[a.id], day) || 0) - (retr(st.words[b.id], day) || 0)); this.pool = met.slice(0, this.max).map(c => c.id); }
  }
  Session.prototype.r = function () { this._r = this._r || rng(this.seed); return this._r(); };
  Session.prototype.st = function () { return state(this.sid, this.byId); };
  Session.prototype.formats = function (wid) {
    const ws = this.st().words[wid], c = this.byId[wid]; const s = ws ? ws.stage : 0, R = retr(ws, this.day);
    const hasCtx = ctxSent(c).length > 0, hasType = typeSent(c).length > 0;
    switch (s) {
      case 0: return ['meet'];
      case 1: return ['mc_meaning', 'mc_word'];
      case 2: {
        const nCtx = ctxSent(c).length, hasK = ws.fmts2.some(x => x.startsWith('mc_ctx'));
        if (!nCtx) { const f = ['mc_meaning', 'mc_word'].filter(x => !ws.fmts2.includes(x)); return f.length ? f : ['mc_word']; }
        if (!hasK || nCtx >= 2) return ['mc_ctx'];
        return ['mc_word', 'mc_meaning'];
      }
      case 3: return hasType ? ['type_def', 'type_ctx'] : ['type_def'];
      case 4: return hasType ? ['type_ctx'] : ['type_def'];
      default: return R != null && R < 0.8 ? (hasType ? ['type_ctx', 'type_def'] : ['type_def']) : (hasCtx ? ['mc_ctx', 'mc_meaning'] : ['mc_meaning', 'type_def']);
    }
  };
  Session.prototype.next = function () {
    if (this.pending) return this.pending;
    if (this.done) return null;
    const st = this.st(), self = this;
    let wid = null, fmt = null;
    const left = this.pool.filter(w => !this.answered[w] && (this.att[w] || 0) < 3);
    if (this.kind === 'new') {
      const learning = this.newIds.filter(w => st.words[w] && st.words[w].met && st.words[w].stage < 3 && (this.att[w] || 0) < 7);
      const unmet = this.newIds.filter(w => !st.words[w] || !st.words[w].met);
      const fresh = learning.filter(w => st.words[w].stage <= 1).length;
      const lastMeet = this.shown.map(x => x.fmt).lastIndexOf('meet');
      if (unmet.length && (fresh < 2 || !learning.length) && (this.shown.length - lastMeet >= 2 || !learning.length)) { wid = unmet[0]; fmt = 'meet'; }
      else {
        const cands = learning.concat(left);
        if (!cands.length) { if (unmet.length) { wid = unmet[0]; fmt = 'meet'; } else if (this.n < this.min && this.newIds.length) { const w2 = this.newIds.filter(w => (this.att[w] || 0) < 9); if (w2.length) wid = this.pick(w2); } }
        else wid = this.pick(cands);
      }
    } else if (this.kind === 'mix') {
      if (left.length) wid = this.pick(left);
      else if (!this.boss && this.pool.length) { this.boss = true; wid = this.pool.slice().sort((a, b) => (st.words[a] ? st.words[a].stage : 0) - (st.words[b] ? st.words[b].stage : 0))[0]; const ws = st.words[wid]; if (ws && ws.stage >= 3) fmt = typeSent(this.byId[wid]).length ? 'type_ctx' : 'type_def'; this.isBoss = true; }
    } else { if (left.length) wid = this.pick(left); }
    if (this.n >= this.max) wid = null;
    if (!wid) { this.done = true; return null; }
    if (!fmt) { const fs = this.formats(wid); const last = this.shown.slice(-2).map(x => x.fmt); fmt = fs.find(f => !last.includes(f)) || fs[0]; }
    const it = this.build(wid, fmt); if (this.isBoss && fmt !== 'meet') { it.boss = true; this.isBoss = false; }
    this.pending = it; this.shown.push(it); return it;
  };
  Session.prototype.pick = function (cands) {
    const st = this.st(), last = this.shown.slice(-2).map(x => x.wid), day = this.day;
    let best = null;
    cands.forEach(w => {
      const ws = st.words[w], R = retr(ws, day);
      let sc = (ws && ws.card ? (R < FSRS.TARGET ? 1 : 0.2) : 0.6) + (this.newIds && this.newIds.includes(w) ? 0.8 : 0) - (last.includes(w) ? 2 : 0) - 0.15 * (this.att[w] || 0) + this.r() * 0.3;
      if (!best || sc > best.sc) best = { w, sc };
    });
    return best && best.w;
  };
  Session.prototype.build = function (wid, fmt) {
    const c = this.byId[wid], st = this.st(), it = { fmt, wid, word: c.w, card: c, id: uid('v'), stage: st.words[wid] ? st.words[wid].stage : 0, shownAt: Date.now() };
    const others = this.all.filter(x => x.id !== wid && !(c.confuse || []).includes(x.id) && N.key(x.w) !== N.key(c.w));
    const same = others.filter(x => x.p === c.p), rest = others.filter(x => x.p !== c.p);
    const pool = shuffleS(same, this.seed + wid + this.n).concat(shuffleS(rest, this.seed + wid + 'r'));
    const meaning = x => x.d || x.uz || x.en;
    if (fmt === 'mc_meaning') { const o = shuffleS([c, ...pool.filter(x => meaning(x) !== meaning(c)).slice(0, 3)], this.seed + wid + 'm' + this.n); it.prompt = c.w; it.options = o.map(x => ({ text: meaning(x), wid: x.id })); it.answer = o.indexOf(c); }
    if (fmt === 'mc_word') { const o = shuffleS([c, ...pool.slice(0, 3)], this.seed + wid + 'w' + this.n); it.prompt = meaning(c); it.options = o.map(x => ({ text: x.w, wid: x.id })); it.answer = o.indexOf(c); }
    if (fmt === 'mc_ctx') { const ss = ctxSent(c), used = st.words[wid] ? st.words[wid].fmts2 : []; const fr = ss.filter(x => !used.includes('mc_ctx|' + x.s)); const s = (fr.length ? fr : ss)[(this.n + hash(wid)) % (fr.length || ss.length)]; const o = shuffleS([s.f, ...s.dis], this.seed + wid + 'c' + this.n); it.text = s.s; it.options = o.map(x => ({ text: x })); it.answer = o.indexOf(s.f); it.filled = s.full; it.sent = s.s; }
    if (fmt === 'type_def') { it.prompt = meaning(c); it.answers = [c.w, ...(c.alt || [])]; it.given = c.w[0]; }
    if (fmt === 'type_ctx') { const ss = typeSent(c); const s = ss[(this.n + hash(wid + 't')) % ss.length]; it.text = s.s; it.answers = [s.f, ...(c.alt || [])]; it.given = s.f[0]; it.filled = s.full; it.sent = s.s; it.uz = c.uz; }
    if (fmt === 'meet') { const s = typeSent(c)[0]; it.example = s ? s.full : ''; }
    it.rapidMs = Math.round(0.1 * (FMT[fmt] ? FMT[fmt].rt : 6000));
    return it;
  };
  /* resp: {choice}|{text}|{idk}; returns {ok, correct, almost, confused} and writes the event */
  Session.prototype.submit = function (it, resp, extra) {
    if (it !== this.pending) return null; this.pending = null; this.n++;
    const rt = Date.now() - it.shownAt;
    if (it.fmt === 'meet') { Store.ev(this.sid, 'meet', Object.assign({ wid: it.wid, day: this.day }, extra)); this.att[it.wid] = (this.att[it.wid] || 0) + 1; return { ok: true }; }
    let ok, input = '', almost = false, confused = null;
    if (resp.idk) { ok = false; input = '(Bilmayman)'; }
    else if (it.options) { ok = resp.choice === it.answer; input = it.options[resp.choice] ? it.options[resp.choice].text : ''; confused = !ok && it.options[resp.choice] && it.options[resp.choice].wid; }
    else { const r = N.check(resp.text, it.answers); ok = r.ok; almost = r.almost; input = resp.text; const k = N.key(resp.text); const o = this.all.find(x => x.id !== it.wid && N.key(x.w) === k); if (!ok && o) { confused = o.id; almost = false; } }
    const rapid = !resp.idk && rt < it.rapidMs;
    const rate = FMT[it.fmt].typed && ok ? rt / Math.max(1, String(it.answers[0]).length) : null;
    Store.ev(this.sid, 'vocab', Object.assign({ wid: it.wid, fmt: it.fmt, ok, rapid, rt, day: this.day, input, rate, sent: it.sent || null }, extra));
    this.att[it.wid] = (this.att[it.wid] || 0) + 1;
    if (ok && !rapid) { this.answered[it.wid] = true; this.right++; }
    if (!ok && (this.att[it.wid] || 0) >= 2) this.answered[it.wid] = true;
    return { ok, rapid, almost, confused, idk: !!resp.idk, correct: it.options ? it.options[it.answer].text : it.answers[0] };
  };
  Session.prototype.estimate = function () { if (this.kind === 'new') return Math.max(this.n + 1, Math.min(this.max, this.newIds.length * 4 + this.pool.length)); return Math.max(this.n + 1, Math.min(this.max, this.pool.length + (this.kind === 'mix' ? 1 : 0))); };

  return { FSRS, FMT, EVN, STAGES, state, retr, isDue, Session, ctxSent, typeSent };
})();
