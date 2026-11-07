/* =====================================================================
   TEACHER / ADMIN PANEL (English)
   Results · Assign · Lesson plans · Writing · Reports · Leaderboard · Settings
   ===================================================================== */
const Tea = (() => {
  const PC = { results: { homework: '#2E46E8', classwork: '#0B8F84', weekly: '#6A3DF0', test: '#C81E68', task: '#B07800' }, assign: '#D92F7A', plans: '#1E74E8', writing: '#FF6B57', reports: '#0F7C99', leader: '#F5B700', settings: '#8B5CF6' };
  const DARK = { writing: '#2B1300', leader: '#2B1700' };
  const V = { tab: 'results', r: { mode: 'homework', cls: null, week: null, lessons: null, test: null, task: null }, a: { src: '', parsed: null, groups: [], week: null, replace: false }, p: { cls: null, week: null, n: 1, edit: false, paste: '' }, w: { status: 'new', cls: '' }, lb: { cls: null, group: '', week: null }, st: { tab: 'classes', cls: null, scls: '' }, rep: 'new' };
  const db = () => Store.db;
  let U = null; // the teacher using the panel
  const isAdmin = () => !!(U && U.admin);
  const myClasses = () => db().classes.filter(c => isAdmin() || c.teacher === U.id);
  const groupsOf = c => db().groups.filter(g => db().students.some(s => s.cls === c.id && s.group === g));
  const stusOf = (c, g) => db().students.filter(s => s.cls === c.id && (!g || s.group === g)).sort(by('name'));
  const head = (t, sub, right = '') => `<div class="head"><div><h1>${t}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${right ? `<div class="row">${right}</div>` : ''}</div>`;
  const chip = (on, act, attrs, label, dis) => `<button class="chip ${on ? 'on' : ''}" data-act="${act}" ${attrs} ${dis ? 'disabled' : ''}>${label}</button>`;
  const wkNav = (act, w) => `<div class="row" style="gap:6px"><button class="btn ghost sm" data-act="${act}" data-d="-1">←</button><b style="min-width:150px;text-align:center">${w === T.weekStart() ? 'This week · ' : ''}${weekLabel(w)}</b><button class="btn ghost sm" data-act="${act}" data-d="1">→</button></div>`;
  const ICON = Stu.ICON;
  const NAV = [['results', 'Results', 'results'], ['assign', 'Assign', 'practice'], ['plans', 'Lesson plans', 'book'], ['writing', 'Writing', 'profile'], ['reports', 'Reports', 'trophy'], ['leader', 'Leaderboard', 'leader'], ['settings', 'Settings', 'castle']];

  function page(u) {
    U = u; const pc = V.tab === 'results' ? PC.results[V.r.mode] : PC[V.tab]; App.theme(pc, DARK[V.tab] || '#fff', '#FFD23F', '#14163D'); document.body.className = '';
    const newW = db().writings.filter(w => w.status === 'new' && visibleStu(w.sid)).length, newR = db().reports.filter(r => r.status === 'new' && visibleStu(r.sid)).length;
    $('#side').innerHTML = `<div class="brand"><i>A</i>English site</div>${NAV.map(([k, n, ic]) => `<button class="nav ${V.tab === k ? 'on' : ''}" data-act="ttab" data-k="${k}">${ICON[ic]}<span>${n}</span>${k === 'writing' && newW ? `<span class="bdg">${newW}</span>` : ''}${k === 'reports' && newR ? `<span class="bdg">${newR}</span>` : ''}</button>`).join('')}
      <div class="who"><b>${esc(U.name)}</b><span>${isAdmin() ? 'Admin' : 'Teacher'} · ${myClasses().length} classes</span>${App.ctx.as && App.ctx.as.type === 'teacher' ? '' : '<button class="outbtn" data-act="logout">Log out</button>'}</div>`;
    if (!myClasses().length && V.tab !== 'settings') return head('Welcome', 'You have no classes yet. Ask the admin to give you a class, or add one in Settings.') + `<button class="btn" data-act="ttab" data-k="settings">Open Settings</button>`;
    return ({ results, assign, plans, writing, reports, leader, settings })[V.tab]();
  }
  const visibleStu = sid => { const s = School.stu(sid); return s && myClasses().some(c => c.id === s.cls); };
  const pickCls = (cur) => { const L = myClasses(); return L.find(c => c.id === cur) || L[0]; };

  /* ================= RESULTS ================= */
  const MODES = [['homework', 'Homework'], ['classwork', 'Classwork'], ['weekly', 'Weekly exam'], ['test', 'Teacher tests'], ['task', 'Tasks']];
  function instOf(s, type, week, n) { return School.instances(s).find(i => i.type === type && i.w.week === week && (n == null || +i.w.lesson === n)); }
  function results() {
    const R = V.r, c = pickCls(R.cls); R.cls = c.id; if (R.week == null) R.week = T.weekStart();
    const ls = School.lessonsOf(c), now = T.now();
    if (!R.lessons || R.lessons.some(n => n > ls.length)) { const done = ls.filter(L => T.at(R.week, L.di, L.end) <= now), due = R.mode === 'homework' ? done.filter(L => School.hwWindow(c, L, R.week).close <= now) : done; R.lessons = [(due[due.length - 1] || done[done.length - 1] || ls[0] || { n: 1 }).n]; }
    let ctl = `<div class="chips" style="margin-bottom:14px">${MODES.map(([k, n]) => chip(R.mode === k, 'rmode', `data-k="${k}"`, n)).join('')}</div>
      <div class="card" style="margin-bottom:16px"><div class="row sp"><div class="chips">${myClasses().map(x => chip(x.id === c.id, 'rcls', `data-id="${x.id}"`, esc(x.name))).join('')}</div>`;
    let body = '';
    if (R.mode === 'homework' || R.mode === 'classwork' || R.mode === 'weekly') {
      ctl += wkNav('rweek', R.week) + '</div>';
      if (R.mode !== 'weekly') {
        const days = [...new Set(ls.map(L => L.day))];
        ctl += `<div class="row" style="margin-top:12px"><span class="label" style="margin:0">Lessons</span><div class="chips">${ls.map(L => chip(R.lessons.includes(L.n), 'rles', `data-n="${L.n}"`, `${L.n} <span class="small" style="opacity:.75">${L.day}</span>`)).join('')}</div></div>
          <div class="row" style="margin-top:8px"><span class="label" style="margin:0">Day</span><div class="chips">${days.map(d => { const ns = ls.filter(L => L.day === d).map(L => L.n); return chip(ns.length === R.lessons.length && ns.every(n => R.lessons.includes(n)), 'rday', `data-d="${d}"`, DAYFULL[d]); }).join('')}</div><span class="small muted">Several lessons = average, rounded up</span></div>`;
      }
      ctl += '</div>';
      body = groupsOf(c).map(g => groupBlock(c, g)).join('') || '<p class="muted">No students in this class yet. Add them in Settings.</p>';
    } else {
      const works = db().works.filter(w => w.type === R.mode && (w.groups || []).some(g => groupsOf(c).includes(g))).sort((a, b) => b.sentAt - a.sentAt);
      const key = R.mode === 'test' ? 'test' : 'task'; if (!works.find(w => w.id === R[key])) R[key] = works[0] ? works[0].id : null;
      ctl += `</div><div class="row" style="margin-top:12px"><span class="label" style="margin:0">${R.mode === 'test' ? 'Test' : 'Task'}</span><select class="input" style="max-width:420px" data-chg="rwork">${works.map(w => `<option value="${w.id}" ${w.id === R[key] ? 'selected' : ''}>${esc(School.parsed(w).meta.title || w.id)} · ${enWhen(w.sentAt)} · ${(w.groups || []).join(', ')}</option>`).join('')}</select></div></div>`;
      body = !works.length ? `<p class="muted">No ${R.mode === 'test' ? 'tests' : 'tasks'} sent to this class yet. Send one from Assign.</p>` : groupsOf(c).filter(g => (School.work(R[key]).groups || []).includes(g)).map(g => groupBlock(c, g)).join('') + (R.mode === 'test' ? analysis(c, School.work(R[key])) : '');
    }
    const title = { homework: 'Homework results', classwork: 'Classwork results', weekly: 'Weekly exam results', test: 'Teacher test results', task: 'Task results' }[R.mode];
    return head(title, 'Each circle is one student. Marks: above 85 = 5, above 75 = 4, above 55 = 3, above 30 = 2, otherwise 1. Redone work counts its best attempt.') + ctl + body;
  }
  /* one student's number for the chosen view: { pct, note, tick, insts } */
  function cell(c, s) {
    const R = V.r, now = T.now();
    if (R.mode === 'classwork' && c.taught === s.group) return { tick: true, insts: [] };
    let insts = [];
    if (R.mode === 'homework' || R.mode === 'classwork') insts = R.lessons.map(n => instOf(s, R.mode, R.week, n)).filter(Boolean);
    else if (R.mode === 'weekly') insts = [instOf(s, 'weekly', R.week)].filter(Boolean);
    else { const id = R.mode === 'test' ? R.test : R.task; insts = School.instances(s).filter(i => i.id === id); }
    if (!insts.length) return { none: true, insts };
    const res = insts.map(i => School.result(s, i, now)), vals = res.filter(r => r.pct != null).map(r => r.pct);
    if (!vals.length) return { pending: true, insts, started: res.some(r => r.started) };
    return { pct: Math.ceil(sum(vals) / vals.length), insts, partial: res.some(r => r.partial || r.pending), missed: res.every(r => r.missed) };
  }
  function groupBlock(c, g) {
    const ss = stusOf(c, g), cells = ss.map(s => ({ s, x: cell(c, s) }));
    const vals = cells.filter(o => o.x.pct != null).map(o => o.x.pct), avg = vals.length ? Math.ceil(sum(vals) / vals.length) : null;
    const taught = V.r.mode === 'classwork' && c.taught === g;
    return `<h2 class="sec-title" style="margin-top:22px">${esc(g)} <span class="small muted" style="font-family:var(--fb);font-weight:600">${ss.length} students${avg != null ? ` · average ${avg}% (${School.markOf(avg)})` : ''}${taught ? ' · you teach this group directly: no classwork' : ''}</span></h2>
      <div class="stus">${cells.map(({ s, x }) => `<div class="stu"><span class="nm">${esc(s.name)}</span>
        ${x.tick ? '<div class="tick">✓</div><span class="small muted">Taught directly</span>' : x.none ? '<div class="tick" style="background:var(--soft);color:var(--muted);font-size:20px">—</div><span class="small muted">Not assigned</span>' : x.pending ? `<div class="tick" style="background:var(--soft);color:var(--muted);font-size:20px">…</div><span class="small muted">${x.started ? 'In progress' : 'Not done yet'}</span>`
          : `${Run.ring(x.pct)}<span class="mark" style="background:var(--m${School.markOf(x.pct)});color:${School.markOf(x.pct) === 3 ? '#2B1700' : '#fff'}">Mark ${School.markOf(x.pct)}</span>${x.partial ? '<span class="small muted">Not done yet · can still do it</span>' : x.missed ? '<span class="small muted">Not done · 0%</span>' : ''}`}
        <div class="acts"><button data-act="graph" data-id="${s.id}">Graph</button>${x.insts && x.insts.length ? `<button data-act="det" data-id="${s.id}">Answers</button>` : ''}<button data-act="viewas" data-id="${s.id}">Open</button></div></div>`).join('')}</div>`;
  }
  /* question by question across the class (tests) */
  function analysis(c, w) {
    if (!w) return ''; const P = School.parsed(w), ss = db().students.filter(s => s.cls === c.id && (w.groups || []).includes(s.group));
    const rows = [];
    School.workSections(P).forEach(({ s: sec, si }) => sec.ex.forEach((ex, ei) => ex.items.forEach((it, ii) => {
      if (it.example || !['choice', 'gap', 'match'].includes(it.type)) return;
      const n = it.type === 'gap' ? it.segs.filter(x => x.gap).length : 1;
      for (let g = 0; g < n; g++) { const key = it.type === 'gap' ? ii + ':' + g : String(ii); let r = 0, t = 0; const wrong = [];
        ss.forEach(s => { const att = bestAtt(s.id, w.id); if (att == null) return; const e = Store.events(s.id).find(e => e.kind === 'ans' && e.work === w.id && e.att === att && e.key === si + '.' + ei); if (!e || !e.detail) return; const d = e.detail.find(d => d.i === key); if (!d) return; t++; const o = db().overrides[e.id]; const ok = o && o.items && key in o.items ? o.items[key] : d.ok; if (ok) r++; else wrong.push(s.name.split(' ')[0] + (d.input ? ` (${d.input})` : '')); });
        rows.push({ q: `${ex.num || ''} ${itemLabel(it, g)}`, r, t, wrong }); }
    })));
    if (!rows.length) return '';
    return `<h2 class="sec-title" style="margin-top:26px">Question by question</h2><div class="card scrollx"><table><thead><tr><th>Question</th><th>Right</th><th>Wrong (their answer)</th></tr></thead><tbody>${rows.map(x => { const p = x.t ? Math.round(x.r / x.t * 100) : null; return `<tr><td>${esc(x.q)}</td><td style="white-space:nowrap"><b style="color:${p == null ? 'inherit' : p >= 75 ? 'var(--ok)' : p >= 50 ? '#B07800' : 'var(--err)'}">${p == null ? '—' : p + '%'}</b> <span class="small muted">${x.r}/${x.t}</span></td><td class="small">${esc(x.wrong.join(', '))}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  function itemLabel(it, g) {
    if (it.type === 'choice') return it.stem || it.opts.map(o => o.t).join(' / ');
    if (it.type === 'match') return it.left + ' → ' + it.right;
    if (it.type === 'gap') { let k = 0; return it.segs.map(s => s.gap ? (k++ === g ? `[${s.gap[0]}]` : '___') : s.t).join(''); }
    return '';
  }
  function bestAtt(sid, wid) { let b = null, ba = null; Store.events(sid).filter(e => e.kind === 'fin' && e.work === wid).forEach(f => { const sc = School.attemptScore(sid, wid, f.att); if (sc && sc.pct != null && (b == null || sc.pct > b)) { b = sc.pct; ba = f.att; } }); return ba; }

  /* answers of one student (correct the marking here) */
  function detModal(sid, wid) {
    const s = School.stu(sid), c = School.cls(s.cls), x = cell(c, s); const insts = x.insts || []; if (!insts.length) return;
    const inst = insts.find(i => i.id === wid) || insts[0]; const P = inst.P;
    const atts = School.attempts(sid, inst.id), best = bestAtt(sid, inst.id), att = V.detAtt && atts.some(a => a.att === V.detAtt) ? V.detAtt : best != null ? best : (atts[atts.length - 1] || {}).att;
    const E = Store.events(sid).filter(e => e.work === inst.id && e.att === att);
    let h = `<button class="x" data-act="mclose">×</button><h2>${esc(s.name)}</h2><p class="muted" style="margin:4px 0 12px">${esc(P.meta.title || inst.id)} · ${inst.type}${inst.L ? ` · lesson ${inst.L.n} (${inst.L.day})` : ''}</p>
      ${insts.length > 1 ? `<div class="chips" style="margin-bottom:10px">${insts.map(i => chip(i.id === inst.id, 'det', `data-id="${sid}" data-w="${i.id}"`, 'Lesson ' + i.L.n)).join('')}</div>` : ''}
      <div class="chips" style="margin-bottom:14px">${atts.map(a => { const sc = School.attemptScore(sid, inst.id, a.att), fin = School.finished(sid, inst.id, a.att); return chip(a.att === att, 'detatt', `data-id="${sid}" data-w="${inst.id}" data-a="${a.att}"`, `Attempt ${a.att}${fin ? ` · ${sc.pct}%` : ' · unfinished'}${a.att === best ? ' ★' : ''}`); }).join('') || '<span class="muted">Not started.</span>'}</div>`;
    if (att != null) School.workSections(P).forEach(({ s: sec, si }) => {
      const p = Code.PARTS[sec.kind]; h += `<div class="part" style="background:${p.c};color:${p.t};display:block"><h3>${esc(sec.title || p.en)}</h3>`;
      sec.ex.forEach((ex, ei) => { const e = E.find(e => (e.kind === 'ans' || e.kind === 'write') && e.key === si + '.' + ei); if (!e) return;
        const o = db().overrides[e.id] || {}; h += `<div style="background:rgba(255,255,255,.92);color:#1C1C1E;border-radius:14px;padding:10px 12px;margin-top:8px"><b>${esc(ex.num || '')} ${esc(ex.instr.slice(0, 90))}</b>`;
        (e.detail || []).forEach(d => { const [ii, g] = String(d.i).split(':'); const it = ex.items[+ii]; const ok = o.items && d.i in o.items ? o.items[d.i] : d.ok;
          const label = String(d.i).startsWith('s:') ? d.i.slice(2) : it ? itemLabel(it, +g || 0) : d.i;
          h += `<div class="row sp" style="border-top:1px solid var(--line);padding:6px 0;flex-wrap:nowrap"><span class="small" style="min-width:0">${esc(label)}<br><span class="muted">Answer: ${esc(d.input || '(empty)')}</span></span><span class="row" style="flex:none;gap:4px"><b style="color:${ok ? 'var(--ok)' : 'var(--err)'}">${ok ? '✓' : '✗'}</b><button class="btn ghost sm" data-act="ovr" data-e="${e.id}" data-i="${esc(d.i)}" data-v="${ok ? 0 : 1}">${ok ? 'Mark wrong' : 'Mark right'}</button></span></div>`; });
        if (e.kind === 'write') { const W = db().writings.find(w => w.id === e.wid); h += `<p class="small" style="white-space:pre-wrap;margin:6px 0 0">${esc(W ? W.text : '')}</p><span class="tag">${W && W.fb ? 'Checked ' + W.fb.score + '/10' : 'On the Writing page'}</span>`; }
        h += '</div>'; });
      const eng = E.filter(e => (e.kind === 'vocab' || e.kind === 'g') && e.part === si);
      if (eng.length) h += `<div style="background:rgba(255,255,255,.92);color:#1C1C1E;border-radius:14px;padding:10px 12px;margin-top:8px"><b>${sec.gpack ? 'Adaptive grammar' : 'Word practice'} · ${eng.filter(e => Store.okOf(e) && !e.rapid).length}/${eng.length} right</b>${eng.map(e => { const ok = Store.okOf(e);
        const label = e.kind === 'vocab' ? `${e.wid} · ${(Vocab.FMT[e.fmt] || {}).uz || e.fmt}` : `${e.gev && e.gev.item || 'grammar'} `;
        return `<div class="row sp" style="border-top:1px solid var(--line);padding:5px 0;flex-wrap:nowrap"><span class="small">${esc(label)}${e.rapid ? ' · too fast, not counted' : ''}<br><span class="muted">${esc(e.input || (e.gev && JSON.stringify(e.gev.response || '').slice(0, 60)) || '')}</span></span><span class="row" style="flex:none;gap:4px"><b style="color:${ok ? 'var(--ok)' : 'var(--err)'}">${ok ? '✓' : '✗'}</b><button class="btn ghost sm" data-act="ovr" data-e="${e.id}" data-v="${ok ? 0 : 1}">${ok ? 'Mark wrong' : 'Mark right'}</button></span></div>`; }).join('')}</div>`;
      h += '</div>';
    });
    App.modal(h);
  }
  function graphModal(sid, mode) {
    const s = School.stu(sid); V.gmode = mode || V.gmode || 'homework';
    const all = School.instances(s).filter(i => i.type === V.gmode).map(i => ({ i, r: School.result(s, i) })).filter(x => x.r.pct != null && !x.r.pending).slice(-18);
    const d = all.map(x => ({ v: x.r.pct, l: x.i.L ? `${T.date(T.at(x.i.w.week, x.i.L.di, x.i.L.start)).getDate()} ${ENM[T.date(x.i.w.week).getMonth()]} L${x.i.L.n}` : (x.i.P.meta.title || '').slice(0, 10) }));
    App.modal(`<button class="x" data-act="mclose">×</button><h2>${esc(s.name)}</h2><p class="muted" style="margin:4px 0 12px">Last ${d.length} results</p>
      <div class="chips" style="margin-bottom:12px">${[['homework', 'Homework'], ['classwork', 'Classwork'], ['weekly', 'Weekly exam'], ['test', 'Tests']].map(([k, n]) => chip(V.gmode === k, 'graph', `data-id="${sid}" data-m="${k}"`, n)).join('')}</div>${Stu.chart(d, false)}
      <div class="row" style="margin-top:12px"><span class="tag">Achko this week: ${School.weekAchko(sid, T.weekStart())}</span><span class="tag">Gold: ${School.gold(sid)}</span><span class="tag">Known words: ${Object.values(School.vstate(s).words).filter(w => w.stage === 5).length}</span></div>`);
  }

  /* ================= ASSIGN ================= */
  function assign() {
    const A = V.a; if (A.week == null) A.week = T.weekStart();
    let h = head('Assign work', 'Paste the special code (written by the AI from the book page). The site reads it, checks it and shows exactly when each class sees it.', `<button class="btn" data-act="aiprompt">Copy AI instructions</button><button class="btn ghost" data-act="aexample">Load an example</button>`);
    h += `<div class="card"><textarea class="input code" rows="14" data-inp="asrc" placeholder="TYPE: homework&#10;LEVEL: A2&#10;LESSON: 3&#10;TITLE: …&#10;&#10;[grammar]&#10;…&#10;&#10;Several works in one paste: separate them with a line of =====">${esc(A.src)}</textarea>
      <div class="row" style="margin-top:10px"><button class="btn" data-act="aread">Read code</button><span class="small muted">Nothing is sent until you press Send.</span></div></div>`;
    if (A.parsed) h += A.parsed.map((P, k) => preview(P, k)).join('');
    h += sentList();
    return h;
  }
  function preview(P, k) {
    const A = V.a, t = P.type, secs = School.workSections(P);
    const errs = P.errors.map(e => `<div class="err"><b>line ${e.line}</b>${esc(e.msg)}</div>`).join(''), warns = P.warnings.map(e => `<div class="err w"><b>line ${e.line}</b>${esc(e.msg)}</div>`).join('');
    const groups = A.groups[k] || (A.groups[k] = db().groups.filter(g => g === (P.meta.level || '').toUpperCase()));
    let h = `<div class="card" style="margin-top:16px"><div class="row sp"><h2>${esc(P.meta.title || '(no title)')}</h2><span class="row"><span class="tag">${esc(t || '?')}</span><span class="tag">${esc(P.meta.level || '?')}</span>${P.meta.lesson ? `<span class="tag">Lesson ${esc(P.meta.lesson)}</span>` : ''}${P.meta.time ? `<span class="tag">⏱ ${esc(P.meta.time)} min</span>` : ''}${P.meta.open ? `<span class="tag">Open ${esc(P.meta.open)} min</span>` : ''}${P.meta.due ? `<span class="tag">Due in ${esc(P.meta.due)} days</span>` : ''}</span></div>
      ${P.errors.length ? `<p class="label" style="margin-top:12px;color:var(--err)">${P.errors.length} error${P.errors.length > 1 ? 's' : ''} · fix them before sending</p>${errs}` : '<div class="okline">✓ The code reads correctly</div>'}${warns}
      <div style="margin-top:12px">${secs.map(({ s }) => { const p = Code.PARTS[s.kind]; const n = sum(s.ex.map(Code.points));
        return `<div class="part" style="background:${p.c};color:${p.t}"><div><h3>${esc(s.title || p.en)}${s.min ? ` · ${s.min} min` : ''}</h3><small>${[s.ex.length ? s.ex.length + ' exercises' : '', n ? n + ' points' : '', s.gpack ? 'adaptive grammar · ' + s.gpack.ruleOrder.length + ' rules · ' + s.gpack.items.length + ' items' : '', s.cards.length ? s.cards.length + ' words' : '', School.HAS_VOCAB_ENGINE(P, s) ? 'word practice' : '', s.help ? 'has HELP' : ''].filter(Boolean).join(' · ')}</small></div><span>${esc(p.uz)}</span></div>`; }).join('')}
      ${P.words.length ? `<p class="small" style="margin:10px 0 0"><b>Words for So'zlarim (${P.words.length}):</b> ${P.words.map(c => esc(c.w)).join(', ')}</p>` : ''}</div>`;
    if (P.errors.length) return h + '</div>';
    h += `<div class="grid2" style="margin-top:14px"><div><p class="label">Groups</p><div class="chips">${db().groups.map(g => chip(groups.includes(g), 'agrp', `data-k="${k}" data-g="${g}"`, esc(g))).join('')}</div></div>
      ${['homework', 'classwork', 'weekly'].includes(t) ? `<div><p class="label">Week</p>${wkNav('aweek', A.week)}</div>` : '<div><p class="label">Opens</p><b>The moment you press Send</b></div>'}</div>`;
    const tm = timing(P, groups); h += tm.html;
    const dup = (t === 'homework' || t === 'classwork') ? db().works.filter(w => w.type === t && w.week === A.week && +w.lesson === +P.meta.lesson && w.groups.some(g => groups.includes(g))) : t === 'weekly' ? db().works.filter(w => w.type === 'weekly' && w.week === A.week && w.groups.some(g => groups.includes(g))) : [];
    if (dup.length) h += `<div class="err w"><b>replace</b>These groups already have this ${t} for this week${P.meta.lesson ? ' and lesson' : ''}: “${esc(dup.map(w => School.parsed(w).meta.title).join('”, “'))}”. Sending replaces it for the chosen groups (students' answers to the old one stay in history).</div>`;
    h += `<div class="row" style="margin-top:14px"><button class="btn" data-act="asend" data-k="${k}" ${!groups.length || tm.block ? 'disabled' : ''}>Send to ${groups.length ? groups.join(', ') : '…'}</button><button class="btn ghost" data-act="apreview" data-k="${k}">Try it as a student</button>${tm.block ? `<span class="small" style="color:var(--err)">${esc(tm.block)}</span>` : ''}</div></div>`;
    return h;
  }
  function timing(P, groups) {
    const t = P.type, A = V.a, rows = [], now = T.now(); let block = '';
    const classes = db().classes.filter(c => db().students.some(s => s.cls === c.id && groups.includes(s.group)));
    classes.forEach(c => {
      const ls = School.lessonsOf(c), gs = groups.filter(g => db().students.some(s => s.cls === c.id && s.group === g));
      if (t === 'homework' || t === 'classwork') {
        const L = ls[+P.meta.lesson - 1]; if (!L) { rows.push([c.name, gs, `No lesson ${P.meta.lesson}: this class has ${ls.length} lessons a week`, true]); block = `Lesson ${P.meta.lesson} does not exist in ${c.name}`; return; }
        if (t === 'homework') { const w = School.hwWindow(c, L, A.week); rows.push([c.name, gs, `Lesson ${L.n} (${L.day} ${L.start}). Opens ${enWhen(w.open)} · due ${enWhen(w.close)}`]); }
        else { const len = School.lessonLen(L), tot = sum(School.workSections(P).map(x => x.s.min || 0)); const taught = gs.filter(g => g === c.taught);
          rows.push([c.name, gs, `Lesson ${L.n}: ${L.day} ${L.start}–${L.end} (${len} min). Sections ${tot} min${tot > len ? ` · TOO LONG by ${tot - len} min` : tot < len ? ` · ${len - tot} min left for games` : ''}${taught.length ? ` · ${taught.join(', ')} is taught directly here and gets no classwork` : ''}`, tot > len]);
          if (tot > len) block = `Sections (${tot} min) are longer than lesson ${L.n} in ${c.name} (${len} min)`; }
      } else if (t === 'weekly') { if (!ls.length) return; const last = ls[ls.length - 1]; rows.push([c.name, gs, `Opens ${enWhen(T.at(A.week, last.di, last.end))} · closes ${enWhen(T.at(T.addWeeks(A.week, 1), ls[0].di, ls[0].start))} · ${P.meta.time} min timer · one attempt`]); }
      else if (t === 'test') rows.push([c.name, gs, `Open now until ${enWhen(now + (+P.meta.open) * 6e4)} · timer ${P.meta.time || P.meta.open} min · can be redone, best counts`]);
      else if (t === 'task') rows.push([c.name, gs, `Open now until ${enWhen(now + (+P.meta.due) * T.DAY)} (locked during lessons) · then 3 days late, a week in old works`]);
    });
    if (!rows.length) return { html: groups.length ? '<p class="muted small" style="margin-top:12px">No class has students in these groups yet.</p>' : '', block };
    return { block, html: `<div class="scrollx" style="margin-top:12px"><table><thead><tr><th>Class</th><th>Groups</th><th>When students see it</th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1].join(', '))}</td><td class="small" style="${r[3] ? 'color:var(--err);font-weight:700' : ''}">${esc(r[2])}</td></tr>`).join('')}</tbody></table></div>` };
  }
  function send(k) {
    const P = V.a.parsed[k], src = Code.splitWorks(V.a.src)[k], groups = V.a.groups[k] || [], t = P.type;
    if (!P.ok || !groups.length) return;
    const w = { id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type: t, code: src, groups: groups.slice(), sentAt: T.now(), by: U.id, title: P.meta.title || '' };
    if (t === 'homework' || t === 'classwork' || t === 'weekly') w.week = V.a.week; if (P.meta.lesson) w.lesson = +P.meta.lesson;
    // replacing: the old work leaves these groups
    db().works.forEach(o => { if (o.type === t && (t === 'homework' || t === 'classwork' || t === 'weekly') && o.week === w.week && (t === 'weekly' || +o.lesson === w.lesson)) o.groups = o.groups.filter(g => !groups.includes(g)); });
    db().works.push(w); Store.save(); toast(`Sent to ${groups.join(', ')}`);
    V.a.parsed.splice(k, 1); const parts = Code.splitWorks(V.a.src); parts.splice(k, 1); V.a.src = parts.join('\n\n=====\n\n'); V.a.groups.splice(k, 1); if (!V.a.parsed.length) V.a.parsed = null;
  }
  function sentList() {
    const ws = db().works.filter(w => (w.groups || []).length && db().classes.some(c => myClasses().includes(c) && groupsOf(c).some(g => w.groups.includes(g)))).sort((a, b) => b.sentAt - a.sentAt).slice(0, 40);
    if (!ws.length) return '';
    return `<h2 class="sec-title" style="margin-top:26px">Sent work</h2><div class="card scrollx"><table><thead><tr><th>Work</th><th>Type</th><th>Groups</th><th>When</th><th></th></tr></thead><tbody>${ws.map(w => { const P = School.parsed(w);
      return `<tr><td><b>${esc(P.meta.title || w.id)}</b>${w.lesson ? ` <span class="small muted">lesson ${w.lesson}</span>` : ''}</td><td>${esc(w.type)}</td><td>${esc(w.groups.join(', '))}</td><td class="small">${w.week ? weekLabel(w.week) : enWhen(w.sentAt)}</td><td style="white-space:nowrap"><button class="btn ghost sm" data-act="aedit" data-id="${w.id}">Code</button> <button class="btn ghost sm" data-act="adel" data-id="${w.id}">Remove</button></td></tr>`; }).join('')}</tbody></table></div>`;
  }
  const AI_PROMPT = () => `You write work for an English-learning website for Uzbek students. Write ONLY the special code below, nothing else. Student instructions (HELP:) are in Uzbek (Latin, o' g' with an apostrophe). Everything else in English.

HEADER (top lines, before the first [section])
TYPE: homework | classwork | test | weekly | task
LEVEL: A1 | A2 | B1 | B2 | C1 | C2
LESSON: n            (homework and classwork: the lesson number of the week)
TITLE: short title
TIME: minutes        (weekly: required timer; test: optional timer)
OPEN: minutes        (test: how long it stays open after sending)
DUE: days            (task: how many days it stays open)
BOOK: / UNIT: / PAGE: (optional)

SECTIONS
Homework parts, each at most once, in any order (the site shows them in this order):
[warmup] [grammar] [reading] [vocabulary] [writing] [practice] [review]
Classwork sections need their minutes and must fit the lesson: [vocabulary 10] [reading 15] [grammar 12] [listening 8] [speaking 8] [writing 10] [lifeskills 10] [review 5] [exam 10]
Task: only [reading] (with TEXT:) and [writing].
[words] (any type except tests): the lesson's word cards for So'zlarim and the word games.
A line after [section] can be its title: [reading 15] A day in Tashkent

THE MEANING OF A LINE DEPENDS ON ITS SECTION
1) Inside [words]: word cards
   word | n / v / adj / adv / phr | English meaning | Uzbek translation
   > example sentence with the word form in [brackets] | 3 wrong words, comma separated (optional)
   >> a short sentence (12 words or fewer) with the [word] in brackets, used for word-order games
   ? misspelling, misspelling     = synonym     ! opposite     ~ look-alike word in this list
   + other accepted form, form    * difficulty 1, 2 or 3
   or the short form:  word = translation
   Blocks: @group name: w1, w2, w3, w4   (groups come in threes)
           @scale question: weak < medium < strong
           @sort question: Bin = word, word | Bin = word, word
           @parts word = pre- + root (meaning) + -suf | meaning of the word
           @story Title   then the story on the next lines with at least 3 [words]
2) In homework [vocabulary], [warmup], [review]: short lines "word = translation" are the words practised by the word engine.
   [vocabulary] = this lesson's new words. [warmup] and [review] practise words already learnt (they may be empty of lines).
3) A section with #rule lines is an adaptive grammar pack (homework [grammar] / [practice], classwork [grammar]; never in weekly tests):
   #rule id | short pattern | tense: name | uz: Uzbek explanation of the rule
   #confuse ruleA ruleB          (rules students mix up)
   #tl id | meaning of a timeline (optional)
   itemId ruleId | sentence with ONE gap {right answer ~wrong ~wrong ~wrong (base word)} | uz: Uzbek translation | fb: Uzbek feedback
     optional fields: | sit: situation | q: question = right ~wrong ~wrong | tl: timelineId | from: base sentence | ctx: topic | pair: id
     two right answers: {have had|'ve had ~had ~has had}
   itemId ruleId text | a short text with several gaps {…} {…}
   itemId ruleId dialog | A: … {…} // B: … {…}
   itemId ruleId chain | A: … {…} >> B: … {…}     (one gap per step)
   Each gap needs at least 2 wrong answers. Write 4+ items per rule.
4) Every other line is a book exercise:
   ## 3a Instruction in English          starts an exercise (number optional)
   HELP: Uzbek explanation of how to do it
   EXAMPLE: a solved example shown in grey
   TEXT: one-line passage   or   TEXT: Title  then a """ block with the passage """ (# heading, - list, a | b table, Name: speech lines)
   ? Question | option | right option* | option          (* = right; ~ = also accepted; ANSWER: many when several are right; ANSWER: free for opinion questions)
   _ She [goes] to school every day.                       (gap; alternatives [goes/walks]; several gaps in one line are fine)
   BOX: word | word | word        (word box for the gaps)       CHOOSE: a | b | c   (each gap becomes a drop-down)
   = left side => right side      (matching; EXTRA: a spare right side)
   > open question                (the student writes; the teacher reads it on the Writing page)
   | a plain line of dialogue or context
   SORT Column: word | word       (graded sorting; two or more SORT lines)
   COLUMNS: a | b + WORDS: x | y  (opinion sorting, not graded)
   CHART: label 40 #2E46E8 | label 60   (a chart to read)
   SEE: 2a                        (show the TEXT of exercise 2a again)
   FROM: listening | speaking | photo | pronunciation   (the book exercise needs audio/speaking/pictures: rewrite it as reading or writing and say so)
   Writing: PROMPT: the task · MIN: 60 · MAX: 90 · KIND: paragraph (letter, email, story, essay…)
   !_ / !? / != at the start of a line: a solved example item.

RULES
- Hyphenated one-word answers (brother-in-law) are fine: the site shows the hyphens and the student types only the letters.
- Answers are checked ignoring case, spaces, punctuation and contractions (isn't = is not). Give alternatives with / when two answers are really right.
- Never Cyrillic letters. One work per paste, or several separated by a line of =====.
- Weekly tests: one attempt, a timer, any book exercise types, no grammar engine, no word lines.
`;
  const EXAMPLE = `TYPE: homework
LEVEL: A2
LESSON: 1
TITLE: My family

[words]
brother-in-law | n | the husband of your sister | pochcha
> My [brother-in-law] is a doctor. | uncle, cousin, nephew
? brother-in-low, brothr-in-law
cousin = amakivachcha
grandparents = buvi va bobo

[warmup]
HELP: Oldingi darsdagi so'zlarni takrorlang.

[grammar]
#rule hg.form | have/has got + noun | tense: have got | uz: Egalik: I/you/we/they have got, he/she/it has got.
hg1 hg.form | I {have got ~has got ~am got (have got)} two sisters. | uz: Mening ikkita opam bor. | fb: I → have got.
hg2 hg.form | She {has got ~have got ~is got (have got)} a cat. | uz: Uning mushugi bor. | fb: She → has got.
hg3 hg.form | They {have got ~has got ~are got (have got)} a big house. | uz: Ularning katta uyi bor. | fb: They → have got.
hg4 hg.form | My brother {has got ~have got ~is got (have got)} a new bike. | uz: Akamning yangi velosipedi bor. | fb: My brother = he → has got.
hg5 hg.form | We {have got ~has got ~are got (have got)} three cousins. | uz: Bizning uchta amakivachchamiz bor. | fb: We → have got.
hg6 hg.form | He {has got ~have got ~is got (have got)} blue eyes. | uz: Uning ko'zlari ko'k. | fb: He → has got.

[reading]
## 1 Read the text and answer the questions.
HELP: Matnni o'qing va savollarga javob bering.
TEXT: Aziz's family
"""
Aziz has got a big family. He lives with his parents and his grandparents in Samarkand.
His sister Malika is married. Her husband, Bobur, is Aziz's brother-in-law.
"""
? Where does Aziz live? | In Tashkent | In Samarkand* | In Bukhara
? Who is Bobur? | Aziz's cousin | Aziz's brother-in-law* | Aziz's uncle
_ Bobur is Aziz's [brother-in-law].

[vocabulary]
brother-in-law = pochcha
cousin = amakivachcha
grandparents = buvi va bobo
aunt = xola
uncle = amaki

[writing]
## 2 Write about your family.
HELP: Oilangiz haqida yozing: kimlar bor, ular nima ish qiladi.
PROMPT: Write about your family. Who is in your family? What do they do?
MIN: 40
MAX: 80
KIND: paragraph

[review]
`;

  /* ================= LESSON PLANS ================= */
  function plans() {
    const P = V.p, c = pickCls(P.cls); P.cls = c.id; if (P.week == null) P.week = T.weekStart();
    const ls = School.lessonsOf(c); if (P.n > ls.length) P.n = 1; const key = `${c.id}|${P.week}|${P.n}`, plan = (db().plans || {})[key];
    let h = head('Lesson plans', 'One plan per lesson per class. The [words] of a plan appear in the students’ So‘zlarim for that week.', `<button class="btn" data-act="ppaste">Paste plan code</button>`);
    h += `<div class="card" style="margin-bottom:16px"><div class="row sp"><div class="chips">${myClasses().map(x => chip(x.id === c.id, 'pcls', `data-id="${x.id}"`, esc(x.name))).join('')}</div>${wkNav('pweek', P.week)}</div>
      <div class="chips" style="margin-top:12px">${ls.map(L => chip(L.n === P.n, 'pn', `data-n="${L.n}"`, `${(db().plans || {})[`${c.id}|${P.week}|${L.n}`] ? '✓ ' : ''}Lesson ${L.n} · ${L.day} ${L.start}`)).join('')}</div></div>`;
    if (P.paste != null && P.pasting) {
      const res = Code.parsePlans(P.paste, ls.length);
      h += `<div class="card" style="margin-bottom:16px"><h3>Paste plan code for ${esc(c.name)} · ${weekLabel(P.week)}</h3><textarea class="input code" rows="12" data-inp="ppaste" style="margin-top:10px" placeholder="LESSON: 3&#10;TITLE: …&#10;GOAL: …&#10;[steps]&#10;…&#10;[words]&#10;every day = har kuni">${esc(P.paste)}</textarea>
        ${P.paste.trim() ? (res.errors.length ? res.errors.map(e => `<div class="err"><b>error</b>${esc(e)}</div>`).join('') : `<div class="okline">✓ ${res.plans.length} plan${res.plans.length > 1 ? 's' : ''}: ${res.plans.map(p => 'lesson ' + p.n + (db().plans[`${c.id}|${P.week}|${p.n}`] ? ' (replaces the old plan)' : '')).join(', ')}</div>`) : ''}
        <div class="row" style="margin-top:10px"><button class="btn" data-act="psave-paste" ${res.errors.length || !res.plans.length ? 'disabled' : ''}>Save plans</button><button class="btn ghost" data-act="pcancel">Cancel</button></div></div>`;
    }
    if (P.edit) { const p = plan || { title: '', goal: '', steps: [], words: [] };
      h += `<div class="card"><h3>Lesson ${P.n} · ${esc(c.name)}</h3><div class="grid2" style="margin-top:10px"><label><p class="label">Title</p><input class="input" id="pl-title" value="${esc(p.title)}"></label><label><p class="label">Goal</p><input class="input" id="pl-goal" value="${esc(p.goal)}"></label></div>
        <div class="grid2" style="margin-top:12px"><label><p class="label">Steps (one per line)</p><textarea class="input" rows="8" id="pl-steps">${esc(p.steps.join('\n'))}</textarea></label><label><p class="label">Words (word = translation)</p><textarea class="input code" rows="8" id="pl-words">${esc(p.words.map(w => w[0] + ' = ' + w[1]).join('\n'))}</textarea></label></div>
        <div class="row" style="margin-top:12px"><button class="btn" data-act="psave">Save</button><button class="btn ghost" data-act="pcancel">Cancel</button>${plan ? '<button class="btn ghost" data-act="pdel">Delete plan</button>' : ''}</div></div>`; }
    else if (plan) h += `<div class="card"><div class="row sp"><div><p class="label">Lesson ${P.n} · ${esc(c.name)} · ${weekLabel(P.week)}</p><h2>${esc(plan.title)}</h2></div><button class="btn ghost sm" data-act="pedit">Edit</button></div>${plan.goal ? `<p style="font-size:16px"><b>Goal:</b> ${esc(plan.goal)}</p>` : ''}
        ${plan.steps.length ? `<ol style="line-height:1.8">${plan.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}${plan.words.length ? `<p class="label" style="margin-top:12px">Words</p><div class="row">${plan.words.map(w => `<span class="tag" style="font-size:13px"><b>${esc(w[0])}</b> ${esc(w[1])}</span>`).join('')}</div>` : ''}</div>`;
    else h += `<div class="card" style="text-align:center;padding:30px"><p class="muted">No plan for lesson ${P.n} yet.</p><div class="row" style="justify-content:center"><button class="btn" data-act="pedit">Write a plan</button><button class="btn ghost" data-act="ppaste">Paste plan code</button></div></div>`;
    // the works of this lesson, for reference
    const ws = db().works.filter(w => w.week === P.week && +w.lesson === P.n && w.groups.some(g => groupsOf(c).includes(g)));
    if (ws.length) h += `<p class="small muted" style="margin-top:12px">Also for this lesson: ${ws.map(w => `${w.type} “${esc(School.parsed(w).meta.title)}” (${w.groups.join(', ')})`).join(' · ')}</p>`;
    return h;
  }

  /* ================= WRITING ================= */
  function wLabel(w) { const t = w.task; return t.type === 'task' ? `Task: ${t.title}` : `${t.type === 'homework' ? 'Homework' : t.type === 'classwork' ? 'Classwork' : 'Test'}${t.lesson ? ' · lesson ' + t.lesson : ''}${t.ex ? ' · ex ' + t.ex : ''}`; }
  function writing() {
    const W = V.w, cl = myClasses(); const list = db().writings.filter(w => visibleStu(w.sid) && (W.status === 'all' || w.status === W.status) && (!W.cls || School.stu(w.sid).cls === W.cls)).sort((a, b) => b.ts - a.ts);
    const newN = db().writings.filter(w => visibleStu(w.sid) && w.status === 'new').length;
    let h = head('Writing', 'Every writing from homework, classwork, tests and tasks. Check one by hand, or copy all new ones for the AI and paste its feedback back.', `<button class="btn" data-act="wcopy" ${newN ? '' : 'disabled'}>Copy all new for AI (${newN})</button><button class="btn ghost" data-act="wpaste">Paste AI feedback</button>`);
    h += `<div class="row" style="margin-bottom:14px"><div class="chips">${[['new', 'New'], ['checked', 'Checked'], ['all', 'All']].map(([k, n]) => chip(W.status === k, 'wstat', `data-k="${k}"`, n)).join('')}</div><div class="chips">${chip(!W.cls, 'wcls', 'data-id=""', 'All classes')}${cl.map(c => chip(W.cls === c.id, 'wcls', `data-id="${c.id}"`, esc(c.name))).join('')}</div></div>`;
    if (!list.length) return h + '<p class="muted">Nothing here.</p>';
    h += list.map(w => { const s = School.stu(w.sid), n = wcount(w.text), t = w.task, inLim = !t.max || (n >= t.min && n <= t.max);
      return `<div class="card" style="margin-bottom:12px"><div class="row sp"><div><b>${esc(w.id)} · ${esc(s.name)}</b> <span class="small muted">${esc(School.cls(s.cls).name)} · ${esc(s.group)} · ${enWhen(w.ts)}</span></div><span class="row"><span class="tag">${esc(wLabel(w))}</span><span class="tag">${esc(t.kind)}</span>${t.max ? `<span class="tag" style="${inLim ? '' : 'background:#FFE1DC;color:#B3261E'}">${n} words · ${t.min}–${t.max}</span>` : `<span class="tag">${n} words</span>`}</span></div>
        ${t.task ? `<p class="small muted" style="margin:8px 0 4px">Task: ${esc(t.task)}</p>` : ''}<p style="white-space:pre-wrap;background:var(--soft);border-radius:14px;padding:12px;margin:8px 0">${esc(w.text)}</p>
        ${w.fb ? `<div class="okline" style="background:var(--soft);color:inherit"><b>${w.fb.score}/10</b> · ${esc(w.fb.good)}${w.fb.fix.map(f => `<br><s>${esc(f[0])}</s> → <b>${esc(f[1])}</b>`).join('')}<br>Next: ${esc(w.fb.next)}${w.fb.words && w.fb.words.length ? `<br><span class="small">Target words used: ${esc(w.fb.words.join(', '))}</span>` : ''}</div><button class="btn ghost sm" style="margin-top:8px" data-act="wcheck" data-id="${w.id}">Edit feedback</button>`
          : `<button class="btn sm" data-act="wcheck" data-id="${w.id}">Check by hand</button>`}</div>`; }).join('');
    return h;
  }
  function wCheckModal(id) {
    const w = db().writings.find(x => x.id === id), f = w.fb || { score: 7, good: '', fix: [], next: '', words: [] };
    App.modal(`<button class="x" data-act="mclose">×</button><h2>${esc(w.id)} · ${esc(School.stu(w.sid).name)}</h2><p style="white-space:pre-wrap;background:var(--soft);border-radius:14px;padding:12px">${esc(w.text)}</p>
      <div class="grid2"><label><p class="label">Score (out of 10)</p><select class="input" id="wf-score">${[...Array(11)].map((_, i) => `<option ${i === f.score ? 'selected' : ''}>${i}</option>`).join('')}</select></label><label><p class="label">Target words used well (comma)</p><input class="input" id="wf-words" value="${esc((f.words || []).join(', '))}" placeholder="${esc((w.task.words || []).slice(0, 4).join(', '))}"></label></div>
      <label><p class="label" style="margin-top:12px">What was good (Uzbek)</p><textarea class="input" rows="2" id="wf-good">${esc(f.good)}</textarea></label>
      <label><p class="label" style="margin-top:12px">Corrections, one per line: wrong -> right</p><textarea class="input code" rows="4" id="wf-fix">${esc(f.fix.map(x => x[0] + ' -> ' + x[1]).join('\n'))}</textarea></label>
      <label><p class="label" style="margin-top:12px">Next time (Uzbek)</p><textarea class="input" rows="2" id="wf-next">${esc(f.next)}</textarea></label>
      <div class="row" style="margin-top:14px"><button class="btn" data-act="wsave" data-id="${w.id}">Save feedback</button></div>`);
  }
  function applyFb(w, fb) {
    w.fb = fb; w.status = 'checked';
    // target words used well in writing = the strongest evidence for "Use"
    const s = School.stu(w.sid), cards = School.allCards(s);
    (fb.words || []).forEach(x => { const c = cards.find(c => N.same(c.w, x) || c.id === Code.idOf(x)); if (c && !Store.events(s.id).some(e => e.kind === 'vocab' && e.fmt === 'writing' && e.wid === c.id && e.wr === w.id)) db().events.push({ id: uid('e'), sid: s.id, kind: 'vocab', ts: T.now(), wid: c.id, fmt: 'writing', ev: 3, ok: true, rapid: false, day: T.dayNum(), wr: w.id, ach: false, input: '(writing ' + w.id + ')' }); });
  }
  function aiCopyText() {
    const list = db().writings.filter(w => visibleStu(w.sid) && w.status === 'new');
    return `You are an English teacher checking short writings by Uzbek school students. For EACH writing below, answer in exactly this format, nothing else:

### W-number
SCORE: n/10
GOOD: one or two sentences in Uzbek (Latin) about what was good
FIX: wrong words -> corrected words      (one line per correction, the most important 3–6, in English)
NEXT: one sentence in Uzbek: what to focus on next time
WORDS: the target words the student used correctly, comma separated (leave empty if none)

Judge for the student's LEVEL, the KIND and the word limits. Be kind and specific.

` + list.map(w => { const s = School.stu(w.sid), t = w.task; return `### ${w.id}
STUDENT: ${s.name} | CLASS: ${School.cls(s.cls).name} | LEVEL: ${s.group}
FROM: ${wLabel(w)} | KIND: ${t.kind}${t.max ? ` | LIMIT: ${t.min}-${t.max} words` : ''} | WORDS WRITTEN: ${wcount(w.text)}
TASK: ${t.task || ''}
TARGET WORDS: ${(t.words || []).join(', ')}
TEXT:
${w.text}
`; }).join('\n');
  }
  function parseFb(txt) {
    const out = [], errs = []; let cur = null;
    String(txt).replace(/\r/g, '').split('\n').forEach((raw, i) => { const l = raw.trim(); if (!l) return; let m;
      if ((m = l.match(/^#{2,3}\s*(W-\d+)/i))) { cur = { id: m[1].toUpperCase(), score: null, good: '', fix: [], next: '', words: [] }; out.push(cur); return; }
      if (!cur) return;
      if ((m = l.match(/^SCORE:\s*(\d+)/i))) { cur.score = clamp(+m[1], 0, 10); return; }
      if ((m = l.match(/^GOOD:\s*(.*)$/i))) { cur.good = N.uzFix(m[1]); return; }
      if ((m = l.match(/^FIX:\s*(.*?)\s*(?:->|→)\s*(.*)$/i))) { cur.fix.push([m[1], m[2]]); return; }
      if ((m = l.match(/^NEXT:\s*(.*)$/i))) { cur.next = N.uzFix(m[1]); return; }
      if ((m = l.match(/^WORDS:\s*(.*)$/i))) { cur.words = m[1].split(',').map(x => x.trim()).filter(Boolean); return; }
      if (/^(STUDENT|FROM|TASK|TEXT|TARGET)/i.test(l)) return;
      errs.push(`Line ${i + 1}: not understood: ${l.slice(0, 50)}`); });
    out.forEach(f => { if (f.score == null) errs.push(`${f.id}: SCORE missing`); if (!db().writings.some(w => w.id === f.id)) errs.push(`${f.id}: no writing with this number`); });
    return { out, errs };
  }

  /* ================= REPORTS ================= */
  function reports() {
    const list = db().reports.filter(r => visibleStu(r.sid) && (V.rep === 'all' || r.status === V.rep)).sort((a, b) => b.ts - a.ts);
    let h = head('Reports', 'Students press “Xato bormi?” when they think a right answer was marked wrong. Accept it for this student, or for everyone who wrote the same.');
    h += `<div class="chips" style="margin-bottom:14px">${[['new', 'New'], ['done', 'Closed'], ['all', 'All']].map(([k, n]) => chip(V.rep === k, 'repst', `data-k="${k}"`, n)).join('')}</div>`;
    if (!list.length) return h + '<p class="muted">No reports.</p>';
    return h + list.map(r => { const s = School.stu(r.sid), w = School.work(r.work); if (!w) return ''; const P = School.parsed(w); const [si, ei] = r.key.split('.').map(Number); const ex = P.sections[si] && P.sections[si].ex[ei]; if (!ex) return '';
      const e = Store.events(r.sid).find(e => e.kind === 'ans' && e.work === r.work && e.att === r.att && e.key === r.key); const o = e ? db().overrides[e.id] || {} : {};
      return `<div class="card" style="margin-bottom:12px"><div class="row sp"><div><b>${esc(s.name)}</b> <span class="small muted">${esc(School.cls(s.cls).name)} · ${esc(s.group)} · ${enWhen(r.ts)}</span></div><span class="tag">${esc(P.meta.title)} · ex ${esc(ex.num || '')}</span></div>
        <p class="small" style="margin:6px 0">${esc(ex.instr)}</p>${r.note ? `<p style="background:var(--soft);border-radius:12px;padding:8px 12px;margin:6px 0">“${esc(r.note)}”</p>` : ''}
        ${e && e.detail ? e.detail.filter(d => !d.ok || (o.items && d.i in o.items)).map(d => { const [ii, g] = String(d.i).split(':'); const it = ex.items[+ii]; const ok = o.items && d.i in o.items ? o.items[d.i] : d.ok;
          return `<div class="row sp" style="border-top:1px solid var(--line);padding:8px 0"><span class="small">${esc(it ? itemLabel(it, +g || 0) : d.i)}<br>Student wrote: <b>${esc(d.input || '(empty)')}</b> ${ok ? '<span style="color:var(--ok)">· accepted</span>' : ''}</span>${ok ? '' : `<span class="row" style="gap:6px"><button class="btn sm" data-act="racc" data-r="${r.id}" data-i="${esc(d.i)}">Accept for this student</button>${d.input ? `<button class="btn ghost sm" data-act="raccall" data-r="${r.id}" data-i="${esc(d.i)}">Accept “${esc(d.input)}” for everyone</button>` : ''}</span>`}</div>`; }).join('') : '<p class="muted small">No checked answer found.</p>'}
        ${r.status === 'new' ? `<div class="row" style="margin-top:8px"><button class="btn ghost sm" data-act="rclose" data-r="${r.id}">The marking was right · close</button></div>` : '<span class="tag">Closed</span>'}</div>`; }).join('');
  }
  function accept(r, i, all) {
    const set = (e) => { const o = db().overrides[e.id] || (db().overrides[e.id] = { items: {} }); o.items = o.items || {}; o.items[i] = true; o.by = U.id; o.ts = T.now(); };
    const e0 = Store.events(r.sid).find(e => e.kind === 'ans' && e.work === r.work && e.att === r.att && e.key === r.key); if (!e0) return;
    const d0 = e0.detail.find(d => d.i === i); set(e0);
    if (all && d0 && d0.input) {
      db().events.filter(e => e.kind === 'ans' && e.work === r.work && e.key === r.key && e.detail).forEach(e => { const d = e.detail.find(d => d.i === i); if (d && !d.ok && N.same(d.input, d0.input)) set(e); });
      const [ii, g] = i.split(':'); if (g != null) { const A = db().accept[r.work] || (db().accept[r.work] = {}); const k = `${r.key}.${ii}.${g}`; (A[k] = A[k] || []).push(d0.input); }
    }
    r.status = 'done'; Store.save();
    toast(all ? 'Accepted for everyone who wrote it (and from now on)' : 'Accepted');
  }

  /* ================= LEADERBOARD ================= */
  function leader() {
    const L = V.lb, c = pickCls(L.cls); L.cls = c.id; if (L.week == null) L.week = T.weekStart();
    const rows = stusOf(c, L.group).map(s => ({ s, v: School.weekAchko(s.id, L.week) })).sort((a, b) => b.v - a.v), max = Math.max(1, ...rows.map(r => r.v));
    return head('Leaderboard', 'Weekly achko: +1 for every right answer, −1 for every wrong one (homework, classwork, word games, Erkin mashq, tasks). Resets Monday 00:00.')
      + `<div class="card" style="margin-bottom:16px"><div class="row sp"><div class="chips">${myClasses().map(x => chip(x.id === c.id, 'lbcls', `data-id="${x.id}"`, esc(x.name))).join('')}</div>${wkNav('lbweek', L.week)}</div><div class="chips" style="margin-top:10px">${chip(!L.group, 'lbgrp', 'data-g=""', 'All groups')}${groupsOf(c).map(g => chip(L.group === g, 'lbgrp', `data-g="${g}"`, esc(g))).join('')}</div></div>
      <div class="card">${rows.map((r, i) => `<div class="lbrow"><span class="rank ${i < 3 ? 'r' + (i + 1) : ''}">${i + 1}</span><b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.s.name)}</b><span class="tag">${esc(r.s.group)}</span><span class="lbbar"><i style="width:${Math.max(0, r.v) / max * 100}%"></i></span><b class="lbv">${r.v}</b></div>`).join('') || '<p class="muted">No students.</p>'}</div>`;
  }

  /* ================= SETTINGS ================= */
  function settings() {
    const S = V.st; const tabs = [['classes', 'Classes & timetable'], ['students', 'Students'], ...(isAdmin() ? [['teachers', 'Teachers']] : []), ['groups', 'Groups'], ['account', 'My account'], ['clock', 'Test clock'], ['data', 'Data']];
    let h = head('Settings', isAdmin() ? 'You are the admin: you see every class and teacher.' : 'You see your own classes.') + `<div class="chips" style="margin-bottom:16px">${tabs.map(([k, n]) => chip(S.tab === k, 'sttab2', `data-k="${k}"`, n)).join('')}</div>`;
    return h + ({ classes: sClasses, students: sStudents, teachers: sTeachers, groups: sGroups, account: sAccount, clock: sClock, data: sData })[S.tab]();
  }
  function sClasses() {
    const L = myClasses(), c = L.find(x => x.id === V.st.cls) || L[0];
    let h = `<div class="row" style="margin-bottom:14px"><div class="chips">${L.map(x => chip(c && x.id === c.id, 'scls', `data-id="${x.id}"`, esc(x.name))).join('')}</div><button class="btn sm" data-act="cadd">+ New class</button></div>`;
    if (!c) return h + '<p class="muted">No classes.</p>';
    V.st.cls = c.id; const ls = School.lessonsOf(c);
    h += `<div class="card"><div class="grid2"><label><p class="label">Class name</p><input class="input" data-chg="cname" value="${esc(c.name)}"></label>
      <label><p class="label">Group you teach directly here (no classwork for it)</p><select class="input" data-chg="ctaught"><option value="">None</option>${db().groups.map(g => `<option ${c.taught === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label></div>
      ${isAdmin() ? `<label style="display:block;margin-top:12px"><p class="label">Teacher</p><select class="input" data-chg="cteacher">${db().teachers.map(t => `<option value="${t.id}" ${c.teacher === t.id ? 'selected' : ''}>${esc(t.name)}${t.admin ? ' (admin)' : ''}</option>`).join('')}</select></label>` : ''}
      <p class="label" style="margin-top:18px">Timetable · ${ls.length} English lessons a week (numbered in order)</p>
      <div class="scrollx"><table><tbody>${DAYS.map(d => { const L2 = (c.sched[d] || []); return `<tr><td style="width:110px"><b>${DAYFULL[d]}</b></td><td>${L2.map((t, i) => `<span class="row" style="display:inline-flex;gap:4px;margin:3px 10px 3px 0;flex-wrap:nowrap"><input class="input" type="time" style="width:110px" data-chg="ltime" data-d="${d}" data-i="${i}" data-w="0" value="${t[0]}">–<input class="input" type="time" style="width:110px" data-chg="ltime" data-d="${d}" data-i="${i}" data-w="1" value="${t[1]}"><button class="btn ghost sm" data-act="ldel" data-d="${d}" data-i="${i}" aria-label="Remove lesson">×</button></span>`).join('')}<button class="btn ghost sm" data-act="ladd" data-d="${d}">+ lesson</button></td></tr>`; }).join('')}</tbody></table></div>
      <p class="small muted">Lesson numbers: ${ls.map(L => `${L.n} = ${L.day} ${L.start}`).join(' · ') || 'none'}. Changing the timetable moves the opening times of work already sent.</p>
      ${isAdmin() ? `<button class="btn ghost sm" data-act="cdel" ${db().students.some(s => s.cls === c.id) ? 'disabled title="Move or remove its students first"' : ''}>Delete class</button>` : ''}</div>`;
    return h;
  }
  function sStudents() {
    const L = myClasses(), f = V.st.scls; const list = db().students.filter(s => L.some(c => c.id === s.cls) && (!f || s.cls === f)).sort((a, b) => (a.cls + a.name).localeCompare(b.cls + b.name));
    const clsSel = (v, attrs) => `<select class="input" ${attrs}>${L.map(c => `<option value="${c.id}" ${v === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;
    const grpSel = (v, attrs) => `<select class="input" ${attrs}>${db().groups.map(g => `<option ${v === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>`;
    return `<div class="chips" style="margin-bottom:12px">${chip(!f, 'sscls', 'data-id=""', 'All')}${L.map(c => chip(f === c.id, 'sscls', `data-id="${c.id}"`, esc(c.name))).join('')}</div>
      <div class="card scrollx"><table><thead><tr><th>Name</th><th>Class</th><th>Group</th><th>Login</th><th>Password</th><th></th></tr></thead><tbody>
      ${list.map(s => `<tr><td><input class="input" data-chg="sname" data-id="${s.id}" value="${esc(s.name)}"></td><td>${clsSel(s.cls, `data-chg="scls" data-id="${s.id}"`)}</td><td>${grpSel(s.group, `data-chg="sgrp" data-id="${s.id}"`)}</td><td><input class="input" data-chg="slogin" data-id="${s.id}" value="${esc(s.login)}"></td><td><input class="input" data-chg="spass" data-id="${s.id}" value="" placeholder="New password" autocomplete="new-password"></td><td style="white-space:nowrap"><button class="btn ghost sm" data-act="viewas" data-id="${s.id}">Open</button> <button class="btn ghost sm" data-act="sdel" data-id="${s.id}">Remove</button></td></tr>`).join('')}
      <tr><td><input class="input" id="ns-name" placeholder="New student name"></td><td>${clsSel(f || (L[0] || {}).id, 'id="ns-cls"')}</td><td>${grpSel(db().groups[0], 'id="ns-grp"')}</td><td><input class="input" id="ns-login" placeholder="login"></td><td><input class="input" id="ns-pass" placeholder="password"></td><td><button class="btn sm" data-act="sadd">Add</button></td></tr></tbody></table></div>
      <div class="card" style="margin-top:16px"><h3>Add many at once</h3><p class="small muted">One student per line: <code>Name, login, password</code> — optionally <code>, class, group</code> at the end (e.g. <code>Pat Matty, goodwill, 12345, 7-A, A2</code>). Otherwise they go to the class and group chosen here.</p>
        <textarea class="input code" rows="5" id="bulk"></textarea><div class="row" style="margin-top:10px">${clsSel(f || (L[0] || {}).id, 'id="bulk-cls" style="max-width:200px"')}${grpSel(db().groups[0], 'id="bulk-grp" style="max-width:120px"')}<button class="btn" data-act="sbulk">Add students</button></div><div id="bulk-res"></div></div>`;
  }
  function sTeachers() {
    return `<div class="card scrollx"><table><thead><tr><th>Name</th><th>Login</th><th>Password</th><th>Classes</th><th></th></tr></thead><tbody>${db().teachers.map(t => `<tr><td><input class="input" data-chg="tname" data-id="${t.id}" value="${esc(t.name)}"></td><td><input class="input" data-chg="tlogin" data-id="${t.id}" value="${esc(t.login)}"></td><td><input class="input" data-chg="tpass" data-id="${t.id}" value="" placeholder="New password" autocomplete="new-password"></td><td class="small">${db().classes.filter(c => c.teacher === t.id).map(c => esc(c.name)).join(', ') || '—'}</td><td style="white-space:nowrap">${t.admin ? '<span class="tag">Admin</span>' : `<button class="btn ghost sm" data-act="topen" data-id="${t.id}">Open account</button> <button class="btn ghost sm" data-act="tdel" data-id="${t.id}">Remove</button>`}</td></tr>`).join('')}
      <tr><td><input class="input" id="nt-name" placeholder="New teacher"></td><td><input class="input" id="nt-login" placeholder="login"></td><td><input class="input" id="nt-pass" placeholder="password"></td><td></td><td><button class="btn sm" data-act="tadd">Add</button></td></tr></tbody></table></div><p class="small muted">Give a teacher a class in “Classes & timetable”. Opening a teacher's account is real: changes are saved.</p>`;
  }
  function sGroups() { return `<div class="card"><p class="small muted" style="margin-top:0">A group is an English level. Work is sent to groups; one group spans many classes.</p><div class="row">${db().groups.map(g => { const used = db().students.some(s => s.group === g); return `<span class="tag" style="font-size:14px;padding:6px 12px">${esc(g)} <button data-act="gdel" data-g="${esc(g)}" ${used ? 'disabled title="Students are in this group"' : ''} aria-label="Remove">×</button></span>`; }).join('')}</div><div class="row" style="margin-top:12px"><input class="input" id="ng" placeholder="e.g. B2" style="max-width:160px"><button class="btn sm" data-act="gadd">Add group</button></div></div>`; }
  function sAccount() { return `<div class="card" style="max-width:520px"><label><p class="label">Name</p><input class="input" data-chg="mename" value="${esc(U.name)}"></label><label><p class="label" style="margin-top:12px">Login</p><input class="input" data-chg="melogin" value="${esc(U.login)}"></label><label><p class="label" style="margin-top:12px">Password</p><input class="input" data-chg="mepass" value="" placeholder="Type a new password" autocomplete="new-password"></label><p class="small muted">Passwords are stored encrypted, so they are never shown. Type a new one to change it. Students can never change their own login or password; you set them in Students.</p>${App.ctx.as ? '' : '<button class="btn ghost" data-act="logout">Log out</button>'}</div>`; }
  function sClock() { const on = T.offset !== 0; const d = T.date(); const v = `${T.iso()}T${T.hm()}`;
    return `<div class="card" style="max-width:620px"><p style="margin-top:0">Pretend the site is at another date and time, to try lesson time, homework opening, deadlines and the weekly test. It changes the clock only in this browser, for you; students always see real time.</p><p><b>Site time now:</b> ${enWhen(T.now())}${on ? ' <span class="tag" style="background:#FFE1DC;color:#B3261E">test clock on</span>' : ''}</p>
      <div class="row"><input class="input" type="datetime-local" id="clk" value="${v}" style="max-width:260px"><button class="btn" data-act="clkset">Set</button><button class="btn ghost" data-act="clkreset" ${on ? '' : 'disabled'}>Back to real time</button></div>
      <div class="row" style="margin-top:12px">${[['+1 h', 3600e3], ['+1 day', 864e5], ['+1 week', 7 * 864e5], ['−1 day', -864e5]].map(([n, ms]) => `<button class="btn ghost sm" data-act="clkadd" data-ms="${ms}">${n}</button>`).join('')}</div></div>`; }
  function sData() { return `<div class="card" style="max-width:720px"><p style="margin-top:0">Everything is saved in the school database as it happens. The backup file is a copy of what this page has loaded (answers from the last ${Net.since ? Math.round((Date.now() - Net.since) / 864e5) : 42} days).</p>
    <div class="row"><button class="btn" data-act="dexp">Export backup</button></div>
    <p class="small muted">${Net.pending() ? `<b>${Net.pending()} changes waiting to be sent</b> · ` : 'All changes sent · '}${db().events.length} answers loaded · ${db().works.length} works · ${db().students.length} students · about ${Math.round(JSON.stringify(db()).length / 1024)} KB</p></div>`; }

  return { V, page, detModal, graphModal, send, aiCopyText, parseFb, applyFb, wCheckModal, accept, AI_PROMPT, EXAMPLE, isAdmin, myClasses, me: () => U, bestAtt };
})();
