/* =====================================================================
   SCHOOL LOGIC: timetable, when each work is open, attempts and marks,
   achko, gold, trophies, words for So'zlarim, Erkin mashq.
   Everything here is computed from the database + event log.
   ===================================================================== */
const School = (() => {
  const db = () => Store.db;
  const stu = id => db().students.find(s => s.id === id);
  const cls = id => db().classes.find(c => c.id === id);
  const markOf = p => p > 85 ? 5 : p > 75 ? 4 : p > 55 ? 3 : p > 30 ? 2 : 1;

  function lessonsOf(c) {
    const out = []; let n = 1;
    DAYS.forEach((d, di) => { ((c && c.sched && c.sched[d]) || []).slice().sort((a, b) => a[0].localeCompare(b[0])).forEach(t => out.push({ n: n++, day: d, di, start: t[0], end: t[1] })); });
    return out;
  }
  const lessonLen = L => T.mins(L.end) - T.mins(L.start);
  /* homework of lesson L in week W: opens when that day's last lesson ends; due at the start of the last lesson of the next English day */
  function hwWindow(c, L, week) {
    const ls = lessonsOf(c), today = ls.filter(x => x.day === L.day);
    const open = T.at(week, L.di, today[today.length - 1].end);
    let next = ls.find(x => x.di > L.di), w2 = week; if (!next) { next = ls[0]; w2 = T.addWeeks(week, 1); }
    const nd = ls.filter(x => x.day === next.day);
    return { open, close: T.at(w2, next.di, nd[nd.length - 1].start) };
  }
  /* the lesson happening now for a class (lesson time locks homework and opens classwork) */
  function lessonNow(c, now = T.now()) {
    const wk = T.weekStart(now);
    for (const L of lessonsOf(c)) { const s = T.at(wk, L.di, L.start), e = T.at(wk, L.di, L.end); if (now >= s && now < e) return { L, start: s, end: e, week: wk }; }
    return null;
  }

  /* ---------------- works ---------------- */
  const PC = {};
  /* parsed code of a work, with answers the teacher accepted later ("accept for everyone" on the Reports page) */
  function parsed(w) {
    const acc = (db().accept || {})[w.id], sig = w.code + (acc ? JSON.stringify(acc) : '');
    if (!PC[w.id] || PC[w.id].sig !== sig) {
      const P = Code.parse(w.code);
      if (acc) Object.entries(acc).forEach(([k, list]) => { const [si, ei, ii, g] = k.split('.').map(Number); const it = P.sections[si] && P.sections[si].ex[ei] && P.sections[si].ex[ei].items[ii]; if (!it || it.type !== 'gap') return; const gap = it.segs.filter(s => s.gap)[g]; if (gap) list.forEach(a => { if (!gap.gap.some(x => N.same(x, a))) gap.gap.push(a); }); });
      PC[w.id] = { sig, P };
    }
    return PC[w.id].P;
  }
  const work = id => db().works.find(w => w.id === id);

  /* every work this student gets, with its time window */
  function instances(s, now = T.now()) {
    if (!s) return [];
    return Store.memo('inst:' + s.id + ':' + Math.floor(now / 6e4), () => {
      const c = cls(s.cls); if (!c) return [];
      const ls = lessonsOf(c), out = [];
      db().works.filter(w => (w.groups || []).includes(s.group)).forEach(w => {
        const P = parsed(w); const t = w.type; const inst = { w, P, type: t, id: w.id };
        if (t === 'homework' || t === 'classwork') {
          const L = ls[(+w.lesson || 0) - 1]; if (!L) return; inst.L = L; inst.week = w.week;
          if (t === 'homework') { const win = hwWindow(c, L, w.week); inst.open = win.open; inst.close = win.close; }
          else { if (c.taught === s.group) return; inst.open = T.at(w.week, L.di, L.start); inst.close = T.at(w.week, L.di, L.end); }
        } else if (t === 'test') { inst.open = w.sentAt; inst.close = w.sentAt + (+P.meta.open || 0) * 6e4; inst.timer = +(P.meta.time || P.meta.open) || 0; }
        else if (t === 'weekly') { if (!ls.length) return; const last = ls[ls.length - 1]; inst.open = T.at(w.week, last.di, last.end); inst.close = T.at(T.addWeeks(w.week, 1), ls[0].di, ls[0].start); inst.timer = +P.meta.time || 0; }
        else if (t === 'task') { inst.open = w.sentAt; inst.close = w.sentAt + (+P.meta.due || 0) * T.DAY; }
        inst.late = inst.close + 3 * T.DAY; inst.old = inst.close + 7 * T.DAY;
        out.push(inst);
      });
      return out.sort((a, b) => a.open - b.open);
    });
  }

  /* ---------------- attempts and scores ---------------- */
  function attempts(sid, wid) { return Store.events(sid).filter(e => e.kind === 'att' && e.work === wid); }
  function finished(sid, wid, att) { return Store.events(sid).some(e => e.kind === 'fin' && e.work === wid && e.att === att); }
  function partsDone(sid, wid, att) { return new Set(Store.events(sid).filter(e => e.kind === 'part' && e.work === wid && e.att === att).map(e => e.part)); }
  function curAttempt(sid, wid) { const a = attempts(sid, wid); const last = a[a.length - 1]; return last && !finished(sid, wid, last.att) ? last : null; }
  /* an exercise check: the first check of each exercise in an attempt is the score; with teacher corrections applied */
  function ansRight(e) { const o = db().overrides[e.id]; if (!o || !o.items || !e.detail) return { right: e.right, wrong: e.wrong }; let r = 0, w = 0; e.detail.forEach(d => { const ok = d.i in o.items ? o.items[d.i] : d.ok; if (ok === true) r++; else if (ok === false) w++; }); return { right: r, wrong: w }; }
  function workSections(P) { return P.sections.map((s, si) => ({ s, si })).filter(x => x.s.kind !== 'words'); }
  function attemptScore(sid, wid, att) {
    const w = work(wid); if (!w) return null; const P = parsed(w);
    const ev = Store.events(sid).filter(e => e.work === wid && e.att === att);
    let right = 0, total = 0; const parts = {};
    workSections(P).forEach(({ s, si }) => {
      let r = 0, t = 0;
      s.ex.forEach((ex, ei) => { const pts = Code.points(ex); if (!pts) return; t += pts; const first = ev.find(e => e.kind === 'ans' && e.key === si + '.' + ei); if (first) r += ansRight(first).right; });
      const eng = ev.filter(e => (e.kind === 'vocab' || e.kind === 'g') && e.part === si && !e.rapid);
      if ((HAS_VOCAB_ENGINE(P, s) && (s.cards.length || eng.length)) || s.gpack) { const okN = eng.filter(e => Store.okOf(e) === true).length; r += okN; t += Math.max(eng.length, s.gpack ? 5 : Math.min(4, Math.max(1, s.cards.length))); }
      parts[si] = { right: r, total: t };
      right += r; total += t;
    });
    return { right, total, pct: total ? Math.round(right / total * 100) : null, parts };
  }
  const HAS_VOCAB_ENGINE = (P, s) => P.type === 'homework' && ['vocabulary', 'warmup', 'review'].includes(s.kind);
  function best(sid, wid) {
    const fins = Store.events(sid).filter(e => e.kind === 'fin' && e.work === wid);
    let b = null; fins.forEach(f => { const sc = attemptScore(sid, wid, f.att); if (sc && sc.pct != null && (b == null || sc.pct > b)) b = sc.pct; });
    return b;
  }
  /* result shown to teacher/student: best finished attempt; a work never finished counts 0 once it is closed for good */
  function result(s, inst, now = T.now()) {
    const b = best(s.id, inst.id); if (b != null) return { pct: b, done: true };
    const any = attempts(s.id, inst.id).length;
    if (now < inst.close) return { pct: null, pending: true, started: any };
    if (inst.type === 'homework' || inst.type === 'classwork' || inst.type === 'task') { if (now < inst.old) { const cur = curAttempt(s.id, inst.id); const sc = cur ? attemptScore(s.id, inst.id, cur.att) : null; return { pct: sc && sc.pct != null ? sc.pct : 0, open: true, partial: true }; } }
    return { pct: 0, done: false, missed: true };
  }

  /* ---------------- visibility on the student's main page ---------------- */
  function state(s, inst, now = T.now()) {
    const doneAny = Store.events(s.id).some(e => e.kind === 'fin' && e.work === inst.id);
    if (now < inst.open) return inst.type === 'homework' && T.iso(inst.open) === T.iso(now) ? 'locked' : inst.type === 'weekly' && now > T.weekStart(inst.open) ? 'soon' : 'future';
    if (inst.type === 'weekly') return doneAny ? 'done' : now < inst.close ? (curAttempt(s.id, inst.id) ? 'running' : 'open') : 'closed';
    if (inst.type === 'test') return now < inst.close ? 'open' : (now < inst.close + 7 * T.DAY ? 'closed' : 'gone');
    if (now < inst.close) return 'open';
    if (now < inst.late) return doneAny ? 'donepast' : 'late';
    if (now < inst.old) return doneAny ? 'donepast' : 'old';
    return 'gone';
  }

  /* ---------------- achko and gold ---------------- */
  /* achko lives on events: ach:true events count +1 if right, −1 if wrong, 0 for "Bilmayman" */
  function achOf(e) { if (!e.ach || e.rapid) return 0; if (e.kind === 'achsum') return e.n || 0; if (e.kind === 'ans') { const r = ansRight(e); return r.right - r.wrong; } if (e.kind === 'game') return e.achko || 0; const ok = Store.okOf(e); if (e.idk) return -1; return ok === true ? 1 : ok === false ? -1 : 0; }
  function achko(sid, from = -Infinity, to = Infinity) { return sum(Store.events(sid).filter(e => e.ach && e.ts >= from && e.ts < to).map(achOf)); }
  const weekAchko = (sid, monday) => achko(sid, monday, T.addWeeks(monday, 1));
  /* gold is the castle's wallet; earning writes into the castle state (capped by the storage, as in the castle plan) */
  const CAPS = [1000, 1600, 2500, 4000, 6000, 9000, 13000, 19000, 27000, 38000];
  function castleFresh() { return { gold: 0, cr: 0, b: { castle: 1, wall: 1, tower: 1, barracks: 1, storage: 1 }, fund: { castle: 0, wall: 0, tower: 0, barracks: 0, storage: 0 }, jobs: [], wait: [], builders: 1,
    tr: { sword: { lv: 1, fund: 0 }, archer: { lv: 1, fund: 0 }, brute: { lv: 1, fund: 0 }, bird: { lv: 1, fund: 0 }, giant: { lv: 1, fund: 0 } }, tjob: null, twait: [],
    army: { sword: 6, archer: 2, brute: 0, bird: 0, giant: 0 }, att: { day: '', n: 0 }, lock: 0, rec: {}, vt: 0, sound: true, speed: 1, tab: 'village', seen: {} }; }
  function castle(sid) { return Store.castleGet(sid) || castleFresh(); }
  function gold(sid) { return castle(sid).gold || 0; }
  function addGold(sid, n, src) {
    if (!n) return 0; const c = castle(sid); const cap = CAPS[clamp((c.b && c.b.storage) || 1, 1, 10) - 1];
    const add = Math.max(0, Math.min(n, cap - (c.gold || 0))); c.gold = (c.gold || 0) + add; Store.castleSet(sid, c);
    Store.ev(sid, 'gold', { n: add, want: n, src });
    if (add < n) toast(`Ombor to'la: ${n - add} oltin sig'madi. Qal'ada omborni yaxshilang.`);
    return add;
  }
  function goldToday(sid, src) { const d = T.iso(); return sum(Store.events(sid).filter(e => e.kind === 'gold' && e.src === src && T.iso(e.ts) === d).map(e => e.want || 0)); }

  /* ---------------- words: So'zlarim and games ---------------- */
  /* where the words come from: the [words] of each lesson plan and the word lines in that week's homework and classwork for the student's group */
  function wordWeeks(s) {
    return Store.memo('ww:' + s.id, () => {
      const c = cls(s.cls); if (!c) return [];
      const weeks = {};
      const put = (week, n, card, src) => { const W = weeks[week] || (weeks[week] = {}); const L = W[n] || (W[n] = {}); const prev = L[card.id]; if (!prev || richness(card) > richness(prev)) L[card.id] = Object.assign({}, card, { src }); };
      Object.entries(db().plans || {}).forEach(([k, p]) => { const [cid, wk, n] = k.split('|'); if (cid !== c.id) return; (p.words || []).forEach(([w, uz, g]) => g && g !== s.group ? null : put(+wk, +n, { id: Code.idOf(w), w, p: 'other', en: '', uz, d: uz, sentences: [], ant: '', syn: '', confuse: [], sp: [], alt: [], diff: 1, s: '', f: w }, 'plan')); });
      db().works.filter(w => (w.groups || []).includes(s.group) && (w.type === 'homework' || w.type === 'classwork') && w.week).forEach(w => {
        if (w.type === 'classwork' && c.taught === s.group) { /* taught group still learns the lesson's words */ }
        const P = parsed(w); P.words.forEach(cd => put(w.week, +w.lesson || 0, cd, w.type));
      });
      return Object.keys(weeks).map(Number).sort((a, b) => b - a).map(wk => ({ week: wk, lessons: Object.keys(weeks[wk]).map(Number).sort((a, b) => a - b).map(n => ({ n, cards: Object.values(weeks[wk][n]) })) }));
    });
  }
  const richness = c => (c.sentences ? c.sentences.length * 3 : 0) + (c.en ? 2 : 0) + (c.uz ? 1 : 0) + (c.sp ? c.sp.length : 0) + (c.ant ? 1 : 0);
  function allCards(s) { const m = {}; wordWeeks(s).forEach(W => W.lessons.forEach(L => L.cards.forEach(c => { if (!m[c.id] || richness(c) > richness(m[c.id])) m[c.id] = c; }))); return Object.values(m); }
  function vstate(s) { return Vocab.state(s.id, Object.fromEntries(allCards(s).map(c => [c.id, c]))); }
  function allBlocks(s, weeks) {
    const b = { groups: [], scales: [], sorts: [], stories: [], parts: { parts: {}, words: [] } }, confuse = [];
    db().works.filter(w => (w.groups || []).includes(s.group) && (!weeks || weeks.includes(w.week))).forEach(w => { const P = parsed(w); ['groups', 'scales', 'sorts', 'stories'].forEach(k => b[k].push(...P.blocks[k])); Object.assign(b.parts.parts, P.blocks.parts.parts); b.parts.words.push(...P.blocks.parts.words); confuse.push(...P.confuse); });
    return { blocks: b, confuse };
  }

  /* ---------------- Erkin mashq: questions from homework and classwork, wrong ones come back more ---------------- */
  function practiceItems(s, now = T.now()) {
    const out = [];
    instances(s, now).filter(i => (i.type === 'homework' || i.type === 'classwork' || i.type === 'task') && now >= i.open).forEach(inst => {
      workSections(inst.P).forEach(({ s: sec, si }) => sec.ex.forEach((ex, ei) => {
        if (ex.answer.startsWith('free')) return;
        ex.items.forEach((it, ii) => { if (it.example) return; if (it.type === 'choice' || (it.type === 'gap' && it.segs.filter(x => x.gap).length <= 2)) out.push({ ref: `${inst.id}|${si}.${ei}.${ii}`, inst, sec, ex, it, si, ei, ii }); });
      }));
    });
    return out;
  }
  function wrongCounts(sid) {
    const m = {};
    Store.events(sid).forEach(e => {
      if (e.kind === 'ans' && e.detail) e.detail.forEach(d => { const ref = `${e.work}|${e.key}.${d.i}`; const o = db().overrides[e.id]; const ok = o && o.items && d.i in o.items ? o.items[d.i] : d.ok; if (ok === false) m[ref] = (m[ref] || 0) + 1; });
      if (e.kind === 'prac') { const ok = Store.okOf(e); if (ok === false) m[e.ref] = (m[e.ref] || 0) + 1; else if (ok === true && m[e.ref] > 0) m[e.ref]--; }
    });
    return m;
  }

  /* ---------------- trophies (personal, never compared) ---------------- */
  const TSIZE = { s: { uz: 'Kichik', p: 40, c: '#FF8A1E' }, b: { uz: 'Katta', p: 250, c: '#F5B700' }, l: { uz: 'Afsonaviy', p: 800, c: '#5CE1F0' } };
  const TFAM = [
    { k: 'rep', n: "Har 200 to'g'ri javob", d: "Uy vazifasi va sinf ishidagi har 200 ta to'g'ri javob", stat: 'correct', every: 200, size: 's' },
    { k: 'correct', n: "To'g'ri javoblar", d: "Uy vazifasi va sinf ishida jami to'g'ri javoblar", stat: 'correct', tiers: [[500, 's'], [1000, 'b'], [2500, 'b'], [5000, 'l']] },
    { k: 'streak', n: 'Vaqtida', d: 'Ketma-ket muddatida bajarilgan uy vazifalari', stat: 'streak', tiers: [[3, 's'], [7, 's'], [15, 'b'], [30, 'l']] },
    { k: 'perfect', n: 'Benuqson', d: '100% bilan bajarilgan uy vazifalari', stat: 'perfect', tiers: [[1, 's'], [10, 'b'], [30, 'l']] },
    { k: 'test5', n: 'Test ustasi', d: 'Haftalik testda 5 baho', stat: 'test5', tiers: [[1, 's'], [5, 'b'], [15, 'l']] },
    { k: 'grow', n: "O'sish", d: "Haftalik test natijasini oldingi haftadan 10 ballga oshirish", stat: 'grow', tiers: [[1, 's'], [5, 'b']] },
    { k: 'known', n: "So'z boyligi", d: "To'liq o'zlashtirilgan so'zlar", stat: 'known', tiers: [[50, 's'], [150, 'b'], [400, 'b'], [800, 'l']] },
    { k: 'pdays', n: 'Mustaqil', d: 'Erkin mashq qilingan kunlar', stat: 'pdays', tiers: [[5, 's'], [20, 'b'], [60, 'l']] },
    { k: 'fixed', n: 'Xato ustida ishlash', d: "Oldin xato qilib, Erkin mashqda to'g'ri topilgan savollar", stat: 'fixed', tiers: [[25, 's'], [100, 'b'], [300, 'l']] },
    { k: 'writes', n: 'Yozuvchi', d: "So'z chegarasida yozib yuborilgan matnlar", stat: 'writes', tiers: [[5, 's'], [25, 'b'], [60, 'l']] },
    { k: 'cws', n: 'Sinfda faol', d: "Vaqtidan oldin tugatilgan sinf ishi bo'limlari", stat: 'cws', tiers: [[20, 's'], [100, 'b'], [300, 'l']] },
    { k: 'week', n: 'Benuqson hafta', d: "Bir haftadagi barcha uy vazifalari 85% dan yuqori", stat: 'week', tiers: [[1, 'b'], [4, 'l']] },
    { k: 'record', n: 'Shaxsiy rekord', d: "Haftalik achkoda o'z rekordingizni yangilash", stat: 'record', every: 1, size: 's' },
  ];
  function stats(s, now = T.now()) {
    return Store.memo('stats:' + s.id, () => {
      const E = Store.events(s.id), insts = instances(s, now);
      const typeOf = id => { const w = work(id); return w ? w.type : null; };
      let correct = 0;
      E.forEach(e => { const t = e.work && typeOf(e.work); if (t !== 'homework' && t !== 'classwork') return; if (e.att !== 1) return;
        if (e.kind === 'ans') correct += ansRight(e).right; if ((e.kind === 'vocab' || e.kind === 'g') && !e.rapid && Store.okOf(e) === true) correct++; });
      const hws = insts.filter(i => i.type === 'homework' && now >= i.close).sort(by('close'));
      let streak = 0, bestStreak = 0, perfect = 0;
      hws.forEach(i => { const f = E.find(e => e.kind === 'fin' && e.work === i.id); if (f && f.ts <= i.close) { streak++; bestStreak = Math.max(bestStreak, streak); } else streak = 0; if (best(s.id, i.id) === 100) perfect++; });
      const wk = insts.filter(i => i.type === 'weekly').sort(by('open')).map(i => best(s.id, i.id)).filter(x => x != null);
      let grow = 0; for (let i = 1; i < wk.length; i++) if (wk[i] >= wk[i - 1] + 10) grow++;
      const vs = vstate(s); const known = Object.values(vs.words).filter(w => w.stage === 5).length;
      const pdays = new Set(E.filter(e => e.kind === 'prac').map(e => T.iso(e.ts))).size;
      const fixed = E.filter(e => e.kind === 'prac' && e.fix && Store.okOf(e) === true).length;
      const writes = E.filter(e => e.kind === 'write').length;
      const cws = E.filter(e => e.kind === 'secdone' && e.early).length;
      const weeks = {}; hws.forEach(i => { (weeks[i.w.week] = weeks[i.w.week] || []).push(best(s.id, i.id) || 0); });
      const week = Object.values(weeks).filter(a => a.length && a.every(p => p > 85)).length;
      let record = 0, max = null; const firstWk = E.length ? T.weekStart(E[0].ts) : T.weekStart(now);
      for (let w = firstWk; w < T.weekStart(now); w = T.addWeeks(w, 1)) { const a = weekAchko(s.id, w); if (max != null && a > max) record++; max = max == null ? a : Math.max(max, a); }
      return { correct, streak: bestStreak, perfect, test5: wk.filter(p => markOf(p) === 5).length, grow, known, pdays, fixed, writes, cws, week, record };
    });
  }
  function trophies(s) {
    const st = stats(s), out = [];
    TFAM.forEach(f => { const v = st[f.stat] || 0;
      if (f.every) { for (let i = 1; i <= Math.floor(v / f.every); i++) out.push({ id: f.k + '-' + i, f, size: f.size, name: f.every > 1 ? `${f.n} · ${i * f.every}` : `${f.n} · ${i}-marta` }); }
      else f.tiers.forEach(([th, sz], i) => { if (v >= th) out.push({ id: f.k + '-' + i, f, size: sz, name: `${f.n} · ${th}` }); }); });
    const sold = new Set(Store.events(s.id).filter(e => e.kind === 'sell').map(e => e.tid));
    out.forEach(t => t.sold = sold.has(t.id));
    return out;
  }

  return { stu, cls, markOf, lessonsOf, lessonLen, hwWindow, lessonNow, parsed, work, instances, attempts, finished, partsDone, curAttempt, attemptScore, best, result, state, workSections,
    achOf, achko, weekAchko, gold, addGold, goldToday, castle, castleFresh, CAPS, wordWeeks, allCards, vstate, allBlocks, practiceItems, wrongCounts, TSIZE, TFAM, stats, trophies, ansRight, HAS_VOCAB_ENGINE };
})();
