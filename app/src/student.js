/* =====================================================================
   STUDENT SIDE — interface only in Uzbek
   Asosiy · Natijalar · So'zlarim · Erkin mashq · O'yinlar · Qal'a · Reyting · Kuboklar · Profil
   ===================================================================== */
const Stu = (() => {
  const SC = { home: ['#2340E0', '#FFD23F'], results: ['#0D7F72', '#FF9F1C'], words: ['#1E74E8', '#B8F53B'], practice: ['#5B2BD9', '#B8F53B'], games: ['#D4246F', '#5CE1F0'], castle: ['#1B1150', '#FFC93C'], leader: ['#1F2A8C', '#FF8A1E'], trophies: ['#7A1FA2', '#FFC93C'], profile: ['#C93B26', '#8BF0D6'] };
  const TABS = [['home', 'Asosiy', 'home'], ['words', "So'zlarim", 'book'], ['results', 'Natijalar', 'results'], ['practice', 'Erkin mashq', 'practice'], ['games', "O'yinlar", 'games'], ['castle', "Qal'a", 'castle'], ['leader', 'Reyting', 'leader'], ['trophies', 'Kuboklar', 'trophy'], ['profile', 'Profil', 'profile']];
  const OPEN_IN_LESSON = ['home', 'leader', 'words'];
  const V = { tab: 'home', view: null, rmode: 'hw', lb: 'class', wf: 'past', wq: '', pr: null };
  let S = null;
  const me = () => S;
  const pills = () => S ? `<span class="row" style="gap:6px"><span class="pill"><span class="coin" style="background:#138A3D;color:#fff">A</span>${School.weekAchko(S.id, T.weekStart())} achko</span><span class="pill"><span class="coin" style="background:#F5B700;color:#2B1700">O</span>${School.gold(S.id)} oltin</span></span>` : '';
  const top = (title, sub) => `<div class="s-top"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${pills()}</div>`;
  const lessonNow = () => S && School.lessonNow(School.cls(S.cls));

  function nav() {
    const L = lessonNow(), c = School.cls(S.cls);
    return `<div class="brand"><i>A</i>Ingliz tili</div>${TABS.map(([k, n, ic]) => { const lock = L && !OPEN_IN_LESSON.includes(k); return `<button class="nav ${V.tab === k && !Run.R ? 'on' : ''} ${lock ? 'lock' : ''}" data-act="sttab" data-k="${k}">${ICON[ic]}<span>${n}</span></button>`; }).join('')}
      <div class="who"><b>${esc(S.name)}</b><span>${esc(c ? c.name : '')} · ${esc(S.group)}</span><div class="tgl"><button data-act="snd">${Snd.on() ? '🔊' : '🔇'}</button><button data-act="donitgl">Doni: ${Doni.enabled() ? 'yoniq' : "o'chiq"}</button></div>${App.ctx.mode === 'student' ? '<button class="outbtn" data-act="logout">Chiqish</button>' : ''}</div>`;
  }
  function theme() { const k = Run.R ? 'home' : V.tab; const [pc, ac] = SC[k]; App.theme(pc, '#fff', ac, '#14163D'); document.body.className = 'stuapp'; }
  function page(s) {
    S = s; Doni.leaves = (() => { const k = Object.values(School.vstate(S).words).filter(w => w.stage === 5).length; return k >= 14 ? 3 : k >= 6 ? 2 : 1; })();
    const L = lessonNow(); if (L && !OPEN_IN_LESSON.includes(V.tab) && !Run.R) V.tab = 'home';
    theme(); $('#side').innerHTML = nav();
    if (Run.R) return Run.render();
    if (V.view === 'old') return oldPage();
    if (V.view && V.view.word) return wordPage(V.view.word);
    return ({ home, results, words, practice, games, castle, leader, trophies, profile })[V.tab]();
  }

  /* ---------------- Asosiy ---------------- */
  function home() {
    const now = T.now(), L = lessonNow(), first = S.name.split(' ')[0], date = `${UZD[DOW(now)]}, ${T.date(now).getDate()}-${UZM[T.date(now).getMonth()]}`;
    const insts = School.instances(S, now);
    const testTiles = insts.filter(i => i.type === 'test' && School.state(S, i, now) !== 'gone' && School.state(S, i, now) !== 'future').map(i => testTile(i, now));
    if (L) {
      const c = School.cls(S.cls); const cw = insts.find(i => i.type === 'classwork' && i.w.week === L.week && i.L.n === L.L.n);
      let body;
      if (c.taught === S.group) body = `<div class="card big-note"><div style="font-size:40px">👩‍🏫</div><h2>Bugun o'qituvchi siz bilan bevosita dars o'tadi</h2><p>Qurilma kerak emas. Uy vazifasi oxirgi darsdan keyin shu yerda ochiladi.</p></div>`;
      else if (cw) { const plan = School.workSections(cw.P); body = `<div class="tiles"><button class="tile" style="background:#12B39A;color:#0C2340" data-act="openwork" data-id="${cw.id}" data-live="1"><span class="t-kind">Sinf ishi · hozir</span><div><h3>${L.L.n}-dars</h3><div class="t-list">${plan.map(x => `${esc(Code.PARTS[x.s.kind].uz)} · ${x.s.min} daq`).join('<br>')}</div></div><span class="t-time">${L.L.start}–${L.L.end}</span></button></div>`; }
      else body = `<div class="card big-note"><div style="font-size:40px">📘</div><h2>Bu dars uchun sinf ishi hali qo'yilmagan</h2><p>O'qituvchini tinglang.</p></div>`;
      return top(`Salom, ${esc(first)}!`, date + ' · hozir dars') + `<p class="muted" style="margin:0 4px 14px">Dars vaqtida faqat sinf ishi, So'zlarim va Reyting ochiq. Uy vazifalari dars tugagach ochiladi.</p>` + body
        + (testTiles.length ? `<h2 class="sec-title">Testlar</h2><div class="tiles">${testTiles.join('')}</div>` : '') + weekWordsCard();
    }
    const hws = insts.filter(i => i.type === 'homework'), stHw = i => School.state(S, i, now);
    const cur = hws.filter(i => ['open', 'locked'].includes(stHw(i)));
    const firstNow = cur.find(i => stHw(i) === 'open' && !School.finished(S.id, i.id, (School.attempts(S.id, i.id).slice(-1)[0] || {}).att));
    const wk = insts.filter(i => i.type === 'weekly' && ['soon', 'open', 'running', 'done', 'closed'].includes(School.state(S, i, now)) && now < i.close + 3 * T.DAY).map(i => weeklyTile(i, now));
    const tasks = insts.filter(i => i.type === 'task' && stHw(i) === 'open').map(i => taskTile(i, now));
    const late = hws.filter(i => stHw(i) === 'late'), lateTasks = insts.filter(i => i.type === 'task' && stHw(i) === 'late');
    const cwLate = insts.filter(i => i.type === 'classwork' && stHw(i) === 'late');
    const oldN = oldList().undone.length + oldList().done.length;
    return top(`Salom, ${esc(first)}!`, date)
      + `<h2 class="sec-title">Hozirgi uy vazifasi</h2>${cur.length ? `<div class="hwlist">${cur.map(i => hwCard(i, i === firstNow, now)).join('')}</div>` : '<p class="muted">Hozircha uy vazifasi yo\'q.</p>'}`
      + weekWordsCard()
      + (wk.length || testTiles.length ? `<h2 class="sec-title">Testlar</h2><div class="tiles">${wk.join('')}${testTiles.join('')}</div>` : '')
      + (tasks.length ? `<h2 class="sec-title">Topshiriqlar</h2><div class="tiles">${tasks.join('')}</div>` : '')
      + (late.length || cwLate.length || lateTasks.length ? `<h2 class="sec-title">Tugallanmagan ishlar</h2><p class="muted" style="margin:-6px 4px 12px">3 kun shu yerda turadi, keyin “Eski ishlar”ga o'tadi. Kech bajarilsa ham baho bir xil.</p>${late.length ? `<div class="hwlist">${late.map(i => hwCard(i, false, now)).join('')}</div>` : ''}${cwLate.length || lateTasks.length ? `<div class="tiles" style="margin-top:12px">${cwLate.map(i => cwTile(i, now)).join('')}${lateTasks.map(i => taskTile(i, now)).join('')}</div>` : ''}` : '')
      + `<button class="oldbtn" data-act="stold"><span>🗂️ Eski ishlar</span><b>${oldN}</b><small>3–7 kunlik tugallanmagan ishlar va qayta ishlash uchun bajarilganlar. Bir haftadan keyin yo'qoladi.</small></button>`;
  }
  function attInfo(i) { const a = School.attempts(S.id, i.id); const last = a[a.length - 1]; const done = last ? School.partsDone(S.id, i.id, last.att).size : 0; const fin = last && School.finished(S.id, i.id, last.att); return { n: a.length, done, fin, total: School.workSections(i.P).length, best: School.best(S.id, i.id) }; }
  function hwCard(i, now_, now) {
    const st = School.state(S, i, now), a = attInfo(i), lbl = `${i.L.n}-dars uy vazifasi`;
    let when, tag = '';
    if (st === 'locked') { when = `Bugungi oxirgi darsdan keyin ochiladi (${T.hm(i.open)}). Muddat: ${uzWhen(i.close)}`; tag = '<span class="tag">🔒 Yopiq</span>'; }
    else if (st === 'late') { when = `Muddati o'tdi, baho bir xil · yana ${uzLeft(i.late - now)} shu yerda`; tag = '<span class="tag" style="background:#FF9F1C;color:#2B1700">Kechikkan</span>'; }
    else if (st === 'old') { when = `Eski ish · yana ${uzLeft(i.old - now)} ochiq`; tag = '<span class="tag">Eski</span>'; }
    else if (st === 'donepast') { when = `Bajarildi · eng yaxshi natija ${a.best}%`; tag = '<span class="tag" style="background:#B8F53B;color:#14163D">✓</span>'; }
    else { when = a.fin ? `Bajarildi · ${a.best}% · muddat ${uzWhen(i.close)}` : `Muddat: ${uzWhen(i.close)} · ${uzLeft(i.close - now)} qoldi`; tag = a.fin ? '<span class="tag" style="background:#B8F53B;color:#14163D">✓ Bajarildi</span>' : now_ ? '<span class="tag" style="background:var(--ac);color:var(--act)">Hozir</span>' : ''; }
    const parts = School.workSections(i.P);
    return `<button class="hwcard ${st === 'locked' ? 'is-locked' : ''} ${now_ ? 'now' : ''}" data-act="openwork" data-id="${i.id}" data-state="${st}">
      <div class="row sp"><h3>${lbl}</h3>${tag}</div><div class="stripes">${parts.map((x, k) => `<i style="background:${Code.PARTS[x.s.kind].c};opacity:${a.fin || k < a.done ? 1 : .25}"></i>`).join('')}</div>
      <div class="row sp"><span class="small" style="opacity:.88">${when}</span><b style="font-family:var(--fd)">${a.fin ? a.total : a.done}/${a.total}</b></div></button>`;
  }
  const cwTile = (i, now) => { const st = School.state(S, i, now), a = attInfo(i); return `<button class="tile" style="background:#12B39A;color:#0C2340" data-act="openwork" data-id="${i.id}"><span class="t-kind">${a.fin ? '✓ Sinf ishi · qayta ishlash' : st === 'old' ? 'Eski sinf ishi' : 'Tugallanmagan sinf ishi'}</span><div><h3>${i.L.n}-dars</h3><div class="t-list">${UZD[i.L.day]} ${i.L.start}–${i.L.end}${a.best != null ? ` · ${a.best}%` : ''}</div></div><span class="t-time">${st === 'donepast' ? '↻ Qayta ishlash' : 'Yana ' + uzLeft((st === 'late' ? i.late : i.old) - now) + ' ochiq'}</span></button>`; };
  function testTile(i, now) {
    const st = School.state(S, i, now), b = School.best(S.id, i.id), q = sum(School.workSections(i.P).map(x => sum(x.s.ex.map(Code.points))));
    if (st === 'closed') return `<button class="tile locked" data-act="toast" data-t="Test yopilgan"><span class="t-kind">O'qituvchi testi · yopildi</span><div><h3>${esc(i.P.meta.title || 'Test')}</h3><div class="t-list">${b != null ? `Natija: ${b}% · ${School.markOf(b)} baho` : 'Topshirilmadi'}</div></div><span class="t-time">${uzWhen(i.close)}</span></button>`;
    return `<button class="tile" style="background:${b != null ? '#B8F53B' : '#E8337E'};color:${b != null ? '#14163D' : '#fff'}" data-act="starttest" data-id="${i.id}"><span class="t-kind">${b != null ? "✓ O'qituvchi testi · eng yaxshi natija" : "O'qituvchi testi"}</span><div><h3>${b != null ? b + '%' : esc(i.P.meta.title || 'Test')}</h3><div class="t-list">${q} ta savol · ⏱ ${i.timer} daqiqa${b != null ? ` · ${School.markOf(b)} baho` : ''}</div></div><span class="t-time">${uzWhen(i.close)} gacha · ${uzLeft(i.close - now)} qoldi</span></button>`;
  }
  function weeklyTile(i, now) {
    const st = School.state(S, i, now), q = sum(School.workSections(i.P).map(x => sum(x.s.ex.map(Code.points))));
    if (st === 'soon') return `<button class="tile locked" data-act="toast" data-t="Haftalik test ${uzWhen(i.open)} da ochiladi"><span class="t-kind">🔒 Shu haftaning testi</span><div><h3>Haftalik test</h3><div class="t-list">${q} ta savol · ⏱ ${i.timer} daqiqa<br>Faqat 1 marta topshiriladi</div></div><span class="t-time">${uzWhen(i.open)} da ochiladi</span></button>`;
    if (st === 'done' || st === 'closed') { const b = School.best(S.id, i.id); return `<button class="tile" style="background:#6A3DF0" data-act="toast" data-t="Haftalik test faqat bir marta topshiriladi"><span class="t-kind">Shu haftaning testi</span><div><h3>${b != null ? b + '%' : 'Topshirilmadi'}</h3><div class="t-list">${b != null ? School.markOf(b) + ' baho' : ''}</div></div><span class="t-time">${st === 'done' ? 'Topshirildi' : 'Yopildi'}</span></button>`; }
    return `<button class="tile" style="background:#FF9F1C;color:#2B1700" data-act="starttest" data-id="${i.id}"><span class="t-kind">Shu haftaning testi${st === 'running' ? ' · davom etmoqda' : ''}</span><div><h3>Haftalik test</h3><div class="t-list">${q} ta savol · ⏱ ${i.timer} daqiqa · 1 marta</div></div><span class="t-time">${uzWhen(i.close)} gacha</span></button>`;
  }
  function taskTile(i, now) {
    const a = attInfo(i), st = School.state(S, i, now), parts = School.workSections(i.P);
    return `<button class="tile" style="background:#FFD23F;color:#14163D" data-act="openwork" data-id="${i.id}"><span class="t-kind">${a.fin ? "✓ Bajarildi · qayta ishlash mumkin" : 'Topshiriq · ' + parts.map(x => Code.PARTS[x.s.kind].uz).join(' + ')}</span><div><h3>${esc(i.P.meta.title || 'Topshiriq')}</h3></div><span class="t-time">${st === 'late' ? 'Kechikkan · ' + uzLeft(i.late - now) : uzWhen(i.close) + ' gacha · ' + uzLeft(i.close - now) + ' qoldi'}</span></button>`;
  }
  function oldList() {
    const now = T.now(), insts = School.instances(S, now).filter(i => ['homework', 'classwork', 'task'].includes(i.type));
    return { undone: insts.filter(i => School.state(S, i, now) === 'old'), done: insts.filter(i => { const st = School.state(S, i, now); return (st === 'donepast' || (st === 'open' && attInfo(i).fin)) && now < i.old; }) };
  }
  function oldPage() {
    const now = T.now(), L = oldList();
    const tile = i => i.type === 'homework' ? hwCard(i, false, now) : i.type === 'classwork' ? cwTile(i, now) : taskTile(i, now);
    return `<div class="row sp" style="margin-bottom:12px"><button class="backbtn" data-act="stback">← Orqaga</button>${pills()}</div>` + top('Eski ishlar', 'Bir hafta ichidagi ishlar. Kech bajarilsa ham baho bir xil.')
      + (L.undone.length ? `<h2 class="sec-title">Tugallanmaganlar</h2><div class="hwlist">${L.undone.map(tile).join('')}</div>` : `<div class="card big-note"><div style="font-size:40px">🎉</div><h2>Tugallanmagan eski ish yo'q</h2></div>`)
      + (L.done.length ? `<h2 class="sec-title">Bajarilganlar · qayta ishlash mumkin</h2><p class="muted" style="margin:-6px 4px 12px">Eng yaxshi natijangiz hisoblanadi.</p><div class="hwlist">${L.done.map(tile).join('')}</div>` : '');
  }

  /* ---------------- So'zlarim ---------------- */
  function weekWordsCard() {
    const W = School.wordWeeks(S).find(w => w.week === T.weekStart()); if (!W) return '';
    const vs = School.vstate(S), cards = W.lessons.flatMap(l => l.cards);
    return `<h2 class="sec-title">Shu haftaning so'zlari</h2><button class="wkcard" data-act="sttab" data-k="words"><div class="row sp"><h3>${cards.length} ta so'z</h3><span class="tag" style="background:#14163D;color:#fff">So'zlarim →</span></div>
      <div class="wkchips">${cards.slice(0, 18).map(c => { const st = Vocab.STAGES[(vs.words[c.id] || {}).stage || 0]; return `<span style="background:${st.c};color:${st.t}">${esc(c.w)}</span>`; }).join('')}${cards.length > 18 ? `<span style="background:#14163D">+${cards.length - 18}</span>` : ''}</div></button>`;
  }
  function wordCard(c, vs) {
    const ws = vs.words[c.id] || {}, st = Vocab.STAGES[ws.stage || 0], ex = (c.sentences && c.sentences[0]) ? c.sentences[0].full : '';
    return `<div class="wordc ${st.t !== '#fff' ? 'dk' : ''}" style="background:${st.c}"><button class="sp" data-act="say" data-t="${esc(c.w)}" aria-label="Talaffuz">🔊</button>
      <span class="stagepill">${esc(st.uz)}</span><b>${esc(c.w)}</b><span class="uz">${esc(c.uz || c.en || '')}</span>${c.en && c.uz ? `<span class="small" style="opacity:.9">${esc(c.en)}</span>` : ''}${ex ? `<span class="ex">“${esc(ex)}”</span>` : ''}
      <button class="ghostbtn" style="justify-self:start" data-act="wordopen" data-w="${esc(c.id)}">Batafsil</button></div>`;
  }
  function words() {
    const WW = School.wordWeeks(S), vs = School.vstate(S), wk = T.weekStart(), day = T.dayNum();
    const thisW = WW.find(w => w.week === wk);
    const wrong = new Set(Object.values(vs.words).filter(w => w.bad > 0).map(w => w.wid));
    const F = { all: () => true, this: (c, w) => w === wk, past: (c, w) => w !== wk, due: c => Vocab.isDue(vs.words[c.id], day), learning: c => { const s = (vs.words[c.id] || {}).stage || 0; return s < 5; }, known: c => (vs.words[c.id] || {}).stage === 5, mistakes: c => wrong.has(c.id) };
    const q = N.key(V.wq), match = c => !q || N.key(c.w).includes(q) || N.key(c.uz || '').includes(q) || N.key(c.en || '').includes(q);
    const lessonLbl = n => n ? `${n}-dars` : "Boshqa so'zlar";
    const head = top("So'zlarim", "Shu hafta o'rganayotgan so'zlaringiz va o'tgan haftalardagi so'zlar. Rang so'zning bosqichini ko'rsatadi.");
    const legend = `<div class="row" style="margin-bottom:12px">${Vocab.STAGES.map(s => `<span class="tag" style="background:${s.c};color:${s.t}">${esc(s.uz)}</span>`).join('')}</div>`;
    const thisHtml = thisW ? thisW.lessons.map(L => `<h3 style="margin:16px 4px 10px">${lessonLbl(L.n)}</h3><div class="wgrid">${L.cards.map(c => wordCard(c, vs)).join('')}</div>`).join('') : '<p class="muted">Bu hafta hali so\'z berilmagan.</p>';
    const filters = `<div class="row" style="margin:20px 0 12px"><div class="chips">${[['all', 'Hammasi'], ['this', 'Shu hafta'], ['past', "O'tgan"], ['due', 'Takrorlash vaqti'], ['learning', "O'rganilmoqda"], ['known', "O'zlashtirilgan"], ['mistakes', 'Xatolarim']].map(([k, n]) => `<button class="chip ${V.wf === k ? 'on' : ''}" data-act="wf" data-k="${k}">${n}</button>`).join('')}</div>
      <input class="input" style="max-width:260px;background:rgba(255,255,255,.9);color:#14163D" placeholder="Qidirish (inglizcha yoki o'zbekcha)" value="${esc(V.wq)}" data-inp="wq"></div>`;
    const past = WW.map(W => { const cs = W.lessons.flatMap(L => L.cards.map(c => Object.assign({}, c, { _n: L.n }))).filter(c => F[V.wf](c, W.week) && match(c)); if (!cs.length) return ''; return `<h3 style="margin:18px 4px 10px">${W.week === wk ? 'Shu hafta' : weekLabelUz(W.week)}</h3><div class="wgrid">${cs.map(c => wordCard(c, vs)).join('')}</div>`; }).join('');
    return head + legend + `<h2 class="sec-title">Shu haftaning so'zlari</h2>` + thisHtml + `<h2 class="sec-title">Barcha so'zlar</h2>` + filters + (past || '<p class="muted">Hech narsa topilmadi.</p>');
  }
  function wordPage(id) {
    const c = School.allCards(S).find(x => x.id === id), vs = School.vstate(S), ws = vs.words[id] || { stage: 0, hist: [] }; if (!c) { V.view = null; return words(); }
    const st = Vocab.STAGES[ws.stage || 0], R = Vocab.retr(ws, T.dayNum());
    const fmtName = f => (Vocab.FMT[f] ? Vocab.FMT[f].uz : f.startsWith('game:') ? "O'yin" : f);
    return `<div class="row sp" style="margin-bottom:12px"><button class="backbtn" data-act="stback">← So'zlarim</button>${pills()}</div>
      <div class="qs ${st.t !== '#fff' ? 'dk' : ''}" style="background:${st.c};min-height:0"><div class="top"><span>${esc(st.uz)}</span><button class="speak" data-act="say" data-t="${esc(c.w)}">🔊 Talaffuz</button></div>
      <div class="qtext">${esc(c.w)}</div><div style="font-size:20px;font-weight:750">${esc(c.uz || '')}</div>${c.en ? `<div>${esc(c.en)}</div>` : ''}
      <div class="ladder">${Vocab.STAGES.map(x => `<i class="${x.n <= (ws.stage || 0) ? 'on' : ''}" style="background:${x.c};color:${x.t}">${esc(x.uz)}</i>`).join('')}</div>
      ${(c.sentences || []).map(s => `<div class="uzline" style="font-weight:600">${esc(s.full)}</div>`).join('')}
      <div class="row">${R != null ? `<span class="badge">Xotira: ${Math.round(R * 100)}%</span>` : ''}${ws.card ? `<span class="badge">Keyingi takrorlash: ${ws.card.due <= T.dayNum() ? 'bugun' : (ws.card.due - T.dayNum()) + ' kundan keyin'}</span>` : ''}<span class="badge">To'g'ri ${ws.ok || 0} · xato ${ws.bad || 0}</span></div></div>
      <h2 class="sec-title">Tarix</h2><div class="card">${(ws.hist || []).slice().reverse().slice(0, 30).map(h => `<div class="row sp" style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,.15)"><span>${esc(fmtName(h.fmt))}${h.rapid ? ' · juda tez' : ''}</span><b>${h.ok ? "To'g'ri" : 'Xato'}</b></div>`).join('') || '<p class="muted">Hali mashq qilinmagan.</p>'}</div>`;
  }

  /* ---------------- Natijalar ---------------- */
  function results() {
    const m = V.rmode, now = T.now(), c = School.cls(S.cls);
    const chips = `<div class="chips" style="margin-bottom:16px">${[['hw', 'Uy vazifasi'], ['cw', 'Sinf ishi'], ['ex', 'Haftalik test'], ['test', "O'qituvchi testlari"]].map(([k, n]) => `<button class="chip ${m === k ? 'on' : ''}" data-act="rmode" data-k="${k}">${n}</button>`).join('')}</div>`;
    const head = top('Natijalarim', 'Qayta ishlagan ishlaringizda eng yaxshi natija hisoblanadi');
    if (m === 'cw' && c.taught === S.group) return head + chips + `<div class="card big-note"><div style="font-size:40px">👩‍🏫</div><h2>Sinf ishi yo'q</h2><p>O'qituvchi sizning guruhingiz bilan bevosita dars o'tadi.</p></div>`;
    const type = { hw: 'homework', cw: 'classwork', ex: 'weekly', test: 'test' }[m];
    const all = School.instances(S, now).filter(i => i.type === type).map(i => ({ i, r: School.result(S, i, now) })).filter(x => x.r.pct != null && (x.r.done || x.r.missed));
    const wk = all.filter(x => (x.i.w.week || T.weekStart(x.i.open)) === T.weekStart(now));
    const big = m === 'ex' || m === 'test' ? (all.length ? all[all.length - 1].r.pct : null) : (wk.length ? Math.ceil(sum(wk.map(x => x.r.pct)) / wk.length) : null);
    const hero = `<div class="card row" style="gap:24px">${big == null ? '<p class="muted">Hali natija yo\'q.</p>' : `${Run.ring(big, 'xl')}<div><span class="muted">${m === 'ex' ? 'Oxirgi haftalik test' : m === 'test' ? 'Oxirgi test' : "Shu haftaning o'rtachasi"}</span><h2 style="font-size:34px;margin:4px 0">${School.markOf(big)} baho</h2></div>`}</div>`;
    const grid = (m === 'hw' || m === 'cw') && wk.length ? `<h2 class="sec-title">Shu hafta · darslar bo'yicha</h2><div class="stus">${wk.map(x => `<div class="stu">${Run.ring(x.r.pct)}<b>${x.i.L.n}-dars</b><span class="small">${UZD[x.i.L.day]}</span><span class="mark" style="background:rgba(255,255,255,.2)">${School.markOf(x.r.pct)} baho</span></div>`).join('')}</div>` : '';
    const d = all.slice(-18).map(x => ({ v: x.r.pct, l: x.i.L ? `${x.i.L.n}-dars` : (x.i.P.meta.title || '').slice(0, 10) }));
    return head + chips + hero + grid + `<h2 class="sec-title">Oxirgi ${d.length} ta natija</h2><div class="card">${chart(d, true)}</div>`;
  }
  function chart(d, light) {
    if (!d.length) return '<p class="muted">Hali natija yo\'q.</p>';
    const W = 700, H = 250, pl = 34, pr = 12, pt = 22, pb = 40, x = i => pl + (d.length < 2 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (d.length - 1)), y = v => pt + (100 - v) * (H - pt - pb) / 100;
    const col = light ? 'rgba(255,255,255,.8)' : 'var(--muted)', mc = p => ['', '#FF6B57', '#FF8A1E', '#F5B700', '#2E46E8', '#138A3D'][School.markOf(p)];
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Natijalar grafigi">${[85, 75, 55, 30].map(v => `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="${col}" stroke-opacity=".35" stroke-dasharray="4 6"/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="${col}">${v}</text>`).join('')}
      <polyline fill="none" stroke="${light ? 'var(--ac)' : 'var(--pc)'}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" points="${d.map((p, i) => x(i) + ',' + y(p.v)).join(' ')}"/>
      ${d.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="6.5" fill="${mc(p.v)}" stroke="#fff" stroke-width="2.5"><title>${esc(p.l)}: ${p.v}%</title></circle><text x="${x(i)}" y="${y(p.v) - 13}" text-anchor="middle" font-size="11" font-weight="800" fill="${light ? '#fff' : 'currentColor'}">${p.v}</text>`).join('')}
      ${d.map((p, i) => i % 2 === 0 || d.length < 9 ? `<text x="${x(i)}" y="${H - 18}" text-anchor="middle" font-size="10" fill="${col}">${esc(p.l)}</text>` : '').join('')}</svg>`;
  }

  /* ---------------- Erkin mashq ---------------- */
  function practice() {
    const items = School.practiceItems(S), wc = School.wrongCounts(S.id), weak = items.filter(x => wc[x.ref] > 0).length;
    if (V.pr) return practiceRun();
    return top('Erkin mashq', 'Uy vazifasi va sinf ishidagi savollar aralash') + `<div class="qs dk" style="background:#B8F53B;min-height:0;color:#14163D"><h2 style="font-size:28px">O'z tezligingizda mashq qiling</h2>
      <p style="margin:0;line-height:1.6">Savollar uy vazifalari va sinf ishlaridan aralash chiqadi. Xato qilgan savollaringiz ko'proq qaytadi, toki to'g'ri topmaguningizcha. So'zlaringiz ham shu yerda takrorlanadi.</p>
      <div class="row"><span class="badge">${items.length} ta savol</span><span class="badge">${weak} tasida oldin xato qilgansiz</span><span class="badge">To'g'ri +1 achko · +1 oltin</span></div>
      <div><button class="wbtn" style="background:#14163D;color:#fff" data-act="prstart" ${items.length || School.allCards(S).length ? '' : 'disabled'}>Boshlash</button></div></div>`;
  }
  function prNext() {
    const items = School.practiceItems(S), wc = School.wrongCounts(S.id), n = (V.pr.n || 0);
    const metWords = Object.values(School.vstate(S).words).filter(w => w.met).length;
    // every 3rd question is a word from the vocab engine when the student has words
    if (metWords >= 4 && (n % 3 === 2 || !items.length)) { if (!V.pr.ses || V.pr.ses.done) V.pr.ses = new Vocab.Session({ sid: S.id, kind: 'smart', cards: [], allCards: School.allCards(S), max: 10 }); const it = V.pr.ses.next(); if (it && it.fmt !== 'meet') return { voc: it }; }
    if (!items.length) return null;
    const w = items.map(x => 1 + 3 * (wc[x.ref] || 0)), tot = sum(w); let r = Math.random() * tot, pick = items[0];
    for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) { pick = items[i]; break; } }
    return { ex: pick, fix: (wc[pick.ref] || 0) > 0, v: {} };
  }
  function practiceRun() {
    const P = V.pr; if (!P.cur) P.cur = prNext();
    if (!P.cur) return top('Erkin mashq', '') + '<p>Hali savol yo\'q.</p><button class="btn" data-act="prstop">Orqaga</button>';
    const c = P.cur, head = `<div class="row sp" style="margin-bottom:12px"><button class="backbtn" data-act="prstop">← Chiqish</button>${pills()}</div>`;
    if (c.voc) return head + Stu.vocCard(c.voc, P.fb, (P.n || 0) + 1);
    const { it, ex } = c.ex; const f = P.fb, green = f && f.ok;
    let body = '';
    if (it.type === 'choice') body = `<div class="qtext mid">${Run.inl(it.stem)}</div><div class="opts2">${it.opts.map((o, j) => `<button class="opt2 ${f && o.ok === 2 ? 'sel' : ''} ${f && (c.v.c || [])[0] === j && o.ok !== 2 ? 'miss' : ''}" data-act="prpick" data-j="${j}" ${f ? 'disabled' : ''}>${Run.inl(o.t)}</button>`).join('')}</div>`;
    else { let g = 0; body = `<div class="qtext mid" style="line-height:1.8">${it.segs.map(s => s.gap ? (() => { const k = g++; const parts = N.hyphenParts(s.gap[0]); return f ? `<span class="gapbox filled">${esc(s.gap[0])}</span>` : parts ? `<span class="hy">${parts.map((p, i) => `${i ? '<span class="hyd">-</span>' : ''}<input class="gap" data-prg="${k}" data-seg="${i}" style="width:${p.length + 2}ch" autocomplete="off" autocapitalize="off" spellcheck="false">`).join('')}</span>` : ex.choose ? `<select class="gap" data-prg="${k}"><option value="">—</option>${ex.choose.map(o => `<option>${esc(o)}</option>`).join('')}</select>` : `<input class="gap" data-prg="${k}" style="width:${Math.max(5, s.gap[0].length + 2)}ch" autocomplete="off" autocapitalize="off" spellcheck="false">`; })() : Run.inl(s.t)).join('')}</div>`; }
    const passage = ex.texts.length && ex.texts[0].body.length < 900 ? `<details class="see"><summary>Matnni ko'rish</summary><div class="passage">${Run.rich(ex.texts[0].body)}</div></details>` : '';
    return head + `<div class="qs" style="background:${green ? '#138A3D' : '#5B2BD9'}"><div class="top"><span>${esc(c.ex.inst.P.meta.title || '')}</span>${c.fix ? '<span class="badge">Oldin xato qilgansiz · yana urinib ko\'ring</span>' : ''}</div><div class="ask">${esc(ex.instr || '')}</div>${passage}${body}
      ${f ? `<div class="bottomrow"><span class="badge ${f.ok ? '' : 'nq'}">${f.ok ? "To'g'ri! +1 achko" : 'Unchalik emas · to\'g\'ri javob ko\'rsatildi'}</span><button class="wbtn" data-act="prnext">Davom etish</button></div>`
        : `<div class="bottomrow"><button class="ghostbtn" data-act="pridk">Bilmayman</button>${it.type === 'gap' ? '<button class="wbtn" data-act="prcheck">Tekshirish</button>' : ''}</div>`}</div>`;
  }
  function prAnswer(resp) {
    const P = V.pr, c = P.cur; if (!c || P.fb) return;
    if (c.voc) return;
    const { it, ex } = c.ex; let ok;
    if (resp.idk) ok = false; else if (it.type === 'choice') { c.v.c = [resp.j]; ok = Code.gradeItem(it, [resp.j], Object.assign({}, ex, { answer: 'one' })).ok; }
    else { const r = Code.gradeItem(it, resp.vals, ex); ok = r.ok === true; }
    Store.ev(S.id, 'prac', { ref: c.ex.ref, ok, idk: !!resp.idk, fix: c.fix, ach: true });
    if (ok) { School.addGold(S.id, 1, 'practice'); Snd.ok(); if (c.fix) Doni.show('proud', 'Eski xatoni tuzatdingiz!', 'Bu savol endi kamroq qaytadi'); } else Snd.no();
    P.fb = { ok }; P.n = (P.n || 0) + 1;
  }
  /* the vocab card for practice (same look as homework) */
  function vocCard(it, f, n) {
    const st = Vocab.STAGES[it.stage] || Vocab.STAGES[1], green = f && f.ok && !f.rapid, bg = green ? '#138A3D' : st.c, dk = !green && st.t !== '#fff';
    const ask = { mc_meaning: "Bu so'zning ma'nosi qaysi?", mc_word: "Qaysi so'z shu ma'noni beradi?", mc_ctx: "Gapga mos so'zni tanlang", type_def: "So'zni inglizcha yozing", type_ctx: "Bo'sh joyga so'zni yozing" }[it.fmt];
    const q = it.fmt === 'mc_meaning' ? `<div class="qtext">${esc(it.prompt)}</div>` : `<div class="qtext mid">${esc(f && it.filled ? it.filled : it.text || it.prompt)}</div>`;
    let ctl = it.options ? `<div class="opts2">${it.options.map((o, i) => `<button class="opt2 ${f && i === it.answer ? 'sel' : ''} ${f && i === f.choice && !f.ok ? 'miss' : ''}" data-act="pvpick" data-i="${i}" ${f ? 'disabled' : ''}>${esc(o.text)}</button>`).join('')}</div>`
      : f ? `<div class="fb"><span class="lab">To'g'ri javob</span><b>${esc(f.correct)}</b></div>` : vtype(it.answers[0], it.given);
    ctl += f ? `<div class="bottomrow"><span class="badge ${f.ok ? '' : 'nq'}">${f.rapid ? 'Juda tez · hisoblanmadi' : f.ok ? "To'g'ri! +1 achko" : f.almost ? 'Deyarli! Imloga qarang' : 'Unchalik emas'}</span><button class="wbtn" data-act="prnext">Davom etish</button></div>`
      : `<div class="bottomrow"><button class="ghostbtn" data-act="pvidk">Bilmayman</button>${it.options ? '' : '<button class="wbtn" data-act="pvtype">Tekshirish</button>'}</div>`;
    return `<div class="qs ${dk ? 'dk' : ''}" style="background:${bg}"><div class="top"><span>So'zlarim · ${esc(st.uz)}</span><span class="ghostbtn" style="cursor:default">${n}-savol</span></div><div><div class="ask">${ask}</div>${q}</div>${ctl}</div>`;
  }
  function vtype(answer, given) { const parts = N.hyphenParts(answer); if (parts) return `<div class="hyrow">${parts.map((p, i) => `${i ? '<span class="hyd">-</span>' : ''}<input class="tin" data-vt="${i}" style="max-width:${p.length + 3}ch" autocomplete="off" autocapitalize="off" spellcheck="false">`).join('')}</div>`; return `<input class="tin" data-vt="0" placeholder="${esc((given || '') + '…')}" autocomplete="off" autocapitalize="off" spellcheck="false">`; }

  /* ---------------- O'yinlar ---------------- */
  function games() {
    const list = Play.list(S);
    return top("So'z o'yinlari", "O'yinni siz tanlaysiz, so'zlarni tizim tanlaydi. To'g'ri javob +1 achko, xato −1.")
      + `<div class="tiles small">${list.map(g => { const TC = { 1: ['#5CE1F0', '#14163D'], 2: ['#FFD23F', '#14163D'], 3: ['#B8F53B', '#14163D'], 4: ['#FF9F1C', '#2B1700'] }[g.tier]; const [c, t] = g.open ? TC : ['rgba(0,0,0,.25)', '#fff'];
        return `<button class="tile" style="background:${c};color:${t}" data-act="${g.open ? 'game' : 'toast'}" data-k="${g.key}" data-rare="${g.rare ? 1 : ''}" data-t="${esc(g.why)}"><span class="t-kind">${g.rare ? '✨ Noyob raund · 1 marta' : g.open ? (g.play === 'solo' ? 'Yakka' : g.play === 'class' ? 'Butun sinf' : "Kompyuter raqiblar bilan") : '🔒 Yopiq'}</span><div><h3>${esc(g.title)}</h3><div class="t-list">${esc(g.uz)}</div></div><span class="t-time">${g.open ? 'Ochiq · ' + g.tier + '-daraja' : esc(g.short)}</span></button>`; }).join('')}</div>
      <p class="small" style="margin-top:14px;opacity:.85">Oltin: har o'yindan 25 tagacha, kuniga 150 tagacha. Bugun: ${School.goldToday(S.id, 'game')} / 150.</p>`;
  }
  /* ---------------- Qal'a ---------------- */
  function castle() {
    const c = School.castle(S.id);
    return top("Qal'a", "Oltin faqat o'qish orqali keladi") + `<div class="card" style="background:#140D33;text-align:center;padding:28px">${Play.castleSvg(c.b.castle)}
      <div class="row" style="justify-content:center;margin:12px 0"><span class="pill" style="background:#F5B700;color:#2B1700">${c.gold} oltin</span><span class="pill" style="background:#B99BFF;color:#140D33">${c.cr} kristall</span><span class="pill">Qal'a ${c.b.castle}-daraja</span></div>
      <p style="opacity:.88;max-width:520px;margin:0 auto 16px;line-height:1.6">Oltin: uy vazifasi va sinf ishida har to'g'ri javob +5, tugatish +120, so'z o'yinlari, Erkin mashq (+1) va kuboklarni sotish.</p>
      <button class="btn" data-act="castle">Qal'aga kirish</button></div>`;
  }
  /* ---------------- Reyting ---------------- */
  function leader() {
    const wk = T.weekStart(), next = T.addWeeks(wk, 1);
    const rows = Store.db.students.filter(x => x.cls === S.cls && (V.lb === 'class' || x.group === S.group)).map(x => ({ s: x, v: School.weekAchko(x.id, wk) })).sort((a, b) => b.v - a.v);
    const max = Math.max(1, ...rows.map(r => r.v));
    return top('Haftalik reyting', `Dushanba 00:00 da yangidan boshlanadi · ${uzLeft(next - T.now())} qoldi`)
      + `<div class="chips" style="margin-bottom:14px"><button class="chip ${V.lb === 'class' ? 'on' : ''}" data-act="lb" data-k="class">${esc(School.cls(S.cls).name)}</button><button class="chip ${V.lb === 'group' ? 'on' : ''}" data-act="lb" data-k="group">${esc(S.group)} guruhim</button></div>
      <div class="card">${rows.map((r, i) => `<div class="lbrow ${r.s.id === S.id ? 'me' : ''}"><span class="rank r${i < 3 ? i + 1 : ''}">${i + 1}</span><b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.s.name)}${r.s.id === S.id ? ' (siz)' : ''}</b><span class="tag">${esc(r.s.group)}</span><span class="lbbar"><i style="width:${Math.max(0, r.v) / max * 100}%"></i></span><b class="lbv">${r.v}</b></div>`).join('')}</div>
      <p class="small" style="margin-top:12px;opacity:.85">Achko: uy vazifasi, sinf ishi, so'z o'yinlari, Erkin mashq va topshiriqlarda har to'g'ri javob +1, xato −1, "Bilmayman" ham −1. Qayta ishlaganda ham achko beriladi. Testlar achko bermaydi.</p>`;
  }
  /* ---------------- Kuboklar ---------------- */
  const trophySVG = (c, s = 46) => `<svg width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true"><path d="M14 6h20v11a10 10 0 0 1-20 0z" fill="${c}"/><path d="M14 10H8a6 6 0 0 0 7 8M34 10h6a6 6 0 0 1-7 8" fill="none" stroke="${c}" stroke-width="3.2"/><rect x="21" y="26" width="6" height="7" fill="${c}"/><rect x="14" y="33" width="20" height="7" rx="2.5" fill="${c}"/></svg>`;
  function trophies() {
    const all = School.trophies(S), shelf = all.filter(t => !t.sold), st = School.stats(S), TS = School.TSIZE;
    const next = School.TFAM.map(f => { const v = st[f.stat] || 0; if (f.every) return { f, v, goal: (Math.floor(v / f.every) + 1) * f.every, size: f.size }; const t = f.tiers.find(([th]) => v < th); return t ? { f, v, goal: t[0], size: t[1] } : null; }).filter(Boolean);
    return top('Kuboklar', "Har bir kubok sizning shaxsiy yutug'ingiz, boshqalar bilan solishtirilmaydi")
      + `<div class="row" style="margin-bottom:6px">${Object.values(TS).map(z => `<span class="tag" style="background:${z.c};color:#2B1700">${z.uz} · ${z.p} oltin</span>`).join('')}</div>
      <h2 class="sec-title">Javonim (${shelf.length})</h2><div class="stus">${shelf.map(t => `<div class="stu">${trophySVG(TS[t.size].c)}<b class="small">${esc(t.name)}</b><span class="small">${TS[t.size].uz}</span><button class="btn sm" data-act="sell" data-id="${t.id}">Sotish · ${TS[t.size].p} oltin</button></div>`).join('') || '<p class="muted">Javon bo\'sh.</p>'}</div>
      <h2 class="sec-title">Keyingi kuboklar</h2><div class="card">${next.map(n => `<div class="row" style="padding:8px 0;border-top:1px solid rgba(255,255,255,.14);flex-wrap:nowrap">${trophySVG(TS[n.size].c, 30)}<div style="flex:1;min-width:0"><div class="row sp"><b>${esc(n.f.n)}</b><span class="small">${n.v} / ${n.goal}</span></div><div class="small" style="opacity:.85">${esc(n.f.d)}</div><div class="lbbar" style="margin-top:6px"><i style="width:${Math.min(100, n.v / n.goal * 100)}%"></i></div></div></div>`).join('')}</div>`;
  }
  /* ---------------- Profil ---------------- */
  function profile() {
    const all = School.trophies(S), st = School.stats(S), fbs = Store.db.writings.filter(w => w.sid === S.id && w.fb);
    return top(esc(S.name), `${esc(School.cls(S.cls).name)} · ${esc(S.group)} guruh`)
      + `<div class="stus"><div class="stu"><span class="small">Achko · bu hafta</span><b style="font:800 28px var(--fd)">${School.weekAchko(S.id, T.weekStart())}</b></div><div class="stu"><span class="small">Achko · jami</span><b style="font:800 28px var(--fd)">${School.achko(S.id)}</b></div><div class="stu"><span class="small">Jami kuboklar</span><b style="font:800 28px var(--fd)">${all.length}</b></div><div class="stu"><span class="small">To'g'ri javoblar</span><b style="font:800 28px var(--fd)">${st.correct}</b></div></div>
      <h2 class="sec-title">Kuboklar turi bo'yicha</h2><div class="card"><div class="row">${Object.entries(School.TSIZE).map(([k, z]) => `<span class="tag" style="background:${z.c};color:#2B1700">${z.uz}: ${all.filter(t => t.size === k).length}</span>`).join('')}</div><p class="small" style="margin:8px 0 0;opacity:.85">Sotilgan kuboklar ham hisoblanadi.</p></div>
      <h2 class="sec-title">O'qituvchi fikrlari</h2>${fbs.length ? fbs.slice().reverse().map(w => `<div class="card" style="margin-bottom:10px"><div class="row sp"><b>${esc(w.task.type === 'task' ? 'Topshiriq: ' + w.task.title : (w.task.lesson ? w.task.lesson + '-dars · ' : '') + w.task.kind)}</b><span class="tag" style="background:#138A3D;color:#fff">${w.fb.score}/10</span></div>
        <p style="margin:8px 0"><b>Yaxshi:</b> ${esc(w.fb.good)}</p>${w.fb.fix.map(f => `<div class="small"><s style="opacity:.75">${esc(f[0])}</s> → <b>${esc(f[1])}</b></div>`).join('')}<p style="margin:8px 0 0"><b>Keyingi safar:</b> ${esc(w.fb.next)}</p></div>`).join('') : '<p class="muted">Hali fikr yo\'q.</p>'}
      <p class="small" style="margin-top:14px;opacity:.85">🔒 Login va parolni faqat o'qituvchi o'zgartira oladi.</p>
      <div class="row" style="margin-top:12px"><button class="btn ghost" data-act="snd">${Snd.on() ? '🔊 Ovoz yoniq' : '🔇 Ovoz o\'chiq'}</button><button class="btn ghost" data-act="donitgl">Doni: ${Doni.enabled() ? 'yoniq' : "o'chiq"}</button>${App.ctx.mode === 'student' ? '<button class="btn" data-act="logout">Chiqish</button>' : ''}</div>`;
  }
  const ICON = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 8h6M8 12h6"/></svg>',
    results: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 9 9h-9z" fill="currentColor"/></svg>',
    practice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4v6h6M20 20v-6h-6"/><path d="M5 15a8 8 0 0 0 14 2M19 9A8 8 0 0 0 5 7"/></svg>',
    games: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="16" cy="11.5" r="1" fill="currentColor"/><circle cx="18" cy="14" r="1" fill="currentColor"/></svg>',
    castle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 21V9h3V6h3v3h2V5h2v4h2V6h3v3h3v12z"/><path d="M10 21v-5h4v5"/></svg>',
    leader: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 21h18M5 21v-7h4v7M10 21V9h4v12M15 21v-11h4v11"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 20h8"/></svg>',
    profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  };
  return { V, page, pills, me, prAnswer, practiceRun, vocCard, chart, ICON, trophySVG, OPEN_IN_LESSON, lessonNow };
})();
