/* =====================================================================
   APP: login, who is looking (teacher, student, view-as, preview),
   one render function, every click and keystroke, the clock.
   ===================================================================== */
const App = (() => {
  const ctx = { mode: 'login', tid: null, sid: null, as: null, role: 'student', err: '' };
  const SESS = 'ingliz-sess';
  const saveSess = () => { try { localStorage.setItem(SESS, JSON.stringify({ mode: ctx.mode, tid: ctx.tid, sid: ctx.sid })); } catch (e) {} };
  const teacher = () => Store.db.teachers.find(t => t.id === (ctx.as && ctx.as.type === 'teacher' ? ctx.as.tid : ctx.tid));
  const student = () => ctx.mode === 'student' ? School.stu(ctx.sid) : ctx.as && ctx.as.type === 'student' ? School.stu(ctx.as.sid) : null;

  function theme(pc, pt, ac, act) { const r = document.documentElement.style; r.setProperty('--pc', pc); r.setProperty('--pt', pt); r.setProperty('--ac', ac); r.setProperty('--act', act); }
  function modal(html) { $('#modal').innerHTML = `<div class="modal" data-act="mbg"><div class="mbox" role="dialog" aria-modal="true">${html}</div></div>`; const f = $('#modal input, #modal textarea'); if (f) setTimeout(() => f.focus(), 30); }
  const mclose = () => { $('#modal').innerHTML = ''; };

  /* ---------------- render ---------------- */
  let lastSig = '';
  function render() {
    const keep = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.inp; const caret = keep ? document.activeElement.selectionStart : null;
    const main = $('#main'), side = $('#side');
    banner();
    if (ctx.mode === 'login') { document.body.className = 'login'; side.hidden = true; main.innerHTML = login(); return; }
    side.hidden = false;
    const s = student();
    try { main.innerHTML = s ? Stu.page(s) : Tea.page(teacher()); }
    catch (e) { console.error(e); main.innerHTML = `<div class="card"><h2>Something went wrong</h2><p class="muted">${esc(e.message)}</p><button class="btn" data-act="home">Back</button></div>`; }
    if (keep) { const el = $(`[data-inp="${keep}"]`); if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch (e) {} } }
    lastSig = sig();
  }
  function banner() {
    const b = $('#banner'); let h = '';
    if (ctx.as && ctx.as.type === 'student') { const s = School.stu(ctx.as.sid); h = `<div class="banner s">${ctx.as.preview ? `👀 Preview of “${esc(ctx.as.preview)}” as a ${esc(s ? s.group : '')} student` : `👀 Viewing as ${esc(s ? s.name : '')}`} · test mode: nothing is saved<button data-act="asback">Back to teacher panel</button></div>`; }
    else if (ctx.as && ctx.as.type === 'teacher') { const t = teacher(); h = `<div class="banner t">You are in ${esc(t.name)}'s account · changes are real<button data-act="asback">Back to admin</button></div>`; }
    if (T.offset && ctx.mode !== 'login') h += `<div class="banner c">⏱ Test clock: the site thinks it is ${enWhen(T.now())}${ctx.mode === 'teacher' ? '<button data-act="clkreset">Real time</button>' : ''}</div>`;
    b.innerHTML = h;
  }
  let lastLogin = '';
  function login() {
    return `<div class="login-wrap"><div class="login-art"><span class="blob" style="width:340px;height:340px;background:#FFD23F;opacity:.25;right:-90px;top:-80px"></span><span class="blob" style="width:220px;height:220px;background:#FF8A1E;opacity:.35;left:-60px;bottom:40px"></span>
      <div class="logo">A</div><h1>Ingliz tili</h1><p>Uy vazifalari, sinf ishi, so'zlar, o'yinlar va qal'a — hammasi bir joyda.</p></div>
      <div class="login-card"><h2>Kirish</h2>
      <label>Login<input class="input" id="lg-login" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(lastLogin)}" required></label>
      <label>Parol<input class="input" id="lg-pass" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" required></label>
      <label class="small" style="display:flex;gap:8px;align-items:center;font-weight:600;cursor:pointer"><input type="checkbox" id="lg-show" style="width:18px;height:18px;margin:0"> Parolni ko'rsatish</label>
      <div class="lgerr" role="alert">${esc(ctx.err)}</div><button class="btn lgbtn" type="button" data-act="login">Kirish</button>
      <p class="small" style="margin:0;opacity:.8">O'quvchilar ham, o'qituvchilar ham shu yerdan kiradi. Login va parolni o'qituvchingiz beradi.</p>
      </div></div>`;
  }
  /* login with the school's real accounts (checked on the server), then load the database */
  let logging = false;
  async function doLogin() {
    if (logging) return;
    const l = ($('#lg-login').value || '').trim().toLowerCase(), p = $('#lg-pass').value || '';
    lastLogin = l;
    if (!l || !p) { ctx.err = "Login va parolni yozing."; render(); return focusLogin(); }
    logging = true; const btn = $('.lgbtn'); if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
      const r = await Net.login(l, p);
      if (r.error) { ctx.err = r.error === 'LOCKED' ? "Ko'p marta xato kiritildi. 2 daqiqadan keyin urinib ko'ring." : "Login yoki parol noto'g'ri. Kichik harflar bilan, bo'sh joysiz yozing. Esingizda bo'lmasa, o'qituvchingizdan so'rang."; logging = false; render(); return focusLogin(); }
    } catch (e) { ctx.err = "Internet bilan muammo. Internetni tekshirib, qayta urinib ko'ring."; logging = false; return render(); }
    logging = false;
    load();   // the password was right: from here on, trouble is the internet or the server, never the account
  }
  /* load the data after login or on opening the page; shows progress, and a retry button instead of logging out */
  function loading(n) { $('#main').innerHTML = `<div class="card" style="max-width:420px;margin:40px auto;text-align:center"><p class="muted" style="margin:0">Yuklanmoqda…${n ? ' ' + n.toLocaleString('ru-RU') + ' ta javob' : ''}</p></div>`; }
  async function load() {
    loading(0);
    try {
      const me = await Net.boot(n => loading(n));
      if (me) return enter(me);
      ctx.err = "Kirish muddati tugagan. Qaytadan kiring."; return render();
    } catch (e) {
      $('#main').innerHTML = `<div class="card" style="max-width:440px;margin:40px auto;text-align:center;display:flex;flex-direction:column;gap:12px"><h2 style="margin:0">Yuklab bo'lmadi</h2>
        <p class="muted" style="margin:0">${e.net ? "Internet bilan muammo. Internetni tekshiring." : "Server hozir band. Bir oz kutib, qayta urinib ko'ring."} Hisobingiz joyida, qaytadan kirish shart emas.</p>
        <button class="btn" data-act="retryboot">Qayta urinish</button><button class="btn ghost" data-act="logout">Boshqa hisob bilan kirish</button></div>`;
    }
  }
  // after an error the login stays filled in and the cursor goes to the password
  function focusLogin() { const pw = $('#lg-pass'), lg = $('#lg-login'); if (lg && lg.value && pw) pw.focus(); else if (lg) lg.focus(); }
  function enter(me) {
    if (me.role === 'teacher') { Object.assign(ctx, { mode: 'teacher', tid: me.id, sid: null, err: '' }); Tea.V.tab = 'results'; }
    else { Object.assign(ctx, { mode: 'student', sid: me.id, tid: null, err: '' }); Stu.V.tab = 'home'; }
    T.offset = 0; saveSess(); render();
  }
  function toLogin() { Run.close(); Store.leaveSandbox(); Object.assign(ctx, { mode: 'login', tid: null, sid: null, as: null }); saveSess(); render(); }
  function logout() { Net.flush(); Net.logout(); ctx.err = ''; toLogin(); }
  function viewAs(sid, preview) { Run.close(); Store.enterSandbox(); ctx.as = { type: 'student', sid, preview }; Stu.V.tab = 'home'; Stu.V.view = null; Stu.V.pr = null; window.scrollTo(0, 0); render(); }
  function back() { Run.close(); Play.closeOv(); $('#doni').innerHTML = ''; const wasStu = ctx.as && ctx.as.type === 'student'; if (wasStu) Store.leaveSandbox(); ctx.as = null; render(); }

  /* the student the current page acts for (real login or view-as) */
  const S = () => student();

  /* ---------------- clicks ---------------- */
  const H = {};
  // shared
  H.mbg = (d, el, e) => { if (e.target === el) mclose(); };
  H.mclose = mclose; H.home = () => { Run.close(); render(); };
  H.logout = logout; H.retryboot = () => load(); H.login = () => doLogin(); H.asback = back; 
  H.toast = d => toast(d.t); H.say = d => Speech.say(d.t);
  H.snd = () => { Snd.toggle(); render(); }; H.donitgl = () => { try { localStorage.setItem('doni', Doni.enabled() ? '0' : '1'); } catch (e) {} render(); };
  H.ovclose = () => Play.closeOv();
  H.clkreset = () => { T.offset = 0; Store.db.settings.clock = 0; Store.save(); render(); };
  // student navigation
  H.sttab = d => { const L = Stu.lessonNow(); if (L && !Stu.OPEN_IN_LESSON.includes(d.k)) return toast("Dars vaqtida faqat Asosiy, So'zlarim, O'yinlar, Qal'a, Reyting va Profil ochiq"); Run.close(); Stu.V.tab = d.k; Stu.V.view = null; Stu.V.pr = null; window.scrollTo(0, 0); render(); };
  H.stold = () => { Stu.V.view = 'old'; render(); }; H.stback = () => { Stu.V.view = null; render(); };
  H.wf = d => { Stu.V.wf = d.k; render(); }; H.wordopen = d => { Stu.V.view = { word: d.w }; window.scrollTo(0, 0); render(); };
  H.rmode = d => { if (ctx.mode === 'student' || ctx.as && ctx.as.type === 'student') Stu.V.rmode = d.k; else { Tea.V.r.mode = d.k; Tea.V.r.lessons = null; } render(); };
  H.lb = d => { Stu.V.lb = d.k; render(); };
  H.sell = d => { const s = S(), t = School.trophies(s).find(x => x.id === d.id); if (!t || t.sold) return; const p = School.TSIZE[t.size].p; Store.ev(s.id, 'sell', { tid: t.id, price: p }); School.addGold(s.id, p, 'sell'); Snd.win(); toast(`Kubok sotildi: +${p} oltin`); render(); };
  H.game = d => Play.launch(S(), d.k, { rare: !!d.rare });
  H.castle = () => Play.openCastle(S());
  // student: opening works
  H.openwork = d => {
    const s = S(), inst = School.instances(s).find(i => i.id === d.id); if (!inst) return;
    const st = School.state(s, inst), now = T.now(), L = Stu.lessonNow();
    if (st === 'locked' || now < inst.open) return toast(inst.type === 'homework' ? `Bugungi oxirgi darsdan keyin ochiladi (${T.hm(inst.open)})` : `${uzWhen(inst.open)} da ochiladi`);
    const live = inst.type === 'classwork' && now >= inst.open && now < inst.close;
    if (L && !live && inst.type !== 'test' && inst.type !== 'weekly') return toast('Dars vaqtida faqat shu darsning sinf ishi ochiq');
    if (st === 'gone') return toast("Bu ish endi yopilgan");
    if (Run.open(s, inst, { live })) { window.scrollTo(0, 0); render(); }
  };
  H.starttest = d => {
    const s = S(), inst = School.instances(s).find(i => i.id === d.id); if (!inst) return;
    if (School.attempts(s.id, inst.id).length) { if (Run.open(s, inst, {})) render(); return; }
    const q = sum(School.workSections(inst.P).map(x => sum(x.s.ex.map(Code.points))));
    modal(`<button class="x" data-act="mclose">×</button><h2>${esc(inst.P.meta.title || 'Test')}</h2><p style="font-size:16px;line-height:1.6">${q} ta savol · ⏱ ${inst.timer} daqiqa.<br>Boshlaganingizdan keyin vaqt to'xtamaydi, sahifani yopsangiz ham. Vaqt tugasa, test o'zi yakunlanadi.${inst.type === 'weekly' ? '<br><b>Haftalik test faqat bir marta topshiriladi.</b>' : '<br>Test yopilguncha qayta ishlash mumkin, eng yaxshi natija hisoblanadi.'}</p><div class="row"><button class="btn" data-act="testgo" data-id="${inst.id}">Boshlash</button><button class="btn ghost" data-act="mclose">Keyinroq</button></div>`);
  };
  H.testgo = d => { mclose(); const s = S(), inst = School.instances(s).find(i => i.id === d.id); if (inst && Run.open(s, inst, {})) { window.scrollTo(0, 0); render(); } };
  // runner: exercises
  const R = () => Run.R;
  H.runclose = () => { Run.close(); render(); };
  H.part = d => { R().view = 'part'; R().part = +d.si; R().eng = null; window.scrollTo(0, 0); render(); };
  H.towallet = () => { R().view = 'wallet'; R().part = null; R().eng = null; render(); };
  H.cwsec = d => { const r = R(); if (r.lessonLive && T.now() < r.inst.close) return toast("Har bir bo'lim o'z vaqtida ochiladi"); r.part = +d.si; r.eng = null; render(); };
  H.cwnext = () => { R().part = null; R().eng = null; window.scrollTo(0, 0); render(); };
  H.cwgame = () => Play.classGame(S());
  H.cwduel = () => Play.classGame(S(), 'duel');
  H.redowork = () => { const r = R(); if (Run.open(r.s, r.inst, { redo: true })) { toast("Qayta ishlash: eng yaxshi natija hisoblanadi"); render(); } };
  H.help = d => modal(`<button class="x" data-act="mclose">×</button><h2>Qanday bajariladi?</h2><p style="font-size:16px;line-height:1.6">${esc(d.t)}</p>`);
  H.exhelp = d => { const ex = Run.exOf(d.k); modal(`<button class="x" data-act="mclose">×</button><h2>Qanday bajariladi?</h2><p style="font-size:16px;line-height:1.6">${esc(ex.help || Code.autoHelp(ex))}</p>${(ex.from || []).map(f => `<p class="note">${esc(Code.FROM[f].uz)}</p>`).join('')}${ex.items.some(it => it.type === 'gap' && it.segs.some(s => s.gap && N.hyphenParts(s.gap[0]))) ? "<p class=\"small\">Chiziqchali so'zlarda (masalan brother-in-law) chiziqcha o'zi qo'yilgan: faqat harflarni yozing.</p>" : ''}`); };
  H.opt = d => { const ex = Run.exOf(d.k), it = ex.items[+d.i], a = Run.A(d.k), j = +d.j, key = 'c' + d.i; if (a.checked) return; const cur = a.v[key] || []; a.v[key] = Code.isMulti(it, ex) || ex.answer === 'free many' ? (cur.includes(j) ? cur.filter(x => x !== j) : [...cur, j]) : [j]; Snd.tap(); render(); };
  H.sort = d => { const a = Run.A(d.k); if (a.checked) return; a.v['s' + d.w] = d.c; render(); };
  H.chip = d => { const a = Run.A(d.k); if (a.checked) return; const ex = Run.exOf(d.k); let id = lastGap && lastGap.k === d.k ? lastGap.id : null;
    if (!id || a.v[id]) { id = null; ex.items.forEach((it, i) => { if (id || it.type !== 'gap' || it.example) return; it.segs.filter(s => s.gap).forEach((_, g) => { if (!id && !a.v[`g${i}_${g}`]) id = `g${i}_${g}`; }); }); }
    if (!id) return toast("Hamma bo'sh joylar to'ldirilgan"); a.v[id] = d.w; lastGap = null; render(); };
  H.check = d => { Run.exCheck(d.k); render(); };
  H.redo = d => { const a = Run.A(d.k); Object.assign(a, { v: {}, checked: false, res: null, done: false, score: null }); render(); };
  H.send = d => { const ex = Run.exOf(d.k), a = Run.A(d.k); if (!Run.canSend(ex, a)) return toast("So'z chegarasiga qarang"); Run.sendWriting(d.k); Snd.ok(); toast("O'qituvchiga yuborildi"); render(); };
  H.save = d => { const a = Run.A(d.k), r = R(); Store.ev(r.s.id, 'ans', { work: r.inst.id, att: r.att, key: d.k, right: 0, wrong: 0, total: 0, graded: false, inputs: Object.assign({}, a.v), detail: [], ach: false }); a.done = true; render(); };
  H.read = H.save;
  H.partdone = d => { const r = R(); Run.completePart(+d.si); r.eng = null; if (r.inst.type !== 'classwork') { r.view = 'wallet'; r.part = null; } else if (!(r.lessonLive && T.now() < r.inst.close)) r.part = null; window.scrollTo(0, 0); render(); };
  H.report = d => modal(`<button class="x" data-act="mclose">×</button><h2>Xato bormi?</h2><p>Javobingiz to'g'ri, lekin xato deb belgilangan deb o'ylasangiz, o'qituvchiga yozing. O'qituvchi tekshiradi.</p><textarea class="input" rows="3" id="rep-note" placeholder="Masalan: 2-gapda men 'shouldn't' yozdim, bu ham to'g'ri"></textarea><div class="row" style="margin-top:12px"><button class="btn" data-act="sendreport" data-k="${d.k}">Yuborish</button></div>`);
  H.sendreport = d => { const r = R(); Store.db.reports.push({ id: uid('r'), sid: r.s.id, work: r.inst.id, att: r.att, key: d.k, note: ($('#rep-note').value || '').trim(), ts: T.now(), status: 'new' }); Store.save(); mclose(); toast("Yuborildi. O'qituvchi ko'rib chiqadi"); };
  H.testend = () => modal(`<button class="x" data-act="mclose">×</button><h2>Testni yakunlaysizmi?</h2><p>Javob berilmagan savollar xato hisoblanadi.${R().inst.type === 'weekly' ? ' Haftalik testni qayta topshirib bo\'lmaydi.' : ''}</p><div class="row"><button class="btn" data-act="testfin">Ha, yakunlash</button><button class="btn ghost" data-act="mclose">Davom etish</button></div>`);
  H.testfin = () => { mclose(); Run.finishTest(false); Snd.win(); window.scrollTo(0, 0); render(); };
  // runner: vocab engine
  H.vnext = () => { const E = R().eng; if (!E) return render(); if (E.fb) { E.fb = null; E.item = null; } else if (E.item && E.item.fmt === 'meet') Run.vAnswer({}); render(); };
  H.vpick = d => { Run.vAnswer({ choice: +d.i }); render(); };
  H.vidk = () => { Run.vAnswer({ idk: true }); render(); };
  H.vtype = () => { const t = Run.readType(); if (!t.replace(/-/g, '').trim()) return toast('Javobni yozing'); Run.vAnswer({ text: t }); render(); };
  // runner: grammar engine
  const gcur = () => R() && R().eng && R().eng.cur;
  H.gnext = () => { R().eng.cur = null; render(); };
  H.gidk = () => { Run.gSubmit({}, true); render(); };
  H.gcheck = () => { const c = gcur(); if (!c) return; Run.gSubmit(GUI.response(c.q, c)); render(); };
  ['gopt', 'gtok', 'gml', 'gmr', 'gslot', 'gchip', 'gtin', 'gtout', 'grw', 'grwtap', 'gfixtap', 'gbin', 'gpair', 'gchain'].forEach(k => H[k] = d => { const c = gcur(); if (!c || c.fb) return; Snd.tap(); if (GUI.act(c.q, c, d) === 'submit') Run.gSubmit(GUI.response(c.q, c)); render(); });
  // Erkin mashq
  H.prstart = () => { Stu.V.pr = { n: 0 }; render(); }; H.prstop = () => { Stu.V.pr = null; render(); };
  H.prpick = d => { Stu.prAnswer({ j: +d.j }); render(); };
  H.pridk = () => { Stu.prAnswer({ idk: true }); render(); };
  H.prcheck = () => { const vals = []; $$('[data-prg]').forEach(el => { const k = +el.dataset.prg; vals[k] = el.dataset.seg != null ? (vals[k] ? vals[k] + '-' : '') + el.value.trim() : el.value; }); if (!vals.some(v => v && v.replace(/-/g, '').trim())) return toast('Javobni yozing'); Stu.prAnswer({ vals }); render(); };
  H.prnext = () => { const P = Stu.V.pr; P.cur = null; P.fb = null; render(); };
  const pvSubmit = resp => { const P = Stu.V.pr, it = P.cur && P.cur.voc; if (!it || P.fb) return; const s = S(); const r = P.ses.submit(it, resp, { ach: true, prac: true }); if (!r) return; P.fb = Object.assign(r, { choice: resp.choice });
    Store.ev(s.id, 'prac', { ref: 'voc|' + it.wid, ok: r.ok && !r.rapid, ach: false, voc: true }); P.n = (P.n || 0) + 1; if (r.ok && !r.rapid) { School.addGold(s.id, 1, 'practice'); Snd.ok(); } else Snd.no(); render(); };
  H.pvpick = d => pvSubmit({ choice: +d.i }); H.pvidk = () => pvSubmit({ idk: true });
  H.pvtype = () => { const ins = $$('[data-vt]'); const t = ins.map(x => x.value.trim()).join(ins.length > 1 ? '-' : ''); if (!t.replace(/-/g, '').trim()) return toast('Javobni yozing'); pvSubmit({ text: t }); };

  /* ---------------- teacher clicks ---------------- */
  const TV = () => Tea.V, db = () => Store.db;
  const save = () => { Store.save(); };
  H.ttab = d => { TV().tab = d.k; window.scrollTo(0, 0); render(); };
  H.rcls = d => { TV().r.cls = d.id; TV().r.lessons = null; render(); };
  H.rweek = d => { TV().r.week = T.addWeeks(TV().r.week, +d.d); TV().r.lessons = null; render(); };
  H.rles = d => { const L = TV().r.lessons, n = +d.n; TV().r.lessons = L.includes(n) ? (L.length > 1 ? L.filter(x => x !== n) : L) : [...L, n].sort((a, b) => a - b); render(); };
  H.rday = d => { const c = db().classes.find(x => x.id === TV().r.cls); TV().r.lessons = School.lessonsOf(c).filter(L => L.day === d.d).map(L => L.n); render(); };
  H.graph = d => Tea.graphModal(d.id, d.m);
  H.det = d => { Tea.V.detAtt = null; Tea.detModal(d.id, d.w); };
  H.detatt = d => { Tea.V.detAtt = +d.a; Tea.detModal(d.id, d.w); };
  H.ovr = d => { const e = db().events.find(x => x.id === d.e); if (!e) return; const v = d.v === '1';
    if (d.i != null && d.i !== '') { const o = db().overrides[e.id] || (db().overrides[e.id] = { items: {} }); o.items = o.items || {}; o.items[d.i] = v; } else db().overrides[e.id] = { ok: v };
    save(); toast('Marking changed · results recomputed'); const m = $('#modal .mbox'); const sc = m ? m.scrollTop : 0; Tea.detModal(e.sid, e.work); const m2 = $('#modal .mbox'); if (m2) m2.scrollTop = sc; render(); };
  H.viewas = d => { mclose(); viewAs(d.id); };
  // assign
  H.aread = () => { const src = TV().a.src; const parts = Code.splitWorks(src); if (!parts.length) return toast('Paste a code first'); TV().a.parsed = parts.map(Code.parse); TV().a.groups = []; render(); };
  H.aexample = () => { TV().a.src = Tea.EXAMPLE; TV().a.parsed = null; render(); };
  H.aiprompt = () => copy(Tea.AI_PROMPT(), 'AI instructions');
  H.agrp = d => { const G = TV().a.groups[+d.k] || (TV().a.groups[+d.k] = []); const i = G.indexOf(d.g); if (i >= 0) G.splice(i, 1); else G.push(d.g); render(); };
  H.aweek = d => { TV().a.week = T.addWeeks(TV().a.week, +d.d); render(); };
  H.asend = d => { Tea.send(+d.k); render(); };
  H.aedit = d => { const w = School.work(d.id); TV().a.src = w.code; TV().a.parsed = [Code.parse(w.code)]; TV().a.groups = [w.groups.slice()]; if (w.week) TV().a.week = w.week; window.scrollTo(0, 0); render(); };
  H.adel = d => { const w = School.work(d.id); const n = db().events.filter(e => e.work === w.id).length; modal(`<button class="x" data-act="mclose">×</button><h2>Remove “${esc(School.parsed(w).meta.title)}”?</h2><p>Students will no longer see it.${n ? ` ${n} saved answers stay in the history but this work leaves the results.` : ''}</p><div class="row"><button class="btn" data-act="adel2" data-id="${w.id}">Remove</button><button class="btn ghost" data-act="mclose">Cancel</button></div>`); };
  H.adel2 = d => { const w = School.work(d.id); w.groups = []; w.removed = T.now(); save(); mclose(); render(); };
  H.apreview = d => { const P = TV().a.parsed[+d.k], src = Code.splitWorks(TV().a.src)[+d.k]; const g = (TV().a.groups[+d.k] || [])[0] || (P.meta.level || 'A2').toUpperCase();
    const c = Tea.myClasses()[0]; Run.close(); Store.enterSandbox();
    const sid = 'preview'; Store.db.students.push({ id: sid, name: 'Preview student', login: '', pass: '', cls: c.id, group: g });
    const w = { id: 'wpreview', type: P.type, code: src, groups: [g], sentAt: T.now() - 60e3, by: 'preview' }; const ls = School.lessonsOf(c); if (P.meta.lesson) w.lesson = Math.min(+P.meta.lesson, ls.length || 1);
    w.week = T.weekStart(); Store.db.works.push(w); Store._cache = {};
    ctx.as = { type: 'student', sid, preview: P.meta.title || P.type }; Stu.V.tab = 'home';
    const inst = School.instances(School.stu(sid)).find(i => i.id === 'wpreview') || { w, P: School.parsed(w), type: w.type, id: w.id, L: ls[(w.lesson || 1) - 1] || { n: 1, day: 'Mon', di: 0, start: '08:30', end: '09:15' } };
    inst.open = T.now() - 60e3; inst.close = T.now() + 7 * T.DAY; inst.late = inst.close + 3 * T.DAY; inst.old = inst.close + 7 * T.DAY; if (!inst.timer && (P.meta.time || P.meta.open)) inst.timer = +(P.meta.time || P.meta.open);
    Run.open(School.stu(sid), inst, { live: false }); window.scrollTo(0, 0); render(); };
  // plans
  H.pcls = d => { TV().p.cls = d.id; TV().p.edit = false; render(); }; H.pweek = d => { TV().p.week = T.addWeeks(TV().p.week, +d.d); TV().p.edit = false; render(); };
  H.pn = d => { TV().p.n = +d.n; TV().p.edit = false; render(); }; H.pedit = () => { TV().p.edit = true; TV().p.pasting = false; render(); };
  H.ppaste = () => { TV().p.pasting = true; TV().p.edit = false; TV().p.paste = TV().p.paste || ''; render(); }; H.pcancel = () => { TV().p.edit = false; TV().p.pasting = false; render(); };
  const pkey = n => `${TV().p.cls}|${TV().p.week}|${n}`;
  H.psave = () => { const words = [], bad = []; ($('#pl-words').value || '').split('\n').map(x => x.trim()).filter(Boolean).forEach(l => { const w = l.split(/\s+=\s+/); if (w.length === 2) words.push([w[0].trim(), N.uzFix(w[1].trim())]); else bad.push(l); });
    if (bad.length) return toast('Write words as: word = translation (' + bad[0].slice(0, 30) + ')'); const title = $('#pl-title').value.trim(); if (!title) return toast('A plan needs a title');
    db().plans[pkey(TV().p.n)] = { title, goal: $('#pl-goal').value.trim(), steps: $('#pl-steps').value.split('\n').map(x => x.trim()).filter(Boolean), words }; save(); TV().p.edit = false; toast('Plan saved'); render(); };
  H.pdel = () => { delete db().plans[pkey(TV().p.n)]; save(); TV().p.edit = false; render(); };
  H['psave-paste'] = () => { const c = db().classes.find(x => x.id === TV().p.cls); const res = Code.parsePlans(TV().p.paste, School.lessonsOf(c).length); if (res.errors.length) return; res.plans.forEach(p => db().plans[pkey(p.n)] = { title: p.title, goal: p.goal, steps: p.steps, words: p.words }); save(); TV().p.pasting = false; TV().p.paste = ''; TV().p.n = res.plans[0].n; toast(`${res.plans.length} plan(s) saved`); render(); };
  // writing
  H.wstat = d => { TV().w.status = d.k; render(); }; H.wcls = d => { TV().w.cls = d.id; render(); };
  H.wcopy = () => copy(Tea.aiCopyText(), 'Writings for the AI');
  H.wpaste = () => modal(`<button class="x" data-act="mclose">×</button><h2>Paste AI feedback</h2><p class="small muted">Matched by the W-number. Format: ### W-101 · SCORE: 7/10 · GOOD: … · FIX: wrong -> right · NEXT: … · WORDS: …</p><textarea class="input code" rows="14" id="fb-src"></textarea><div id="fb-res"></div><div class="row" style="margin-top:12px"><button class="btn" data-act="wapply">Apply feedback</button></div>`);
  H.wapply = () => { const { out, errs } = Tea.parseFb($('#fb-src').value); if (errs.length || !out.length) { $('#fb-res').innerHTML = (errs.length ? errs : ['Nothing found. Each feedback starts with ### W-number']).map(e => `<div class="err"><b>error</b>${esc(e)}</div>`).join(''); return; }
    out.forEach(f => { const w = db().writings.find(x => x.id === f.id); Tea.applyFb(w, { score: f.score, good: f.good, fix: f.fix, next: f.next, words: f.words }); }); save(); mclose(); toast(`Feedback added to ${out.length} writing${out.length > 1 ? 's' : ''}`); render(); };
  H.wcheck = d => Tea.wCheckModal(d.id);
  H.wsave = d => { const w = db().writings.find(x => x.id === d.id); const fix = $('#wf-fix').value.split('\n').map(l => l.split(/\s*(?:->|→)\s*/)).filter(x => x.length === 2 && x[0].trim()).map(x => [x[0].trim(), x[1].trim()]);
    Tea.applyFb(w, { score: +$('#wf-score').value, good: N.uzFix($('#wf-good').value.trim()), fix, next: N.uzFix($('#wf-next').value.trim()), words: $('#wf-words').value.split(',').map(x => x.trim()).filter(Boolean) }); save(); mclose(); toast('Saved'); render(); };
  // reports
  H.repst = d => { TV().rep = d.k; render(); };
  H.racc = d => { Tea.accept(db().reports.find(r => r.id === d.r), d.i, false); render(); };
  H.raccall = d => { Tea.accept(db().reports.find(r => r.id === d.r), d.i, true); render(); };
  H.rclose = d => { db().reports.find(r => r.id === d.r).status = 'done'; save(); render(); };
  // leaderboard
  H.lbcls = d => { TV().lb.cls = d.id; TV().lb.group = ''; render(); }; H.lbgrp = d => { TV().lb.group = d.g; render(); }; H.lbweek = d => { TV().lb.week = T.addWeeks(TV().lb.week, +d.d); render(); };
  // settings
  H.sttab2 = d => { TV().st.tab = d.k; render(); }; H.scls = d => { TV().st.cls = d.id; render(); }; H.sscls = d => { TV().st.scls = d.id; render(); };
  const curCls = () => db().classes.find(c => c.id === TV().st.cls);
  H.cadd = () => { const id = 'c' + Date.now().toString(36); db().classes.push({ id, name: 'New class', teacher: Tea.me().id, taught: '', sched: { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] } }); TV().st.cls = id; save(); render(); };
  H.cdel = () => { const c = curCls(); db().classes = db().classes.filter(x => x !== c); TV().st.cls = null; save(); render(); };
  H.ladd = d => { const c = curCls(); const L = c.sched[d.d] || (c.sched[d.d] = []); const last = L[L.length - 1]; const st = last ? T.mins(last[1]) + 10 : 8 * 60 + 30; const f = x => String(Math.floor(x / 60) % 24).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); L.push([f(st), f(st + 45)]); save(); render(); };
  H.ldel = d => { curCls().sched[d.d].splice(+d.i, 1); save(); render(); };
  H.sadd = () => { const name = $('#ns-name').value.trim(), login = $('#ns-login').value.trim(), pass = $('#ns-pass').value.trim(); if (!name || !login || !pass) return toast('Name, login and password are needed'); if (db().students.some(s => s.login.toLowerCase() === login.toLowerCase())) return toast('This login is already used');
    db().students.push({ id: 's' + Date.now().toString(36), name, login, pass, cls: $('#ns-cls').value, group: $('#ns-grp').value }); save(); toast('Student added'); render(); };
  H.sdel = d => { const s = School.stu(d.id); modal(`<button class="x" data-act="mclose">×</button><h2>Remove ${esc(s.name)}?</h2><p>The student can no longer log in. Their answers stay in the backup.</p><div class="row"><button class="btn" data-act="sdel2" data-id="${s.id}">Remove</button><button class="btn ghost" data-act="mclose">Cancel</button></div>`); };
  H.sdel2 = d => { db().students = db().students.filter(s => s.id !== d.id); save(); mclose(); render(); };
  H.sbulk = () => { const out = [], errs = []; const used = new Set(db().students.map(s => s.login.toLowerCase())); const classes = Tea.myClasses();
    $('#bulk').value.split('\n').map(x => x.trim()).filter(Boolean).forEach((l, i) => { const f = l.split(',').map(x => x.trim()); if (f.length < 3) return errs.push(`Line ${i + 1}: write Name, login, password`);
      const [name, login, pass, cn, g] = f; if (used.has(login.toLowerCase())) return errs.push(`Line ${i + 1}: login “${login}” is already used`);
      let cls = $('#bulk-cls').value; if (cn) { const c = classes.find(c => c.name.toLowerCase() === cn.toLowerCase()); if (!c) return errs.push(`Line ${i + 1}: no class “${cn}”`); cls = c.id; }
      let group = $('#bulk-grp').value; if (g) { if (!db().groups.includes(g.toUpperCase())) return errs.push(`Line ${i + 1}: no group “${g}”`); group = g.toUpperCase(); }
      used.add(login.toLowerCase()); out.push({ id: 's' + Date.now().toString(36) + i, name, login, pass, cls, group }); });
    if (errs.length) { $('#bulk-res').innerHTML = errs.map(e => `<div class="err"><b>error</b>${esc(e)}</div>`).join('') + '<p class="small">Nothing was added. Fix the lines and try again.</p>'; return; }
    db().students.push(...out); save(); toast(`${out.length} students added`); render(); };
  H.tadd = () => { const name = $('#nt-name').value.trim(), login = $('#nt-login').value.trim(), pass = $('#nt-pass').value.trim(); if (!name || !login || !pass) return toast('Name, login and password are needed'); if (db().teachers.some(t => t.login.toLowerCase() === login.toLowerCase())) return toast('This login is already used'); db().teachers.push({ id: 't' + Date.now().toString(36), name, login, pass, admin: false }); save(); render(); };
  H.tdel = d => { if (db().classes.some(c => c.teacher === d.id)) return toast('Give this teacher’s classes to someone else first'); db().teachers = db().teachers.filter(t => t.id !== d.id); save(); render(); };
  H.topen = d => { ctx.as = { type: 'teacher', tid: d.id }; Tea.V.tab = 'results'; Tea.V.r.cls = null; render(); };
  H.gadd = () => { const g = $('#ng').value.trim().toUpperCase(); if (!g || db().groups.includes(g)) return; db().groups.push(g); save(); render(); };
  H.gdel = d => { db().groups = db().groups.filter(g => g !== d.g); save(); render(); };
  H.clkset = () => { const v = $('#clk').value; if (!v) return; const t = new Date(v).getTime(); if (isNaN(t)) return; T.offset = t - Date.now(); db().settings.clock = T.offset; save(); render(); };
  H.clkadd = d => { T.offset += +d.ms; db().settings.clock = T.offset; save(); render(); };
  H.dexp = () => { const blob = new Blob([JSON.stringify({ db: db(), castles: Store.castles })], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `english-site-backup-${T.iso()}.json`; document.body.appendChild(a); a.click(); a.remove(); };

  function copy(text, what) {
    const done = () => toast(`${what} copied`);
    const show = () => modal(`<button class="x" data-act="mclose">×</button><h2>${esc(what)}</h2><p class="small muted">Copy this text (select all, then copy).</p><textarea class="input code" rows="16" id="copybox" readonly>${esc(text)}</textarea>`);
    try { navigator.clipboard.writeText(text).then(done, () => { show(); setTimeout(() => { const b = $('#copybox'); if (b) b.select(); }, 50); }); } catch (e) { show(); }
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
    const f = H[el.dataset.act]; if (!f) return;
    if (el.tagName === 'A') e.preventDefault();
    try { f(el.dataset, el, e); } catch (err) { console.error(err); toast('Error: ' + err.message); }
  });
  document.addEventListener('submit', e => { if (e.target.dataset.form === 'login') { e.preventDefault(); doLogin(); } });

  /* ---------------- typing ---------------- */
  let lastGap = null;
  document.addEventListener('focusin', e => { const el = e.target; if (el.matches && el.matches('input.gap[data-k]')) lastGap = { k: el.dataset.k, id: el.dataset.id }; });
  function onInput(e) {
    const el = e.target, d = el.dataset;
    if (d.inp === 'asrc') { Tea.V.a.src = el.value; return; }
    if (d.inp === 'ppaste') { Tea.V.p.paste = el.value; if (e.type === 'change' || /\n$/.test(el.value) || el.value.length % 40 === 0) render(); return; }
    if (d.inp === 'wq') { Stu.V.wq = el.value; render(); return; }
    if (d.gtext != null) { const c = gcur(); if (c) c.resp.text = el.value; return; }
    if (d.gdlg != null) { const c = gcur(); if (c) { c.resp.values = c.resp.values || []; c.resp.values[+d.gdlg] = el.value; } return; }
    if (d.k && d.id && Run.R) {
      const a = Run.A(d.k);
      if (d.seg != null) {
        // hyphen rule: typing "-" moves to the next part
        const nx = $(`[data-k="${d.k}"][data-id="${d.id}"][data-seg="${+d.seg + 1}"]`);
        if (nx && el.value.includes('-') && e.type === 'input') { const [p0, ...rest] = el.value.split('-'); el.value = p0; nx.value = rest.join('-') + nx.value; nx.focus(); }
        const parts = $$(`[data-k="${d.k}"][data-id="${d.id}"]`).map(x => x.value.trim()); a.v[d.id] = parts.some(Boolean) ? parts.join('-') : '';
      } else a.v[d.id] = el.value;
      if (d.id === 'w' || d.id.startsWith('o')) { const ex = Run.exOf(d.k); const wc = $(`[data-wc="${d.k}"]`); if (wc && ex.write) wc.textContent = Run.wcMsg(wcount(a.v.w), ex.write); const b = $(`[data-act="send"][data-k="${d.k}"]`); if (b) b.disabled = !Run.canSend(ex, a); }
      return;
    }
    if (d.vt != null && e.type === 'input' && el.value.includes('-')) { const ins = $$('[data-vt]'); if (ins.length > 1) { const i = +d.vt; const [p0, ...rest] = el.value.split('-'); el.value = p0; if (ins[i + 1]) { ins[i + 1].value = rest.join('-') + ins[i + 1].value; ins[i + 1].focus(); } } }
  }
  document.addEventListener('input', onInput);
  document.addEventListener('change', e => {
    if (e.target.id === 'lg-show') { const pw = $('#lg-pass'); if (pw) pw.type = e.target.checked ? 'text' : 'password'; return; }
    const el = e.target, d = el.dataset;
    if (d.actChg === 'gsel') { const c = gcur(); if (c) { c.resp.values = c.resp.values || []; c.resp.values[+d.g] = el.value; } return; }
    if (d.chg) return teacherChange(el, d);
    if (d.k && d.id && el.tagName === 'SELECT') return onInput(e);
    if (d.inp === 'ppaste') return onInput(e);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#modal').innerHTML) { mclose(); return; }
    if (e.key !== 'Enter' || e.shiftKey) return; const el = e.target; if (!el.matches || !el.matches('input')) return;
    if (el.id === 'lg-login') { e.preventDefault(); $('#lg-pass').focus(); return; }
    if (el.id === 'lg-pass') { e.preventDefault(); doLogin(); return; }
    if (el.dataset.vt != null) { e.preventDefault(); const q = Stu.V.pr && Stu.V.pr.cur && Stu.V.pr.cur.voc && !Run.R ? 'pvtype' : 'vtype'; H[q](); }
    else if (el.dataset.gtext != null || el.dataset.gdlg != null) { e.preventDefault(); H.gcheck(); }
    else if (el.dataset.prg != null) { e.preventDefault(); H.prcheck(); }
  });
  function teacherChange(el, d) {
    const v = el.value, c = () => db().classes.find(x => x.id === Tea.V.st.cls), s = () => School.stu(d.id), t = () => db().teachers.find(x => x.id === d.id), me = Tea.me();
    const uniq = (list, val, self) => !list.some(x => x !== self && x.login.toLowerCase() === val.trim().toLowerCase());
    switch (d.chg) {
      case 'rwork': Tea.V.r[Tea.V.r.mode === 'test' ? 'test' : 'task'] = v; break;
      case 'cname': c().name = v.trim() || c().name; break;
      case 'ctaught': c().taught = v; break;
      case 'cteacher': c().teacher = v; break;
      case 'ltime': { const L = c().sched[d.d][+d.i]; L[+d.w] = v; if (T.mins(L[1]) <= T.mins(L[0])) toast('The end must be after the start'); c().sched[d.d].sort((a, b) => a[0].localeCompare(b[0])); break; }
      case 'sname': s().name = v.trim() || s().name; break;
      case 'scls': s().cls = v; break; case 'sgrp': s().group = v; break;
      case 'slogin': if (!v.trim() || !uniq(db().students, v, s())) { toast('This login is already used'); break; } s().login = v.trim(); break;
      case 'spass': if (v) s().pass = v; break;
      case 'tname': t().name = v.trim() || t().name; break;
      case 'tlogin': if (!v.trim() || !uniq(db().teachers, v, t())) { toast('This login is already used'); break; } t().login = v.trim(); break;
      case 'tpass': if (v) t().pass = v; break;
      case 'mename': me.name = v.trim() || me.name; break;
      case 'melogin': if (!v.trim() || !uniq(db().teachers, v, me)) { toast('This login is already used'); break; } me.login = v.trim(); break;
      case 'mepass': if (v) me.pass = v; break;
    }
    save(); Store._cache = {}; render();
  }

  /* ---------------- the clock: timers, lesson start/end, section changes ---------------- */
  function sig() {
    if (ctx.mode === 'login') return 'login';
    const s = student(); let x = '';
    if (s) { const L = Stu.lessonNow(); x += L ? 'L' + L.L.n + L.week : '-'; if (Run.R && Run.R.view === 'cw' && Run.R.lessonLive) x += ':' + Run.cwActive() + (T.now() < Run.R.inst.close); if (Run.R && Run.R.endsAt && !Run.R.finished) x += ':' + (T.now() >= Run.R.endsAt); }
    return x;
  }
  let tickN = 0;
  setInterval(() => {
    tickN++;
    if (ctx.mode === 'login') return;
    const now = T.now(), r = Run.R;
    $$('[data-clk]').forEach(el => { const k = el.dataset.clk; let ms = 0;
      if (k === 'test' && r && r.endsAt) ms = r.endsAt - now;
      if (k === 'cw' && r) { const a = Run.cwActive(); ms = a != null ? Run.cwSecEnd(a) - now : r.inst.close - now; }
      if (k === 'cwend' && r) ms = r.inst.close - now;
      el.textContent = mmss(ms / 1000); if (k === 'test' && ms < 60e3) el.style.color = '#B3261E'; });
    const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (sig() !== lastSig) { if (r && r.endsAt && now >= r.endsAt && !r.finished) { Run.render(); } render(); return; }
    // a quiet refresh once a minute for times on the student main page
    if (tickN % 60 === 0 && !typing && !$('#modal').innerHTML && $('#ov').hidden) { const s = student(); if (s && !Run.R && Stu.V.tab === 'home') render(); }
  }, 1000);

  /* ---------------- start ---------------- */
  /* a quiet reload of the database every 2 minutes (new homework appears without a page reload) and when the tab comes back */
  function idle() { const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName); return ctx.mode !== 'login' && !ctx.as && !Run.R && !typing && !$('#modal').innerHTML && $('#ov').hidden; }
  async function reload(force) { if (!idle()) return; if (await Net.refresh(force) && idle()) render(); }
  setInterval(() => reload(false), 120e3);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reload(true); });

  async function start() {
    T.offset = 0;
    if (!Net.hasToken()) return render();
    load();
  }
  return { ctx, render, theme, modal, start, toLogin, me: S };
})();
App.start();
