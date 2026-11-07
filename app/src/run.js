/* =====================================================================
   RUNNER: one place that plays any work (homework, classwork, test, weekly, task)
   and hosts every engine: book exercises, vocab engine, grammar engine.
   Student-facing text is Uzbek; the questions themselves are English.
   ===================================================================== */
const Run = (() => {
  let R = null;            // current run
  const sid = () => R.s.id;
  /* ---------- inline formatting for passages ---------- */
  const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/__(.+?)__/g, '<u>$1</u>');
  const who = s => { const m = String(s).match(/^([A-Z][A-Za-z']{1,14}(?: [A-Z0-9][A-Za-z0-9()']{0,12}){0,2}):\s(.*)$/); return m ? `<b class="who">${esc(m[1])}:</b> ${inl(m[2])}` : inl(s); };
  function rich(body) {
    let h = '', ul = false, tb = false; const close = () => { if (ul) { h += '</ul>'; ul = false; } if (tb) { h += '</tbody></table>'; tb = false; } };
    String(body).split('\n').forEach(raw => { const l = raw.trim();
      if (!l) { close(); h += '<div class="gapline"></div>'; return; }
      if (l.startsWith('# ')) { close(); h += `<h4>${inl(l.slice(2))}</h4>`; return; }
      if (l.startsWith('- ')) { if (tb) { h += '</tbody></table>'; tb = false; } if (!ul) { h += '<ul>'; ul = true; } h += `<li>${who(l.slice(2))}</li>`; return; }
      if (l.includes(' | ')) { if (ul) { h += '</ul>'; ul = false; } if (!tb) { h += '<table><tbody>'; tb = true; } h += '<tr>' + l.split(' | ').map(c => `<td>${inl(c)}</td>`).join('') + '</tr>'; return; }
      close(); h += `<p>${who(l)}</p>`; });
    close(); return h;
  }
  const passage = t => `<div class="passage">${t.title ? `<h3>${inl(t.title)}</h3>` : ''}${rich(t.body)}</div>`;

  /* ---------- start / resume a work ---------- */
  function open(s, inst, opts = {}) {
    const cur = School.curAttempt(s.id, inst.id), all = School.attempts(s.id, inst.id), last = all[all.length - 1];
    let att;
    if (cur && !opts.redo) att = cur.att;
    else if (last && !opts.redo) att = last.att;      // a finished work opens on its result; "Qayta ishlash" starts a new attempt
    else {
      const n = School.attempts(s.id, inst.id).length + 1;
      if (inst.type === 'weekly' && n > 1) { toast("Haftalik testni faqat bir marta topshirish mumkin"); return false; }
      const endsAt = inst.timer ? T.now() + inst.timer * 6e4 : null;
      Store.ev(s.id, 'att', { work: inst.id, att: n, endsAt }); att = n;
    }
    const a = Store.events(s.id).find(e => e.kind === 'att' && e.work === inst.id && e.att === att);
    R = { s, inst, P: inst.P, att, first: att === 1, part: null, ans: {}, eng: null, endsAt: a && a.endsAt, lessonLive: !!opts.live, view: inst.type === 'test' || inst.type === 'weekly' ? 'test' : inst.type === 'classwork' ? 'cw' : 'wallet' };
    restore();
    if (R.view === 'test') R.part = 'all';
    return true;
  }
  function restore() {
    Store.events(sid()).filter(e => e.work === R.inst.id && e.att === R.att).forEach(e => {
      if (e.kind === 'ans' || e.kind === 'write') { const a = A(e.key); a.v = Object.assign({}, e.inputs || {}); a.done = true; a.checked = !!e.graded; a.first = false; a.score = e.ach ? School.achOf(e) : null; if (e.graded) a.res = gradeEx(exOf(e.key), a.v); }
    });
  }
  const close = () => { R = null; };
  const A = k => R.ans[k] || (R.ans[k] = { v: {}, checked: false, res: null, first: true, score: null, done: false });
  const exOf = k => { const [si, ei] = k.split('.').map(Number); return R.P.sections[si].ex[ei]; };
  const secs = () => School.workSections(R.P);
  const isTest = () => R.inst.type === 'test' || R.inst.type === 'weekly';
  const partDone = si => School.partsDone(sid(), R.inst.id, R.att).has(si);

  /* ---------- grading an exercise (same rules everywhere) ---------- */
  function gradeEx(ex, v) {
    const res = { right: 0, total: 0, wrong: 0, items: [] };
    if (ex.answer.startsWith('free')) return res;
    ex.items.forEach((it, i) => {
      if (it.example || it.type === 'line' || it.type === 'open') return;
      let r;
      if (it.type === 'choice') r = Code.gradeItem(it, v['c' + i], ex);
      if (it.type === 'gap') { const n = it.segs.filter(s => s.gap).length; r = Code.gradeItem(it, [...Array(n)].map((_, g) => v[`g${i}_${g}`]), ex);
        r.each.forEach((e, g) => { res.total++; if (e === true) res.right++; else if (e === false) res.wrong++; res.items.push({ i: i + ':' + g, ok: e === true ? true : e === false ? false : false, input: v[`g${i}_${g}`] || '' }); }); res[i] = r; return; }
      if (it.type === 'match') r = Code.gradeItem(it, v['m' + i], ex);
      res[i] = r; res.total++; if (r.ok === true) res.right++; else if (r.ok === false) res.wrong++;
      res.items.push({ i: String(i), ok: r.ok === true, input: it.type === 'choice' ? (v['c' + i] || []).map(j => it.opts[j] && it.opts[j].t).join(', ') : v['m' + i] || '' });
    });
    if (ex.sort) ex.sort.forEach(c => c.words.forEach(w => { res.total++; const x = v['s' + w]; if (x === c.col) res.right++; else if (x) res.wrong++; res.items.push({ i: 's:' + w, ok: x === c.col, input: x || '' }); }));
    return res;
  }

  /* ---------- exercise card ---------- */
  function exHTML(si, ei) {
    const P = R.P, ex = P.sections[si].ex[ei], k = si + '.' + ei, a = A(k), chk = a.checked, res = a.res || {};
    const free = ex.answer.startsWith('free'); const locked = isTest() && R.finished;
    let h = `<div class="exhead">${ex.num ? `<span class="num">${esc(ex.num)}</span>` : ''}${(ex.from || []).map(f => `<span class="etag from">${esc(Code.FROM[f].tag)}</span>`).join('')}
      ${a.done && !chk ? '<span class="etag">✓ Bajarildi</span>' : ''}<button class="helpbtn" data-act="exhelp" data-k="${k}">Qanday bajariladi?</button></div>`;
    if (ex.instr) h += `<p class="instr">${inl(ex.instr)}</p>`;
    if (ex.example) h += `<p class="example"><b>Namuna</b>${inl(ex.example)}</p>`;
    if (ex.chart) { let acc = 0; const tot = sum(ex.chart.map(c => c.v)) || 1; const stops = ex.chart.map(c => { const a0 = acc / tot * 360; acc += c.v; return `${c.c || '#fff'} ${a0}deg ${acc / tot * 360}deg`; }).join(',');
      h += `<div class="chartd"><div class="donut" style="background:conic-gradient(${stops})" role="img" aria-label="Diagramma"></div><ul class="legend">${ex.chart.map(c => `<li><i style="background:${c.c || '#fff'}"></i>${esc(c.label)}<span>${c.v}%</span></li>`).join('')}</ul></div>`; }
    ex.texts.forEach(t => h += passage(t));
    if (ex.see) { const src = findText(ex.see); if (src) h += `<details class="see"><summary>${esc(ex.see)}-mashqdagi matnni ko'rish</summary>${src.texts.map(passage).join('')}</details>`; }
    if (ex.box) { const used = new Set(Object.entries(a.v).filter(([kk]) => kk.startsWith('g')).map(([, v]) => N.key(v)));
      h += `<div class="box">${ex.box.map(w => `<button class="wchip ${used.has(N.key(w)) ? 'used' : ''}" data-act="chip" data-k="${k}" data-w="${esc(w)}" ${chk ? 'disabled' : ''}>${esc(w)}</button>`).join('')}</div>`; }
    const rights = ex.items.some(i => i.type === 'match') ? shuffleS([...ex.items.filter(i => i.type === 'match').map(i => i.right), ...ex.extra], k + R.inst.id) : null;
    if (rights) h += `<ul class="rights">${rights.map((r, i) => `<li><b>${String.fromCharCode(65 + i)}</b><span>${inl(r)}</span></li>`).join('')}</ul>`;
    let ih = '';
    ex.items.forEach((it, i) => {
      const r = res[i];
      if (it.type === 'line') { ih += `<div class="ctx">${who(it.t)}</div>`; return; }
      if (it.type === 'choice') {
        const multi = Code.isMulti(it, ex), sel = it.example ? it.opts.map((o, j) => o.ok === 2 ? j : -1).filter(j => j >= 0) : (a.v['c' + i] || []);
        ih += `<div class="item"><div class="stem">${it.example ? '<span class="exmark">Namuna</span>' : ''}${inl(it.stem)}${multi && !it.example ? ' <span class="small" style="opacity:.8">· bir nechtasini tanlang</span>' : ''}</div><div class="opts">${it.opts.map((o, j) => {
          let c = sel.includes(j) ? 'sel' : ''; if ((chk && !free && !isTest()) || it.example) { if (o.ok === 2 || (o.ok === 1 && sel.includes(j))) c = 'right'; if (sel.includes(j) && !o.ok) c = 'sel miss'; }
          return `<button class="opt ${c}" data-act="opt" data-k="${k}" data-i="${i}" data-j="${j}" ${chk || it.example || locked ? 'disabled' : ''} aria-pressed="${sel.includes(j)}">${inl(o.t)}</button>`; }).join('')}</div>
          ${chk && !isTest() && r && r.ok === false ? '<span class="fix">Unchalik emas · to\'g\'ri javob yashil</span>' : ''}</div>`;
        return;
      }
      if (it.type === 'gap') {
        let g = 0; const parts = it.segs.map(sg => {
          if (!sg.gap) return who(sg.t);
          const gi = g++, id = `g${i}_${gi}`, val = it.example ? sg.gap[0] : (a.v[id] ?? ''), each = r && r.each ? r.each[gi] : undefined;
          const st = it.example ? 'ok' : chk && !isTest() ? (each === true ? 'ok' : 'no') : '';
          const dis = chk || it.example || locked ? 'disabled' : '';
          let ctl;
          if (ex.choose) ctl = `<select class="gap ${st}" data-k="${k}" data-id="${id}" ${dis} aria-label="Bo'sh joy"><option value="">—</option>${ex.choose.map(o => `<option ${N.key(o) === N.key(val) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
          else ctl = gapInput(sg.gap[0], val, `class="gap ${st}" data-k="${k}" data-id="${id}" ${dis}`);
          return ctl + (chk && !isTest() && each !== true && !it.example ? `<span class="fix">→ ${esc(sg.gap[0])}</span>` : '');
        }).join('');
        ih += `<div class="gl">${it.example ? '<span class="exmark">Namuna</span>' : ''}${parts}</div>`; return;
      }
      if (it.type === 'match') {
        const val = it.example ? it.right : (a.v['m' + i] ?? ''), st = it.example ? 'ok' : chk && !isTest() ? (r && r.ok ? 'ok' : 'no') : '';
        ih += `<div class="mrow"><span class="left">${inl(it.left)}</span><select class="gap ${st}" data-k="${k}" data-id="m${i}" ${chk || it.example || locked ? 'disabled' : ''} aria-label="${esc(it.left)}"><option value="">—</option>${rights.map((rr, j) => `<option value="${esc(rr)}" ${rr === val ? 'selected' : ''}>${String.fromCharCode(65 + j)}: ${esc(rr.length > 58 ? rr.slice(0, 56) + '…' : rr)}</option>`).join('')}</select>
          ${chk && !isTest() && !(r && r.ok) ? `<span class="fix">→ ${String.fromCharCode(65 + rights.indexOf(it.right))}</span>` : ''}</div>`; return;
      }
      if (it.type === 'open') ih += `<label class="item"><span class="olabel">${inl(it.q)}</span><textarea class="wbox" rows="2" data-k="${k}" data-id="o${i}" ${a.done || locked ? 'disabled' : ''}>${esc(a.v['o' + i] || '')}</textarea></label>`;
    });
    if (ih) h += `<div class="items">${ih}</div>`;
    if (ex.sort || ex.columns) {
      const cols = ex.sort ? ex.sort.map(c => c.col) : ex.columns, words = ex.sort ? shuffleS(ex.sort.flatMap(c => c.words), k) : ex.words;
      const truth = {}; if (ex.sort) ex.sort.forEach(c => c.words.forEach(w => truth[w] = c.col));
      h += `<div class="sortgrid">${words.map(w => { const v = a.v['s' + w]; return `<div class="srow"><b>${esc(w)}</b><span class="cols">${cols.map(c => {
        let cl = v === c ? 'sel' : ''; if (chk && ex.sort && !isTest()) { if (truth[w] === c) cl = 'right'; if (v === c && truth[w] !== c) cl = 'sel miss'; }
        return `<button class="${cl}" data-act="sort" data-k="${k}" data-w="${esc(w)}" data-c="${esc(c)}" ${chk || (a.done && !ex.sort) || locked ? 'disabled' : ''}>${esc(c)}</button>`; }).join('')}</span></div>`; }).join('')}</div>`;
    }
    if (ex.write && ex.write.prompt) { const t = a.v.w || '', n = wcount(t), W = ex.write;
      h += `<label class="item"><span class="olabel">${inl(W.prompt)}</span><textarea class="wbox" rows="7" data-k="${k}" data-id="w" placeholder="Shu yerga inglizcha yozing…" ${a.done || locked ? 'disabled' : ''}>${esc(t)}</textarea><span class="wc" data-wc="${k}">${wcMsg(n, W)}</span></label>`; }
    h += `<div class="exfoot">${footer(ex, k, a)}</div>`;
    const allok = chk && !isTest() && res.total && res.right === res.total;
    return `<article class="ex ${allok ? 'allok' : ''}" id="ex-${k.replace('.', '-')}">${h}</article>`;
  }
  function gapInput(answer, val, attrs) {
    const parts = N.hyphenParts(answer);
    if (!parts) return `<input ${attrs} value="${esc(val)}" style="width:${Math.min(40, Math.max(5, answer.length + 2))}ch" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Bo'sh joy">`;
    // hyphen rule: the hyphens are already there; the student types only the letters
    const vs = String(val || '').split('-');
    return `<span class="hy" data-hy="1">${parts.map((p, i) => `${i ? '<span class="hyd">-</span>' : ''}<input ${attrs.replace(/data-id="([^"]+)"/, `data-id="$1" data-seg="${i}" data-segs="${parts.length}"`)} value="${esc(vs[i] || '')}" style="width:${Math.max(3, p.length + 1.5)}ch" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Bo'sh joy, ${i + 1}-qism">`).join('')}</span>`;
  }
  const wcMsg = (n, W) => n < W.min ? `${n} so'z · yana ${W.min - n} ta kerak (${W.min}–${W.max})` : n > W.max ? `${n} so'z · ${n - W.max} ta ortiqcha (${W.min}–${W.max})` : `${n} so'z · yaxshi ✓`;
  function kindsOf(ex) { const t = new Set(ex.items.map(i => i.type)); const free = ex.answer.startsWith('free');
    return { graded: !free && (t.has('choice') || t.has('gap') || t.has('match') || !!ex.sort), free: (free && t.has('choice')) || !!ex.columns, open: t.has('open') || !!(ex.write && ex.write.prompt) }; }
  function canSend(ex, a) { if (ex.items.some((it, i) => it.type === 'open' && !String(a.v['o' + i] || '').trim())) return false; if (ex.write && ex.write.prompt) { const n = wcount(a.v.w); if (n < ex.write.min || n > ex.write.max) return false; } return true; }
  function footer(ex, k, a) {
    const K = kindsOf(ex), res = a.res || {};
    if (isTest()) { if (K.open) return a.done ? `<span class="result">Yuborildi ✓</span>` : `<button class="main" data-act="send" data-k="${k}" ${canSend(ex, a) ? '' : 'disabled'}>O'qituvchiga yuborish</button>`; return `<span class="notep">Javoblar test oxirida tekshiriladi.</span>`; }
    if (K.graded) {
      if (!a.checked) return `<button class="main" data-act="check" data-k="${k}">${K.open ? 'Tekshirish va yuborish' : 'Tekshirish'}</button><span class="notep">${isTest() ? "Test: achko berilmaydi" : a.first ? "Tekshiruv: to'g'ri +1, xato −1 achko" : "Bu mashq allaqachon tekshirilgan"}</span>`;
      return `<span class="result">${res.right}/${res.total} to'g'ri${a.score != null ? ` · ${a.score >= 0 ? '+' : ''}${a.score} achko` : ''}</span><button class="ghost" data-act="redo" data-k="${k}">Qayta ishlash</button><button class="reportbtn" data-act="report" data-k="${k}">Xato bormi? Xabar bering</button>`;
    }
    if (K.open) return a.done ? `<span class="result">O'qituvchiga yuborildi ✓</span>` : `<button class="main" data-act="send" data-k="${k}" ${canSend(ex, a) ? '' : 'disabled'}>O'qituvchiga yuborish</button><span class="notep" data-sn="${k}">${ex.write ? `${ex.write.min}–${ex.write.max} so'z${ex.write.kind ? ' · ' + esc(ex.write.kind) : ''}` : 'Hamma savollarga javob yozing'}</span>`;
    if (K.free) return a.done ? `<span class="result">Saqlandi ✓</span>` : `<button class="main" data-act="save" data-k="${k}">Saqlash</button>`;
    return a.done ? `<span class="result">O'qildi ✓</span>` : `<button class="main" data-act="read" data-k="${k}">O'qidim</button>`;
  }
  function findText(num) { for (const p of R.P.sections) { const e = p.ex.find(e => e.num === num && e.texts.length); if (e) return e; } return null; }

  /* ---------- exercise actions ---------- */
  function exCheck(k, silent) {
    const ex = exOf(k), a = A(k), res = gradeEx(ex, a.v); a.res = res; a.checked = true; a.done = true;
    const firstHere = !Store.events(sid()).some(e => e.kind === 'ans' && e.work === R.inst.id && e.att === R.att && e.key === k);
    const giveAch = firstHere && !isTest();   // every attempt (also redo) gives achko; tests never do
    const e = Store.ev(sid(), 'ans', { work: R.inst.id, att: R.att, key: k, right: res.right, wrong: res.wrong, total: res.total, graded: true, inputs: Object.assign({}, a.v), detail: res.items, ach: giveAch });
    a.first = false; a.score = giveAch ? res.right - res.wrong : null;
    if (R.first && giveAch && res.right && (R.inst.type === 'homework' || R.inst.type === 'classwork' || R.inst.type === 'task')) School.addGold(sid(), res.right * 5, 'work');
    if (kindsOf(ex).open) sendWriting(k);
    if (!silent) { if (res.total && res.right === res.total) { Snd.ok(); R.streak = (R.streak || 0) + 1; } else { Snd.no(); R.streak = 0; } toast(res.right === res.total ? `Barchasi to'g'ri!${a.score != null ? ' +' + a.score + ' achko' : ''}` : `${res.right}/${res.total} to'g'ri`); }
    return e;
  }
  function sendWriting(k) {
    const ex = exOf(k), a = A(k); const [si] = k.split('.').map(Number);
    const qs = ex.items.map((it, i) => it.type === 'open' ? `${it.q}\n${a.v['o' + i] || ''}` : null).filter(Boolean);
    const text = [ex.write && ex.write.prompt ? a.v.w : null, ...qs].filter(Boolean).join('\n\n');
    const db = Store.db; const id = 'W-' + Date.now().toString(36).slice(-5).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();   // unique on every phone
    const task = { work: R.inst.id, type: R.inst.type, title: R.P.meta.title || '', lesson: R.P.meta.lesson || '', ex: ex.num || '', kind: ex.write ? ex.write.kind || 'writing' : 'answers', task: ex.write ? ex.write.prompt : ex.instr, min: ex.write ? ex.write.min : 0, max: ex.write ? ex.write.max : 0,
      words: R.P.words.map(c => c.w) };
    db.writings.push({ id, sid: sid(), key: k, att: R.att, task, text, ts: T.now(), status: 'new', fb: null });
    Store.ev(sid(), 'write', { work: R.inst.id, att: R.att, key: k, wid: id, inputs: Object.assign({}, a.v), graded: !!a.checked, ach: false });
    a.done = true;
  }

  /* ---------- the vocab block inside a homework part ---------- */
  function engineFor(si) {
    const sec = R.P.sections[si];
    if (Store.events(sid()).some(e => e.kind === 'engdone' && e.work === R.inst.id && e.att === R.att && e.part === si)) return null;
    if (sec.gpack) return { type: 'grammar', si };
    if (School.HAS_VOCAB_ENGINE(R.P, sec)) {
      const all = School.allCards(R.s); const mine = sec.kind === 'review' ? R.P.words : sec.cards;
      if (sec.kind === 'vocabulary' && !mine.length) return null;
      const kind = sec.kind === 'vocabulary' ? 'new' : sec.kind === 'warmup' ? 'review' : 'mix';
      const merged = all.slice(); mine.forEach(c => { if (!merged.some(x => x.id === c.id)) merged.push(c); });
      const ses = new Vocab.Session({ sid: sid(), kind, cards: mine, allCards: merged, min: kind === 'new' ? Math.min(12, mine.length * 2) : 4, max: kind === 'new' ? 30 : kind === 'review' ? 10 : 16, seed: R.inst.id + R.att + si + T.iso() });
      if (kind === 'review' && !ses.pool.length) return null;
      return { type: 'vocab', si, ses, item: null, fb: null };
    }
    return null;
  }
  /* grammar bank: every pack the student's group has received, so rule progress adds up across works */
  function gBank() {
    return Store.memo('gbank:' + R.s.group, () => {
      const packs = []; Store.db.works.filter(w => (w.groups || []).includes(R.s.group)).forEach(w => { const P = School.parsed(w); P.sections.forEach((s, si) => { if (s.gpack) { const p = G.parsePack('#pack ' + w.id + '-' + si + ' | ' + (P.meta.title || '') + '\n' + s.gpackSrc); packs.push(p); } }); });
      return G.buildBank(packs);
    });
  }
  function gState(B) {
    const ov = {}; Object.entries(Store.db.overrides).forEach(([k, v]) => { if (typeof v.ok === 'boolean') ov[k] = v.ok; });
    const evs = Store.events(sid()).filter(e => (e.kind === 'g' || e.kind === 'gs') && e.gev).map(e => e.gev);
    return G.replay(B, evs, ov);
  }
  function gStart(eng) {
    const B = gBank(), S = gState(B); const id = 'gs-' + R.inst.id + '-' + R.att + '-' + eng.si;
    if (!S.sessions[id]) { const gev = G.startSession(S, B, { id, mode: R.inst.type === 'classwork' ? 'class' : 'home', packIds: [R.inst.id + '-' + eng.si], day: T.dayNum(), seed: hash(id) }); Store.ev(sid(), 'gs', { gev, work: R.inst.id, att: R.att, part: eng.si }); }
    eng.B = B; eng.gid = id; eng.cap = R.P.sections[eng.si].kind === 'practice' ? 14 : 12;
  }
  function gNext(eng) {
    const S = gState(eng.B); const sess = S.sessions[eng.gid];
    if (!sess || sess.qn >= eng.cap) return null;
    const plan = G.nextQuestion(S, eng.B, eng.gid); if (!plan) return null;
    const q = G.buildQuestion(eng.B, plan); return { plan, q, S, shownAt: Date.now(), resp: {} };
  }

  /* ---------- rendering the run ---------- */
  function partColor(kind) { const p = Code.PARTS[kind] || Code.PARTS.grammar; return p; }
  function render() {
    if (!R) return '';
    const inst = R.inst, P = R.P;
    if (R.endsAt && !R.finished && T.now() >= R.endsAt) { finishTest(true); }
    if (R.view === 'wallet') return walletView();
    if (R.view === 'cw') return cwView();
    if (R.view === 'test') return testView();
    if (R.view === 'part') return partView(R.part);
    return '';
  }
  const hwTitle = () => R.inst.type === 'homework' ? `${R.P.meta.lesson}-dars uy vazifasi` : R.inst.type === 'task' ? (R.P.meta.title || 'Topshiriq') : R.inst.type === 'classwork' ? `${R.P.meta.lesson}-dars sinf ishi` : (R.P.meta.title || 'Test');
  function walletView() {
    const S = secs(), done = School.partsDone(sid(), R.inst.id, R.att); const cur = S.findIndex(x => !done.has(x.si));
    const cards = S.map(({ s, si }, i) => { const p = partColor(s.kind), dk = p.t !== '#fff';
      if (done.has(si)) return `<button class="wcard" style="background:${p.c};color:${p.t}" data-act="part" data-si="${si}"><b>${esc(s.title && R.inst.type !== 'homework' ? s.title : p.uz)}</b><span class="wtick">✓</span></button>`;
      if (i === cur) return `<div class="wcard big ${dk ? 'dk' : ''}" style="background:${p.c};color:${p.t}"><span class="t-kind">${i + 1}-bo'lim · hozir</span><h2 style="font-size:28px">${esc(s.title && R.inst.type !== 'homework' ? s.title : p.uz)}</h2>
        <div style="opacity:.88">${partSummary(s)}</div><div class="row"><button class="wbtn" data-act="part" data-si="${si}">Boshlash</button>${s.help ? `<button class="ghostbtn" data-act="help" data-t="${esc(s.help)}">Qanday bajariladi?</button>` : ''}</div></div>`;
      return `<div class="wcard" style="background:${p.c};color:${p.t};opacity:.55"><b>${esc(p.uz)}</b><span class="small">${i + 1}/${S.length}</span></div>`; }).join('');
    const fin = School.finished(sid(), R.inst.id, R.att);
    const sc = fin ? School.attemptScore(sid(), R.inst.id, R.att) : null;
    return `<div class="row sp" style="margin-bottom:12px"><button class="backbtn" data-act="runclose">← Orqaga</button>${Stu.pills()}</div>
      <h1 style="font-size:30px;margin:4px 0">${esc(hwTitle())}</h1><p class="muted" style="margin:0 0 14px">${esc(R.P.meta.title || '')} · ${S.length} bo'lim${R.att > 1 ? ` · ${R.att}-urinish (qayta ishlash, achko yo'q)` : ''}</p>
      ${fin ? `<div class="card big-note" style="background:#138A3D;color:#fff;margin-bottom:14px"><div style="font-size:40px">🎉</div><h2>Tugadi!</h2><p>${sc && sc.pct != null ? `Natija: ${sc.pct}% · ${School.markOf(sc.pct)} baho. ` : ''}Bir hafta ichida qayta ishlashingiz mumkin, eng yaxshi natija hisoblanadi.</p><button class="wbtn" data-act="redowork">Qayta ishlash</button></div>` : ''}
      <div class="wallet">${cards}</div>`;
  }
  function partSummary(s) {
    const n = s.ex.length, eng = s.gpack ? 'moslashuvchan grammatika' : School.HAS_VOCAB_ENGINE(R.P, s) && (s.cards.length || s.kind !== 'vocabulary') ? "so'z mashqlari" : '';
    const w = s.ex.find(e => e.write); return [eng, n ? `${n} ta mashq` : '', w ? `${w.write.min}–${w.write.max} so'z` : '', s.min ? `${s.min} daq` : ''].filter(Boolean).join(' · ');
  }
  function partView(si) {
    const s = R.P.sections[si], p = partColor(s.kind), dk = p.t !== '#fff';
    if (!R.eng || R.eng.si !== si) { R.eng = engineFor(si); if (R.eng && R.eng.type === 'grammar') gStart(R.eng); }
    let body = '';
    if (R.eng) body = R.eng.type === 'vocab' ? vocabCard() : grammarCard();
    else body = `<div class="list">${s.ex.map((_, ei) => exHTML(si, ei)).join('')}</div>` + partFinish(si);
    const back = R.view === 'part' && R.inst.type !== 'classwork' ? '<button class="backbtn" data-act="towallet">← Bo\'limlar</button>' : '';
    return `${back ? `<div class="row sp" style="margin-bottom:12px">${back}${Stu.pills()}</div>` : ''}
      <section class="part-run ${dk ? 'dkp' : ''}" style="--rc:${p.c};--rt:${p.t}"><div class="prhead"><h2>${esc(s.title && R.inst.type !== 'homework' ? s.title : p.uz)}</h2><span>${s.min ? '⏱ ' + s.min + ' daqiqa · ' : ''}${esc(p.uz)}</span></div>
      ${s.help ? `<p class="notep" style="margin:-6px 4px 12px">${esc(s.help)}</p>` : ''}${body}</section>`;
  }
  function partFinish(si) {
    const s = R.P.sections[si]; const left = s.ex.filter((ex, ei) => !A(si + '.' + ei).done).length;
    if (partDone(si)) return `<div class="row" style="margin-top:14px"><span class="result">Bo'lim tugagan ✓</span>${R.inst.type === 'classwork' ? (R.lessonLive && T.now() < R.inst.close ? '' : '<button class="main" data-act="cwnext">Keyingi bo\'lim</button>') : '<button class="main" data-act="towallet">Bo\'limlarga qaytish</button>'}</div>`;
    return `<div class="row" style="margin-top:16px"><button class="main" data-act="partdone" data-si="${si}" ${left ? 'disabled' : ''}>Bo'limni tugatish</button>${left ? `<span class="notep">Yana ${left} ta mashq qoldi</span>` : ''}</div>`;
  }
  function completePart(si) {
    if (partDone(si)) return;
    const s = R.P.sections[si];
    // unchecked exercises are checked as they are (an empty answer counts as wrong, never right)
    s.ex.forEach((ex, ei) => { const k = si + '.' + ei, a = A(k); if (!a.done && kindsOf(ex).graded) exCheck(k, true); });
    let early = false; if (R.inst.type === 'classwork' && R.lessonLive) { const end = cwSecEnd(si); early = T.now() < end; Store.ev(sid(), 'secdone', { work: R.inst.id, att: R.att, part: si, early }); }
    Store.ev(sid(), 'part', { work: R.inst.id, att: R.att, part: si });
    const S = secs(); const allDone = S.every(x => School.partsDone(sid(), R.inst.id, R.att).has(x.si));
    if (allDone) finishWork(); else { Doni.leaves = leaves(); Doni.show('party', "Bo'lim tugadi!", early ? "Vaqtidan oldin tugatdingiz" : `${S.length - School.partsDone(sid(), R.inst.id, R.att).size} ta bo'lim qoldi`); }
  }
  function finishWork() {
    if (School.finished(sid(), R.inst.id, R.att)) return;
    Store.ev(sid(), 'fin', { work: R.inst.id, att: R.att });
    const firstFin = Store.events(sid()).filter(e => e.kind === 'fin' && e.work === R.inst.id).length === 1;
    if (firstFin && (R.inst.type === 'homework' || R.inst.type === 'classwork')) School.addGold(sid(), 120, 'finish');
    const sc = School.attemptScore(sid(), R.inst.id, R.att);
    Doni.leaves = leaves(); Doni.show('party', R.inst.type === 'homework' ? 'Uy vazifasi tugadi!' : 'Ish tugadi!', sc && sc.pct != null ? `${sc.right}/${sc.total} to'g'ri${firstFin && (R.inst.type === 'homework' || R.inst.type === 'classwork') ? ' · +120 oltin' : ''}` : '', true);
  }
  const leaves = () => { const k = Object.values(School.vstate(R.s).words).filter(w => w.stage === 5).length; return k >= 14 ? 3 : k >= 6 ? 2 : 1; };

  /* ---------- classwork in lesson time: timed sections ---------- */
  function cwStart() { const L = R.inst.L; return T.at(R.inst.w.week, L.di, L.start); }
  function cwSecEnd(si) { const S = secs(); let acc = 0; for (const x of S) { acc += x.s.min || 0; if (x.si === si) break; } return cwStart() + acc * 6e4; }
  function cwActive() { const S = secs(), now = T.now(); let acc = 0; for (const x of S) { const st = cwStart() + acc * 6e4; acc += x.s.min || 0; if (now < cwStart() + acc * 6e4 && now >= st) return x.si; } return null; }
  function cwView() {
    const S = secs(), now = T.now(), live = R.lessonLive && now < R.inst.close, done = School.partsDone(sid(), R.inst.id, R.att);
    const act = live ? cwActive() : null;
    const seg = S.map(({ s, si }) => { const p = partColor(s.kind); const end = cwSecEnd(si), st = end - (s.min || 0) * 6e4; const pct = live ? clamp((now - st) / ((s.min || 1) * 6e4) * 100, 0, 100) : (done.has(si) ? 100 : 0);
      const cl = live ? (si === act ? 'now' : now >= end ? 'past' : '') : ''; return `<button class="seg ${cl} ${p.t !== '#fff' ? 'dkt' : ''}" style="flex:${s.min || 10};background:${p.c}" data-act="cwsec" data-si="${si}" title="${esc(s.title)}"><b>${esc(p.uz)}</b><small style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">${s.min || '?'} daq${done.has(si) ? ' · ✓' : ''}${s.title ? ' · ' + esc(s.title) : ''}</small><span class="bar" style="width:${pct}%"></span></button>`; }).join('');
    let body = '';
    if (!live && R.part != null && R.part !== 'game') body = partView(R.part);
    if (live) {
      // the open section; if it is finished early → an unfinished earlier section → a game
      const pos = act == null ? S.length : S.findIndex(x => x.si === act);
      let target = act != null && !done.has(act) ? act : null;
      if (target == null) { const earlier = S.slice(0, pos).find(x => !done.has(x.si)); if (earlier) target = earlier.si; }
      if (target != null) { if (R.part !== target) { R.part = target; R.eng = null; } body = (target !== act ? `<div class="note">Bu bo'limni vaqtida tugatmagansiz. Avval shuni tugating.</div>` : '') + partView(target); }
      else { R.part = 'game'; body = gameInClass(); }
    } else if (R.part == null || R.part === 'game') {
      const first = S.find(x => !done.has(x.si));
      if (first) { R.part = first.si; body = partView(first.si); }
      else body = `<div class="card big-note"><div style="font-size:40px">🎉</div><h2>Sinf ishi tugadi</h2><p>Bir hafta ichida qayta ishlash mumkin, eng yaxshi natija hisoblanadi.</p><button class="btn" data-act="redowork">Qayta ishlash</button></div>`;
    }
    const left = live ? (act != null ? cwSecEnd(act) - now : R.inst.close - now) : null;
    return `<div class="row sp" style="margin-bottom:10px"><button class="backbtn" data-act="runclose">← Orqaga</button>${Stu.pills()}</div>
      <div class="row sp"><div><span class="t-kind" style="opacity:.8">Sinf ishi · ${R.inst.L.n}-dars · ${R.inst.L.start}–${R.inst.L.end}</span><h1 style="font-size:28px;margin:2px 0">${esc(R.P.meta.title || '')}</h1></div>${live ? `<span class="pill" style="background:var(--ac);color:var(--act)">⏱ <span data-clk="cw">${mmss(left / 1000)}</span></span>` : '<span class="tag">Darsdan keyin · vaqt cheklanmagan</span>'}</div>
      <div class="tl">${seg}</div>${live ? '<p class="small" style="margin:-4px 4px 12px;opacity:.85">Har bir bo\'lim o\'z vaqtida ochiladi. Vaqt tugasa, keyingisi boshlanadi.</p>' : ''}${body}`;
  }
  function gameInClass() {
    const now = T.now(), left = R.inst.close - now, act = cwActive();
    // a groupmate in the same class who has also finished → a two-player game is offered
    const mates = Store.db.students.filter(x => x.id !== R.s.id && x.cls === R.s.cls && x.group === R.s.group && Store.events(x.id).some(e => e.kind === 'part' && e.work === R.inst.id && (act == null || e.part === act)));
    // last week's words, any open solo game, chosen at random (changes each time)
    return `<div class="note">Hamma bo'limlarni tugatdingiz yoki keyingi bo'lim hali boshlanmadi. Dars oxirigacha <b data-clk="cwend">${mmss(left / 1000)}</b>. O'tgan haftaning so'zlari bilan o'ynang:</div>
      <div class="row"><button class="btn" data-act="cwgame">🎮 Tasodifiy o'yin</button>${mates.length ? `<button class="btn" data-act="cwduel">⚔️ ${esc(mates[0].name.split(' ')[0])} ham tugatdi: Word Duel</button>` : ''}</div>`;
  }

  /* ---------- tests: all questions on one page, timer, finish ---------- */
  function testView() {
    const S = secs(), fin = School.finished(sid(), R.inst.id, R.att); R.finished = fin;
    if (fin) { const sc = School.attemptScore(sid(), R.inst.id, R.att); const pct = sc.pct || 0, k = School.markOf(pct);
      return `<button class="backbtn" data-act="runclose">← Orqaga</button><div class="card big-note" style="margin-top:12px"><span class="pill" style="margin-bottom:12px">${R.inst.type === 'weekly' ? "Natija saqlandi · qayta topshirib bo'lmaydi" : 'Eng yaxshi natija hisoblanadi · qayta ishlash mumkin'}</span><div style="display:flex;justify-content:center;margin:8px 0">${ring(pct)}</div><h2>Test tugadi</h2><p>${sc.right}/${sc.total} to'g'ri · ${pct}% · ${k} baho. O'qituvchi natijangizni ko'radi.</p>${R.inst.type === 'test' && T.now() < R.inst.close ? '<button class="btn" data-act="redowork">Qayta ishlash</button>' : ''}</div>`; }
    const left = R.endsAt ? (R.endsAt - T.now()) / 1000 : null;
    return `<div class="row sp" style="margin-bottom:12px"><button class="backbtn" data-act="testend">Testni yakunlash</button><span class="pill" style="background:var(--ac);color:var(--act)">${R.inst.type === 'weekly' ? "1 marta · " : ''}⏱ <span data-clk="test">${left != null ? mmss(left) : '—'}</span></span></div>
      <h1 style="font-size:28px;margin:4px 0 14px">${esc(R.P.meta.title || 'Test')}</h1>
      ${S.map(({ s, si }) => { const p = partColor(s.kind); return `<section class="part-run ${p.t !== '#fff' ? 'dkp' : ''}" style="--rc:${p.c};--rt:${p.t};margin-bottom:14px"><div class="prhead"><h2>${esc(s.title || p.uz)}</h2></div><div class="list">${s.ex.map((_, ei) => exHTML(si, ei)).join('')}</div></section>`; }).join('')}
      <div class="row"><button class="btn" data-act="testend">Testni yakunlash</button></div>`;
  }
  function finishTest(auto) {
    if (School.finished(sid(), R.inst.id, R.att)) { R.finished = true; return; }
    secs().forEach(({ s, si }) => s.ex.forEach((ex, ei) => { const k = si + '.' + ei, a = A(k); if (kindsOf(ex).graded && !a.checked) { const res = gradeEx(ex, a.v); Store.ev(sid(), 'ans', { work: R.inst.id, att: R.att, key: k, right: res.right, wrong: res.wrong, total: res.total, graded: true, inputs: Object.assign({}, a.v), detail: res.items, ach: false }); a.checked = true; a.done = true; a.res = res; } }));
    secs().forEach(({ si }) => { if (!partDone(si)) Store.ev(sid(), 'part', { work: R.inst.id, att: R.att, part: si }); });
    Store.ev(sid(), 'fin', { work: R.inst.id, att: R.att, auto: !!auto }); R.finished = true;
    if (auto) toast('Vaqt tugadi · test yakunlandi');
  }
  function ring(p, cls = '') { const r = 36, C = 2 * Math.PI * r, k = School.markOf(p), col = ['', '#FF6B57', '#FF8A1E', '#F5B700', '#2E46E8', '#138A3D'][k];
    return `<div class="ring ${cls}"><svg viewBox="0 0 86 86"><circle cx="43" cy="43" r="${r}" fill="none" stroke="rgba(127,127,140,.25)" stroke-width="9"/><circle cx="43" cy="43" r="${r}" fill="none" stroke="${col}" stroke-width="9" stroke-linecap="${p ? 'round' : 'butt'}" stroke-dasharray="${C * p / 100} ${C}"/></svg><div class="v">${p}%</div></div>`; }

  /* ---------- vocab question card (screen takes the stage colour) ---------- */
  function vocabCard() {
    const E = R.eng, ses = E.ses;
    if (!E.item && !E.fb) E.item = ses.next();
    if (!E.item && !E.fb) { Store.ev(sid(), 'engdone', { work: R.inst.id, att: R.att, part: E.si }); R.eng = null; return partView(E.si); }
    const it = E.item, f = E.fb, st = Vocab.STAGES[it.stage] || Vocab.STAGES[0];
    const green = f && f.ok && !f.rapid, bg = green ? '#138A3D' : st.c, dk = !green && st.t !== '#fff';
    const prog = `${Math.min(ses.n + (f ? 0 : 1), ses.estimate())}/${ses.estimate()}`;
    let ask = '', main = '', ctl = '';
    if (it.fmt === 'meet') {
      ask = "Yangi so'z"; main = `<div class="qtext">${esc(it.word)}</div><div style="font-size:19px;font-weight:700">${esc(it.card.uz || '')}</div>${it.card.en ? `<div style="opacity:.9">${esc(it.card.en)}</div>` : ''}${it.example ? `<div class="uzline" style="font-weight:600">${esc(it.example)}</div>` : ''}
        <button class="speak" data-act="say" data-t="${esc(it.word)}">🔊 Talaffuz</button>`;
      ctl = `<div class="bottomrow"><span></span><button class="wbtn" data-act="vnext">Tushundim</button></div>`;
    } else {
      if (it.fmt === 'mc_meaning') { ask = "Bu so'zning ma'nosi qaysi?"; main = `<div class="qtext">${esc(it.prompt)}</div><button class="speak" data-act="say" data-t="${esc(it.word)}">🔊</button>`; }
      if (it.fmt === 'mc_word') { ask = "Qaysi so'z shu ma'noni beradi?"; main = `<div class="qtext mid">${esc(it.prompt)}</div>`; }
      if (it.fmt === 'mc_ctx') { ask = "Gapga mos so'zni tanlang"; main = `<div class="qtext mid">${esc(f ? it.filled : it.text)}</div>`; }
      if (it.fmt === 'type_def') { ask = "So'zni inglizcha yozing"; main = `<div class="qtext mid">${esc(it.prompt)}</div>`; }
      if (it.fmt === 'type_ctx') { ask = "Bo'sh joyga so'zni yozing"; main = `<div class="qtext mid">${esc(f ? it.filled : it.text)}</div>${it.uz ? `<div style="opacity:.85">(${esc(it.uz)})</div>` : ''}`; }
      if (it.options) ctl = `<div class="opts2">${it.options.map((o, i) => `<button class="opt2 ${f && i === it.answer ? 'sel' : ''} ${f && i === f.choice && !f.ok ? 'miss' : ''}" data-act="vpick" data-i="${i}" ${f ? 'disabled' : ''}>${esc(o.text)}</button>`).join('')}</div>`;
      else ctl = f ? `<div class="fb"><span class="lab">To'g'ri javob</span><b>${esc(f.correct)}</b>${f.input ? `<span>Siz: ${esc(f.input)}</span>` : ''}</div>` : typeBox(it.answers[0], it.given);
      if (f) {
        const conf = f.confused ? ses.byId[f.confused] : null;
        const msg = f.rapid ? 'Juda tez · bu javob hisoblanmadi' : f.ok ? "To'g'ri! +1 achko" : f.idk ? "Bilmayman · −1 achko, to'g'ri javobni ko'ring" : f.almost ? 'Deyarli! Imloga qarang' : 'Unchalik emas';
        ctl += `${conf ? `<div class="vs"><div class="right"><b>${esc(it.word)}</b><span>${esc(it.card.d || it.card.uz)}</span></div><div><b>${esc(conf.w)}</b><span>${esc(conf.d || conf.uz)}</span></div></div>` : ''}
          <div class="bottomrow"><span class="badge ${f.ok ? '' : 'nq'}">${msg}</span><button class="wbtn" data-act="vnext">Davom etish</button></div>`;
      } else ctl += `<div class="bottomrow"><button class="ghostbtn" data-act="vidk">Bilmayman</button>${it.options ? '' : '<button class="wbtn" data-act="vtype">Tekshirish</button>'}</div>`;
    }
    return `<div class="qs ${dk ? 'dk' : ''}" style="background:${bg}"><div class="top"><span>${it.boss ? '👑 Boss so\'z · ' : ''}${esc(st.uz)}</span><span class="ghostbtn" style="cursor:default">${prog}</span></div>
      <div><div class="ask">${ask}</div>${main}</div>${ctl}</div>`;
  }
  function typeBox(answer, given) {
    const parts = N.hyphenParts(answer);
    if (parts) return `<div class="hyrow">${parts.map((p, i) => `${i ? '<span class="hyd">-</span>' : ''}<input class="tin" data-vt="${i}" style="max-width:${Math.max(4, p.length + 2)}ch" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Javob, ${i + 1}-qism">`).join('')}</div><div class="small" style="opacity:.85">Chiziqcha (-) o'zi qo'yilgan · ${answer.replace(/-/g, '').length} harf · birinchi harf: ${esc(given || '')}</div>`;
    return `<input class="tin" data-vt="0" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc((given || '') + '…')}" aria-label="Javob"><div class="small" style="opacity:.85">${answer.length} harf</div>`;
  }
  const readType = () => { const ins = $$('[data-vt]'); return ins.map(x => x.value.trim()).join(ins.length > 1 ? '-' : ''); };
  function vAnswer(resp) {
    const E = R.eng, it = E.item; if (!it || E.fb) return;
    const extra = { work: R.inst.id, att: R.att, part: E.si, ach: true };
    const r = E.ses.submit(it, resp, extra); if (!r) return;
    if (it.fmt === 'meet') { E.item = null; return; }
    E.fb = Object.assign(r, { choice: resp.choice, input: resp.text || '' });
    if (r.ok && !r.rapid) { Snd.ok(); R.streak = (R.streak || 0) + 1; if (R.first) School.addGold(sid(), 5, 'work');
      if (R.streak === 3 || R.streak === 6 || R.streak === 10) Doni.show('happy', `Ketma-ket ${R.streak} ta!`, `${it.word} ham to'g'ri`); else if (it.fmt.startsWith('type') && it.stage >= 3) Doni.show('proud', `${it.word} so'zini xotiradan yozdingiz!`, 'Bu eng qiyini'); }
    else { Snd.no(); R.streak = 0; if (r.rapid) Doni.show('calm', "Bir soniya o'qib oling", 'Juda tez javoblar hisoblanmaydi'); else if (r.confused) Doni.show('calm', "Bu ikki so'z o'xshash", 'Ularni yonma-yon ko\'ring'); }
  }

  /* ---------- grammar question card (tier colour) ---------- */
  const TIERC = ['#1E74E8', '#6A3DF0', '#D92F7A', '#FF8A1E', '#F5B700', '#0F7C99'];
  function grammarCard() {
    const E = R.eng;
    if (!E.cur) E.cur = gNext(E);
    if (!E.cur) { Store.ev(sid(), 'engdone', { work: R.inst.id, att: R.att, part: E.si }); R.eng = null; return partView(E.si); }
    const { q, plan } = E.cur, f = E.cur.fb;
    const green = f && f.ok, bg = green ? '#138A3D' : TIERC[q.tier - 1], dk = !green && (q.tier === 4 || q.tier === 5);
    const S = gState(E.B), n = S.sessions[E.gid].qn;
    let h = `<div class="qs ${dk ? 'dk' : ''}" style="background:${bg}"><div class="top"><span>${q.tier}-bosqich · ${esc(G.TIERS[q.tier - 1].uz)}${plan.mode === 'review' ? ' · takrorlash' : ''}</span><span class="row" style="gap:6px">${f && !f.ok ? '<span class="badge nq">Unchalik emas</span>' : ''}<span class="ghostbtn" style="cursor:default">${Math.min(n + (f ? 0 : 1), E.cap)}/${E.cap}</span></span></div>
      <div><div class="ask">${esc(q.prompt.uz)}</div><div style="font:750 18px var(--fd);opacity:.95">${esc(q.prompt.en)}</div>${q.hint ? `<span class="tag" style="margin-top:6px;background:rgba(255,255,255,.25);color:inherit">${esc(q.hint)}</span>` : ''}</div>
      <div class="gbody">${GUI.render(q, E.cur, !!f)}</div>`;
    if (f) h += `${f.ok ? '' : `<div class="fb"><span class="lab">To'g'ri javob</span><b>${esc(q.answerText)}</b>${q.feedback ? `<span>${esc(q.feedback)}</span>` : ''}</div>`}<div class="bottomrow"><span class="badge">${f.rapid ? 'Juda tez · hisoblanmadi' : f.ok ? "To'g'ri! +1 achko" : f.idk ? "Bilmayman · −1 achko · keyinroq yana qaytadi" : 'Xato · −1 achko · keyinroq yana qaytadi'}</span><button class="wbtn" data-act="gnext">Davom etish</button></div>`;
    else h += `<div class="bottomrow"><button class="ghostbtn" data-act="gidk">Bilmayman</button>${GUI.needsCheck(q) ? `<button class="wbtn" data-act="gcheck">Tekshirish</button>` : ''}</div>`;
    return h + '</div>';
  }
  function gSubmit(resp, idk) {
    const E = R.eng, c = E.cur; if (!c || c.fb) return;
    const rt = Date.now() - c.shownAt; const id = uid('g');
    const S = gState(E.B);
    const { event, result } = G.submitAnswer(S, E.B, E.gid, c.plan, c.q, idk ? {} : resp, rt, id);
    const rapid = event.rapid;
    Store.db.events.push({ id, sid: sid(), kind: 'g', ts: T.now(), gev: event, ok: result.ok, rapid, idk: !!idk, work: R.inst.id, att: R.att, part: E.si, ach: true }); Store._cache = {}; Store.save();
    c.fb = { ok: result.ok && !idk, rapid, idk: !!idk };
    if (result.ok && !rapid) { Snd.ok(); if (R.first) School.addGold(sid(), 5, 'work'); R.streak = (R.streak || 0) + 1; if (R.streak === 3) Doni.show('happy', 'Ketma-ket 3 ta!', 'Qoidani yaxshi tushunyapsiz'); }
    else { Snd.no(); R.streak = 0; }
    if (result.ok && c.q.ui === 'choice' && !rapid) setTimeout(() => { if (R && R.eng === E && E.cur === c) { E.cur = null; App.render(); } }, 900);
  }

  return { open, close, render, get R() { return R; }, cwSecEnd, A, exOf, exCheck, sendWriting, gradeEx, completePart, finishTest, finishWork, vAnswer, readType, gSubmit, ring, rich, inl, cwActive, kindsOf, canSend, wcMsg, partDone, secs };
})();
