/* Abduqodir Teacher — website logic (stage 1). Plain JS, no libraries. */
(function () {
  "use strict";

  const SB_URL = "https://meiokexdxhyjcyfpvjvx.supabase.co";
  const SB_KEY = "sb_publishable_YXhY13kbBK3sv89Y9c1uwg_83HfRqME";

  /* ---------- small helpers ---------- */
  const $ = (s) => document.querySelector(s);
  const app = $("#app");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  const pad = (n) => String(n).padStart(2, "0");
  const fmtDate = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${d.getDate()}-${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const toLocalInput = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtTime = (sec) => { const m = Math.round((sec || 0) / 60); const h = Math.floor(m / 60); return h ? `${h} soat ${m % 60} daq` : `${m} daq`; };
  const dayFromStr = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const strFromDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; };
  const weekLabel = (s) => { const a = dayFromStr(s); const b = new Date(a); b.setDate(b.getDate() + 6); return `${a.getDate()}-${MONTHS[a.getMonth()]} – ${b.getDate()}-${MONTHS[b.getMonth()]}`; };
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const barCls = (p) => (p >= 80 ? "" : p >= 50 ? "mid" : "low");

  function toast(t) {
    const el = $("#toast"); el.textContent = t; el.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (el.hidden = true), 2800);
  }

  const I = {
    teacher: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 20h10M12 16v4M7 9h6M7 12h4"/></svg>',
    student: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="#FFC53D" stroke="#D99A0B" stroke-width="1.5" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/></svg>',
  };

  /* ---------- server calls ---------- */
  let S = null; // session {token, role, first_name, last_name}
  try { S = JSON.parse(store.get("at_session") || "null"); } catch (e) { S = null; }

  async function rpc(fn, args) {
    let r;
    try {
      r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: { apikey: SB_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(args || {}),
      });
    } catch (e) {
      const err = new Error("NET"); err.net = true; throw err;
    }
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    if (!r.ok) { const err = new Error((data && data.message) || "HTTP " + r.status); err.status = r.status; throw err; }
    return data;
  }
  async function api(fn, args) {
    try {
      return await rpc(fn, Object.assign({ p_token: S && S.token }, args || {}));
    } catch (e) {
      if (e.message === "AUTH") { signOut("Iltimos, qaytadan kiring."); throw e; }
      throw e;
    }
  }
  function errText(e) {
    if (e && e.net) return "Internet bilan muammo. Qayta urinib ko'ring.";
    const m = (e && e.message) || "";
    if (/duplicate key|unique/i.test(m)) return "Bu nom allaqachon bor.";
    if (/violates check|check constraint/i.test(m)) return "Ma'lumot noto'g'ri kiritildi.";
    return m || "Xatolik yuz berdi.";
  }

  function signOut(msg) {
    if (S && S.token) rpc("logout", { p_token: S.token }).catch(() => {});
    S = null; store.del("at_session");
    V = { screen: "pick", msg: msg || "" };
    render();
  }

  /* ---------- view state ---------- */
  let V = { screen: S ? (S.role === "teacher" ? "teacher" : "student") : "pick" };

  function render() {
    let h = "";
    try {
      if (V.screen === "pick") h = vPick();
      else if (V.screen === "login") h = vLogin();
      else if (V.screen === "student") h = vStudent();
      else if (V.screen === "teacher") h = vTeacher();
      else if (V.screen === "play") h = vPlay();
    } catch (e) { console.error(e); h = `<div class="card"><p class="err">Sahifada xatolik: ${esc(e.message)}</p></div>`; }
    app.innerHTML = h;
    afterRender();
  }

  function afterRender() {
    const f = $("#loginForm");
    if (f) f.onsubmit = (e) => { e.preventDefault(); doLogin(); };
    const inp = $("#answerInput");
    if (inp && !P.result) {
      inp.value = P.typed || "";
      inp.oninput = () => (P.typed = inp.value);
      inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); P.typed = inp.value; check(); } };
      if (!("ontouchstart" in window)) inp.focus();
    }
    const ta = $("#pasteBox");
    if (ta) ta.oninput = () => { T.paste = ta.value; T.parsed = null; const s = $("#pasteSummary"); if (s) s.innerHTML = ""; };
    const bulk = $("#bulkBox");
    if (bulk) bulk.oninput = () => (T.bulk = bulk.value);
  }

  /* ---------- login ---------- */
  function vPick() {
    return `<div class="hero"><div class="logo"><span class="logo-mark">A</span>Abduqodir Teacher</div>
      <h1>Kim sifatida kirasiz?</h1>
      ${V.msg ? `<p class="err">${esc(V.msg)}</p>` : `<p class="muted">Rolni tanlang, keyin login va parolingizni kiriting.</p>`}</div>
      <div class="roles">
        <button class="role t" data-act="role" data-v="teacher"><span class="ico">${I.teacher}</span><h2>O'qituvchi</h2><p class="muted">Natijalar, sinflar, pullar va vazifalar.</p></button>
        <button class="role s" data-act="role" data-v="student"><span class="ico">${I.student}</span><h2>O'quvchi</h2><p class="muted">Vazifalar va reyting.</p></button>
      </div>`;
  }
  function vLogin() {
    const t = V.role === "teacher";
    return `<div class="hero"><div class="logo"><span class="logo-mark">A</span>Abduqodir Teacher</div><h1>${t ? "O'qituvchi kirishi" : "O'quvchi kirishi"}</h1></div>
      <form class="card form" id="loginForm" novalidate>
        <div><label for="lg">Login</label><input id="lg" autocomplete="username" autocapitalize="off" spellcheck="false" required></div>
        <div><label for="pw">Parol</label><input id="pw" type="password" autocomplete="current-password" required></div>
        ${V.err ? `<p class="err" role="alert">${esc(V.err)}</p>` : ""}
        <button class="btn wide" type="submit" ${V.busy ? "disabled" : ""}>${V.busy ? "Kirilmoqda…" : "Kirish"}</button>
        <button class="btn ghost sm" type="button" data-act="back">Orqaga</button>
      </form>`;
  }
  async function doLogin() {
    const lg = $("#lg").value.trim(), pw = $("#pw").value;
    if (!lg || !pw) { V.err = "Login va parolni kiriting."; render(); return; }
    V.busy = true; V.err = ""; render();
    try {
      const r = await rpc("login", { p_login: lg, p_password: pw });
      V.busy = false;
      if (r.error === "LOCKED") { V.err = "Ko'p marta xato kiritildi. 2 daqiqadan keyin urinib ko'ring."; render(); return; }
      if (r.error) { V.err = "Login yoki parol noto'g'ri."; render(); return; }
      S = r; store.set("at_session", JSON.stringify(r));
      V = { screen: r.role === "teacher" ? "teacher" : "student" };
      render(); boot();
    } catch (e) { V.busy = false; V.err = errText(e); render(); }
  }

  /* ---------- student ---------- */
  const ST = { tab: "home", home: null, board: null, loading: false };

  async function loadStudent() {
    ST.loading = true; render();
    try { ST.home = await api("student_home"); } catch (e) { if (e.message !== "AUTH") toast(errText(e)); }
    ST.loading = false; render();
  }
  async function loadBoard() {
    try { ST.board = await api("class_board"); } catch (e) { if (e.message !== "AUTH") toast(errText(e)); }
    render();
  }

  function circleStates(q) {
    const final = new Set((q.state && q.state.final) || []);
    const gc = q.gc || {};
    return (q.circles || []).map((c, i) => {
      const ids = Object.keys(gc).filter((id) => gc[id] === i);
      return { name: c.name, done: q.completed_at ? true : ids.length > 0 && ids.every((id) => final.has(id)) };
    });
  }
  function circlesHTML(list, nowIdx) {
    return `<div class="circles">${list.map((c, i) => {
      const cls = c.done ? "done" : i === nowIdx ? "now" : "";
      return `<div class="circ ${cls}"><b>${c.done ? I.check : i + 1}</b><span>${esc(c.name)}</span></div>`;
    }).join("")}</div>`;
  }

  function sHeader() {
    const me = ST.home && ST.home.me;
    const wk = (ST.home && ST.home.week) || {};
    return `<div class="top"><div class="logo"><span class="logo-mark">A</span><span>Salom, ${esc(me ? me.first_name : S.first_name)}!</span></div>
      <div class="stats">
        <span class="stat" title="Bu haftadagi to'g'ri javoblar">${I.star}<span class="num">${wk.correct || 0}</span></span>
        <span class="stat" title="Bu haftada sarflangan vaqt">${I.clock}<span class="num">${fmtTime(wk.seconds)}</span></span>
        <button class="btn ghost sm" data-act="logout" aria-label="Chiqish">${I.out}</button>
      </div></div>
      <nav class="tabs" aria-label="Bo'limlar">
        <button class="tab" data-act="stab" data-v="home" aria-current="${ST.tab === "home"}">${I.home}Vazifalar</button>
        <button class="tab" data-act="stab" data-v="board" aria-current="${ST.tab === "board"}">${I.list}Reyting</button>
      </nav>`;
  }

  function vStudent() {
    if (!ST.home) return `${sHeaderLite()}<div class="loading">Yuklanmoqda…</div>`;
    if (ST.tab === "board") return sHeader() + vBoard();
    const qs = ST.home.quests || [];
    const now = Date.now();
    const cards = qs.map((q) => {
      const cs = circleStates(q);
      const nowIdx = cs.findIndex((c) => !c.done);
      const late = q.deadline && new Date(q.deadline).getTime() < now;
      const doneLate = q.completed_at && q.deadline && new Date(q.completed_at) > new Date(q.deadline);
      let status = "";
      if (q.completed_at) status = `<span class="pill green">${doneLate ? "Bajarildi · kech" : "Bajarildi"}</span>`;
      else if (late) status = `<span class="pill red">Muddat o'tdi · hali ham bajarsa bo'ladi</span>`;
      else if (q.deadline) status = `<span class="pill amber">Muddat: ${esc(fmtDate(q.deadline))}</span>`;
      const started = q.state && q.state.i > 0;
      return `<section class="card quest">
        <div class="row between"><h2>${esc(q.title)}</h2>${status}</div>
        ${circlesHTML(cs, q.completed_at ? -1 : nowIdx)}
        ${q.completed_at ? `<p class="muted">Barakalla! Bu vazifa tugadi.</p>`
          : `<div class="row"><button class="btn sun" data-act="play" data-v="${q.id}">${started ? "Davom etish" : "Boshlash"}</button>
             <span class="muted">${started ? "Qolgan joyingizdan davom etasiz." : `Doira 1: ${esc((cs[0] || {}).name || "")}`}</span></div>`}
      </section>`;
    }).join("");
    return `${sHeader()}${cards || `<div class="card empty">Hozircha vazifa yo'q. O'qituvchingiz vazifa berganda shu yerda paydo bo'ladi.</div>`}`;
  }
  function sHeaderLite() {
    return `<div class="top"><div class="logo"><span class="logo-mark">A</span><span>Salom, ${esc(S.first_name)}!</span></div>
      <button class="btn ghost sm" data-act="logout" aria-label="Chiqish">${I.out}</button></div>`;
  }
  function vBoard() {
    if (!ST.board) return `<div class="loading">Yuklanmoqda…</div>`;
    if (!ST.board.length) return `<div class="card empty">Reyting sinfga biriktirilgan o'quvchilar uchun ko'rinadi.</div>`;
    return `<div class="row between"><h2>${esc((ST.home.me && ST.home.me.class) || "")} sinf reytingi</h2><span class="pill">Bu hafta</span></div>
      <div class="lb">${ST.board.map((s, i) => `<div class="lbrow ${s.me ? "me" : ""}"><span class="rank ${i < 3 && s.points > 0 ? "r" + (i + 1) : ""}">${i + 1}</span>
        <span class="nm">${esc(s.name)}${s.me ? " (siz)" : ""}</span><span class="pts num">${s.points}</span></div>`).join("")}</div>
      <p class="muted small">Ochko = shu haftadagi to'g'ri javoblar soni.</p>`;
  }

  /* ---------- quest player ---------- */
  let P = {};

  async function startQuest(id, preview) {
    V = { screen: "play" };
    P = { loading: true, preview: !!preview };
    render();
    try {
      const q = await api("get_quest", { p_quest: Number(id) });
      const byId = {}; q.steps.forEach((s) => (byId[s.id] = s));
      let st = q.state;
      const ok = st && Array.isArray(st.order) && st.order.every((x) => byId[x]) && typeof st.i === "number";
      if (!ok || preview) st = { order: q.steps.map((s) => s.id), i: 0, final: [], tries: {} };
      st.final = st.final || []; st.tries = st.tries || {};
      P = { quest: q, byId, state: st, preview: !!preview, right: 0, answered: 0 };
      loadStep();
    } catch (e) {
      if (e.message === "AUTH") return;
      P = { error: errText(e) };
    }
    render();
  }
  function curStep() { return P.byId[P.state.order[P.state.i]]; }
  function loadStep() {
    P.sel = null; P.pick = []; P.typed = ""; P.result = null; P.busy = false;
    const s = P.state.i < P.state.order.length ? curStep() : null;
    P.opts = s && s.opts ? (s.t === "tf" ? s.opts.slice() : shuffle(s.opts)) : null;
    P.t0 = Date.now();
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function vPlay() {
    if (P.error) return `<div class="player"><div class="card"><p class="err">${esc(P.error)}</p><button class="btn" data-act="quit">Orqaga</button></div></div>`;
    if (P.loading || !P.quest) return `<div class="loading">Yuklanmoqda…</div>`;
    const q = P.quest;
    const finalSet = new Set(P.state.final);
    const circ = (q.circles || []).map((c, i) => {
      const ids = q.steps.filter((s) => s.c === i && s.g).map((s) => s.id);
      return { name: c.name, done: ids.length > 0 && ids.every((id) => finalSet.has(id)) };
    });
    const top = `<div class="row between"><button class="btn ghost sm" data-act="quit">${I.x} Chiqish</button>
      ${P.preview ? `<span class="pill amber">Sinov rejimi · natija saqlanmaydi</span>` : `<span class="pill">${esc(q.title)}</span>`}</div>`;

    if (P.state.i >= P.state.order.length) {
      const acc = P.answered ? Math.round((P.right / P.answered) * 100) : null;
      return `<div class="player">${top}${circlesHTML(circ.map((c) => ({ ...c, done: true })), -1)}
        <div class="card stack center" style="align-items:center"><span class="logo-mark" style="width:72px;height:72px;background:var(--sun);color:var(--on-sun)">${I.trophy}</span>
        <h1>Vazifa tugadi!</h1>${acc !== null ? `<p style="font-size:19px">Bu safargi aniqlik: <b>${acc}%</b></p>` : ""}
        <p class="muted">Barakalla! Natijangiz saqlandi.</p></div>
        <button class="btn sun wide" data-act="quit">${P.preview ? "Vazifalar ro'yxatiga qaytish" : "Vazifalarga qaytish"}</button></div>`;
    }

    const s = curStep();
    const strip = circlesHTML(circ, s.c);
    let body = "";
    const passage = s.p && P.byId[s.p] ? `<details class="passage-box" open><summary>Matn: ${esc(P.byId[s.p].title)}</summary><div class="passage" data-nocopy>${esc(P.byId[s.p].text)}</div></details>` : "";
    const locked = !!P.result || P.busy;

    if (s.t === "card") {
      body = `<div class="concept"><span class="qtype">Yangi qoida</span><div class="qtext">${esc(s.title)}</div><div class="body">${esc(s.body)}</div></div>
        <button class="btn wide" data-act="next" ${P.busy ? "disabled" : ""}>Tushundim</button>`;
    } else if (s.t === "word") {
      body = `<div class="wordcard"><span class="qtype">Yangi so'z</span><span class="en">${esc(s.en)}</span><span class="uz">${esc(s.uz)}</span>${s.ex ? `<p style="font-size:19px">${esc(s.ex)}</p>` : ""}</div>
        <button class="btn wide" data-act="next" ${P.busy ? "disabled" : ""}>Yodladim, davom</button>`;
    } else if (s.t === "read") {
      body = `<div class="stack"><span class="qtype">O'qish</span><div class="qtext">${esc(s.title)}</div><div class="passage" data-nocopy>${esc(s.text)}</div></div>
        <button class="btn wide" data-act="next" ${P.busy ? "disabled" : ""}>O'qidim</button>`;
    } else if (s.t === "choice" || s.t === "tf") {
      const label = s.t === "tf" ? "To'g'rimi?" : s.p ? "Matn bo'yicha savol" : "Savol";
      body = `${passage}<span class="qtype">${label}</span><div class="qtext noselect">${esc(s.q)}</div>
        <div class="opts ${s.t === "tf" ? "tf" : ""}">${P.opts.map((o, i) => {
          let c = "";
          if (P.result) {
            if (P.result.ok && i === P.sel) c = "right";
            else if (!P.result.ok && i === P.sel) c = "wrong";
            else if (!P.result.ok && P.result.right && o === P.result.right) c = "right";
          } else if (i === P.sel) c = "sel";
          return `<button class="opt ${c}" data-act="sel" data-v="${i}" ${locked ? "disabled" : ""}>${s.t === "tf" ? "" : `<span class="k">${"ABCDEFGH"[i] || i + 1}</span>`}${esc(o)}</button>`;
        }).join("")}</div>`;
    } else if (s.t === "gap") {
      body = `${passage}<span class="qtype">Bo'sh joyni to'ldiring</span>
        <div class="gapline noselect"><span>${esc(s.before)}</span><input id="answerInput" aria-label="Javob" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" ${locked ? "disabled" : ""}><span>${esc(s.after)}</span></div>
        ${s.hint ? `<p class="muted">Yordam: ${esc(s.hint)}</p>` : ""}<p class="muted small">Katta-kichik harf va bo'sh joy xato hisoblanmaydi.</p>`;
    } else if (s.t === "spell") {
      body = `<span class="qtype">Inglizchasini yozing</span><div class="qtext">${esc(s.uz)}</div>
        <input id="answerInput" class="bigin" aria-label="Inglizcha so'z" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="${esc(s.hint)}…" ${locked ? "disabled" : ""}>
        <p class="muted small">Birinchi harf: <b>${esc(s.hint)}</b>. Katta-kichik harf xato hisoblanmaydi.</p>`;
    } else if (s.t === "order" || s.t === "letters") {
      const items = s.t === "order" ? s.words : s.L;
      body = `<span class="qtype">${s.t === "order" ? "So'zlarni tartiblang" : "Harflardan so'z yasang"}</span>
        <div class="qtext">${esc(s.t === "order" ? s.uz || "Gapni tuzing" : s.uz)}</div>
        <div class="slot" aria-label="Javobingiz">${P.pick.length ? P.pick.map((w, i) => `<button class="word ${s.t === "letters" ? "letter" : ""}" data-act="unpick" data-v="${i}" ${locked ? "disabled" : ""}>${esc(items[w])}</button>`).join("") : `<span class="muted">${s.t === "order" ? "So'zlarni bosing" : "Harflarni bosing"}</span>`}</div>
        <div class="words">${items.map((w, i) => `<button class="word ${s.t === "letters" ? "letter" : ""} ${P.pick.includes(i) ? "used" : ""}" data-act="pick" data-v="${i}" ${locked ? "disabled" : ""}>${esc(w)}</button>`).join("")}</div>`;
    }

    let fb = "";
    if (P.result) {
      fb = `<div class="feedback ${P.result.ok ? "good" : "bad"}" role="status">
          <h3>${P.result.ok ? I.check + "Zo'r, to'g'ri!" : I.x + "Hechqisi yo'q, keling tushunib olamiz"}</h3>
          ${!P.result.ok && P.result.right ? `<p>To'g'ri javob: <b>${esc(P.result.right)}</b></p>` : ""}
          ${P.result.why ? `<p>${esc(P.result.why)}</p>` : ""}
          ${!P.result.ok && P.result.again ? `<p class="muted">Bu savol keyinroq yana chiqadi.</p>` : ""}
        </div>
        <button class="btn wide ${P.result.ok ? "grass" : ""}" data-act="cont">Davom etish</button>`;
    } else if (s.g) {
      fb = `<button class="btn wide" data-act="check" ${P.busy ? "disabled" : ""}>${P.busy ? "Tekshirilmoqda…" : "Tekshirish"}</button>`;
    }
    return `<div class="player">${top}${strip}${body}${fb}</div>`;
  }

  async function nextCard() {
    if (P.busy) return;
    const s = curStep();
    const st = clone(P.state); st.i += 1;
    P.busy = true; render();
    try {
      if (!P.preview) await api("advance", { p_quest: P.quest.id, p_step: s.id, p_answer: "", p_ms: Date.now() - P.t0, p_state: st });
      P.state = st; loadStep();
    } catch (e) { P.busy = false; if (e.message !== "AUTH") toast(errText(e)); }
    render(); window.scrollTo(0, 0);
  }

  function currentAnswer(s) {
    if (s.t === "choice" || s.t === "tf") return P.sel == null ? "" : P.opts[P.sel];
    if (s.t === "gap" || s.t === "spell") { const el = $("#answerInput"); return (el ? el.value : P.typed || "").trim(); }
    if (s.t === "order") return P.pick.map((i) => s.words[i]).join(" ");
    if (s.t === "letters") return P.pick.map((i) => s.L[i]).join("");
    return "";
  }

  async function check() {
    if (P.busy || P.result) return;
    const s = curStep();
    const ans = currentAnswer(s);
    if (!ans) { toast(s.t === "choice" || s.t === "tf" ? "Avval javobni tanlang" : s.t === "order" || s.t === "letters" ? "Avval bo'laklarni joylang" : "Avval javobni yozing"); return; }
    if ((s.t === "order" && P.pick.length < s.words.length) || (s.t === "letters" && P.pick.length < s.L.length)) { toast("Hamma bo'laklarni joylang"); return; }
    P.typed = ans;
    const tries = (P.state.tries[s.id] || 0) + 1;
    const ifRight = clone(P.state);
    ifRight.tries[s.id] = tries;
    if (!ifRight.final.includes(s.id)) ifRight.final.push(s.id);
    ifRight.i += 1;
    P.busy = true; render();
    let res;
    try {
      res = await api("advance", { p_quest: P.quest.id, p_step: s.id, p_answer: ans, p_ms: Date.now() - P.t0, p_state: P.preview ? null : ifRight });
    } catch (e) { P.busy = false; if (e.message !== "AUTH") toast(errText(e)); render(); return; }
    P.busy = false;
    P.answered += 1; if (res.ok) P.right += 1;
    if (res.ok) {
      P.next = ifRight;
    } else {
      const st = clone(P.state);
      st.tries[s.id] = tries;
      if (tries >= 2) {
        if (!st.final.includes(s.id)) st.final.push(s.id);
      } else {
        // bring it back later in the same circle
        let j = st.i + 1;
        while (j < st.order.length && P.byId[st.order[j]].c === s.c) j++;
        st.order.splice(j, 0, s.id);
        res.again = true;
      }
      st.i += 1;
      P.next = st;
      if (!P.preview) api("save_state", { p_quest: P.quest.id, p_state: st }).catch(() => {});
    }
    P.result = res;
    render();
  }

  function cont() {
    P.state = P.next; P.next = null; loadStep(); render(); window.scrollTo(0, 0);
    if (P.state.i >= P.state.order.length && !P.preview) ST.home = null;
  }

  /* ---------- teacher ---------- */
  const T = { tab: "report", data: null, cls: null, week: strFromDay(mondayOf(new Date())), report: null, reportKey: "",
    filter: "all", paste: "", parsed: null, poolPick: {}, bulk: "", bulkCls: "", bulkPool: "", bulkResult: null,
    confirm: "", editName: null, pwFor: null, openStudents: null, saving: false, pwMsg: "" };

  async function loadAdmin() {
    try {
      T.data = await api("admin_data");
      if (!T.cls || !T.data.classes.some((c) => c.id === T.cls)) T.cls = T.data.classes.length ? T.data.classes[0].id : null;
    } catch (e) { if (e.message !== "AUTH") toast(errText(e)); }
    render();
    if (T.tab === "report") loadReport();
  }
  async function loadReport(force) {
    if (!T.cls) return;
    const key = T.cls + "|" + T.week;
    if (!force && T.reportKey === key && T.report) return;
    T.reportKey = key; T.report = null; render();
    try {
      const r = await api("admin_report", { p_class: T.cls, p_week: T.week });
      if (T.reportKey === key) { T.report = r; render(); }
    } catch (e) { if (e.message !== "AUTH") toast(errText(e)); }
  }

  function tHeader() {
    const tabs = [["report", "Hisobot"], ["students", "O'quvchilar"], ["quests", "Vazifalar"], ["settings", "Sozlamalar"]];
    return `<div class="top"><div class="logo"><span class="logo-mark">A</span>O'qituvchi paneli</div>
      <button class="btn ghost sm" data-act="logout">${I.out} Chiqish</button></div>
      <nav class="tabs" aria-label="Bo'limlar">${tabs.map(([k, l]) => `<button class="tab" data-act="ttab" data-v="${k}" aria-current="${T.tab === k}">${l}</button>`).join("")}</nav>`;
  }
  function vTeacher() {
    if (!T.data) return tHeader() + `<div class="loading">Yuklanmoqda…</div>`;
    if (T.tab === "students") return tHeader() + vStudents();
    if (T.tab === "quests") return tHeader() + vQuests();
    if (T.tab === "settings") return tHeader() + vSettings();
    return tHeader() + vReport();
  }
  const className = (id) => { const c = T.data.classes.find((x) => x.id === id); return c ? c.name : ""; };
  const poolName = (id) => { const p = T.data.pools.find((x) => x.id === id); return p ? p.name : ""; };
  const opts = (list, sel, none) => (none !== undefined ? `<option value="">${esc(none)}</option>` : "") +
    list.map((x) => `<option value="${x.id}" ${x.id === sel ? "selected" : ""}>${esc(x.name)}</option>`).join("");

  function vReport() {
    const d = T.data;
    if (!d.classes.length) return `<div class="card empty">Avval "O'quvchilar" bo'limida sinf yarating va o'quvchilarni qo'shing.</div>`;
    const thisWeek = strFromDay(mondayOf(new Date()));
    const chips = `<div class="tabs" role="group" aria-label="Sinf">${d.classes.map((c) => `<button class="tab" data-act="cls" data-v="${c.id}" aria-current="${T.cls === c.id}">${esc(c.name)}</button>`).join("")}</div>
      <div class="row"><button class="btn ghost sm" data-act="week" data-v="-1" aria-label="Oldingi hafta">‹</button>
      <b>${esc(weekLabel(T.week))}</b>
      <button class="btn ghost sm" data-act="week" data-v="1" aria-label="Keyingi hafta" ${T.week >= thisWeek ? "disabled" : ""}>›</button>
      <button class="btn ghost sm" data-act="reload">Yangilash</button></div>`;
    if (!T.report) return chips + `<div class="loading">Yuklanmoqda…</div>`;
    const rows = (T.report.rows || []).slice().sort((a, b) => b.correct - a.correct || (b.pct || 0) - (a.pct || 0));
    if (!rows.length) return chips + `<div class="card empty">Bu sinfda hali o'quvchi yo'q.</div>`;
    const withHw = rows.filter((r) => r.pct != null);
    const avg = (arr, f) => (arr.length ? Math.round(arr.reduce((a, r) => a + f(r), 0) / arr.length) : null);
    const avgPct = avg(withHw, (r) => r.pct);
    const avgTime = avg(rows, (r) => r.seconds);
    const totAns = rows.reduce((a, r) => a + r.answered, 0), totCor = rows.reduce((a, r) => a + r.correct, 0);
    const top5 = rows.filter((r) => r.correct > 0).slice(0, 5);
    return chips + `<article class="report">
      <div class="report-head"><div><span class="pill">Haftalik hisobot</span><h1 style="margin-top:8px">${esc(className(T.cls))} sinf</h1>
        <p class="muted">${esc(weekLabel(T.week))} · ${rows.length} o'quvchi</p></div>
        <div class="logo" style="font-size:18px"><span class="logo-mark" style="width:36px;height:36px;font-size:18px">A</span>Abduqodir Teacher</div></div>
      <div class="kpis">
        <div class="kpi"><b>${avgPct == null ? "—" : avgPct + "%"}</b><span>O'rtacha bajarilgan vazifa</span></div>
        <div class="kpi"><b>${fmtTime(avgTime)}</b><span>O'rtacha sarflangan vaqt</span></div>
        <div class="kpi"><b>${totAns ? Math.round((totCor / totAns) * 100) + "%" : "—"}</b><span>O'rtacha aniqlik</span></div>
        <div class="kpi"><b class="num">${totAns}</b><span>Jami javob berilgan savol</span></div>
      </div>
      ${top5.length ? `<div><h3>Eng yaxshi ${top5.length} o'quvchi</h3><ol class="top5" style="margin-top:12px">${top5.map((r, i) => `<li><span class="rank r${i < 3 ? i + 1 : ""}">${i + 1}</span>${esc(r.first_name + " " + r.last_name)}<span class="muted num" style="margin-left:auto">${r.correct} ochko</span></li>`).join("")}</ol></div>` : ""}
      <div class="tablebox"><table class="wide-table"><thead><tr><th>#</th><th>O'quvchi</th><th>Vazifa</th><th>Tugatgan</th><th>Vaqt</th><th>Aniqlik</th><th>Javoblar</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td><span class="rank ${i < 3 && r.correct > 0 ? "r" + (i + 1) : ""}">${i + 1}</span></td>
        <td><b>${esc(r.first_name + " " + r.last_name)}</b>${r.pool ? `<div class="muted small">${esc(r.pool)}</div>` : ""}</td>
        <td class="num">${r.pct == null ? `<span class="muted">vazifa yo'q</span>` : `<span class="bar ${barCls(r.pct)}"><i style="width:${r.pct}%"></i></span>${r.pct}%`}</td>
        <td class="num">${r.quests ? `${r.finished} / ${r.quests}` : "—"}${r.late ? ` <span class="pill amber">${r.late} kech</span>` : ""}</td>
        <td class="num">${fmtTime(r.seconds)}</td>
        <td class="num">${r.answered ? Math.round((r.correct / r.answered) * 100) + "%" : "—"}</td>
        <td class="num">${r.answered}</td></tr>`).join("")}
      </tbody></table></div>
      <p class="muted small">Vazifa: shu haftaga muddati qo'yilgan vazifalarning bajarilgan qismi. Ochko = to'g'ri javoblar soni.</p>
    </article>`;
  }

  function nameList(kind) {
    const list = kind === "class" ? T.data.classes : T.data.pools;
    const title = kind === "class" ? "Sinflar" : "Pullar (daraja guruhlari)";
    const note = kind === "class" ? "Sinf hisobot va reyting uchun." : "Pul qaysi vazifa berilishini belgilaydi.";
    return `<section class="card stack"><div><h3>${title}</h3><p class="muted small">${note}</p></div>
      <div class="chips">${list.length ? list.map((x) => {
        const key = kind + ":" + x.id;
        if (T.editName === key) return `<span class="chip"><input id="rn-${key}" value="${esc(x.name)}" style="width:140px;padding:4px 8px;font-size:15px" aria-label="Yangi nom"><button data-act="rnSave" data-v="${key}">Saqlash</button><button data-act="rnCancel">Bekor</button></span>`;
        const conf = T.confirm === "del-" + key;
        return `<span class="chip">${esc(x.name)} <span class="muted">· ${x.n}</span>
          <button data-act="rn" data-v="${key}" aria-label="Nomini o'zgartirish">✎</button>
          <button data-act="delName" data-v="${key}" aria-label="O'chirish" style="${conf ? "color:var(--coral);font-weight:800" : ""}">${conf ? "Rostdan o'chirilsinmi?" : "✕"}</button></span>`;
      }).join("") : `<span class="muted">Hali yo'q</span>`}</div>
      <form class="row" data-form="add-${kind}"><input name="nm" placeholder="${kind === "class" ? "Masalan: 7-A" : "Masalan: A2"}" style="max-width:220px" aria-label="Yangi nom" maxlength="40">
      <button class="btn sm" type="submit">Qo'shish</button></form></section>`;
  }

  function vStudents() {
    const d = T.data;
    let list = d.students;
    if (T.filter === "none") list = list.filter((s) => !s.class_id);
    else if (T.filter !== "all") list = list.filter((s) => s.class_id === Number(T.filter));
    const filt = `<div class="tabs" role="group" aria-label="Sinf bo'yicha">
      <button class="tab" data-act="filter" data-v="all" aria-current="${T.filter === "all"}">Hammasi · ${d.students.length}</button>
      ${d.classes.map((c) => `<button class="tab" data-act="filter" data-v="${c.id}" aria-current="${T.filter === String(c.id)}">${esc(c.name)} · ${c.n}</button>`).join("")}
      <button class="tab" data-act="filter" data-v="none" aria-current="${T.filter === "none"}">Sinfsiz</button></div>`;
    const table = list.length ? `<div class="tablebox"><table class="wide-table"><thead><tr><th>O'quvchi</th><th>Login</th><th>Sinf</th><th>Pul</th><th>Parol</th><th></th></tr></thead><tbody>
      ${list.map((s) => {
        const editing = T.editName === "stu:" + s.id;
        const conf = T.confirm === "del-stu:" + s.id;
        return `<tr>
          <td>${editing ? `<div class="row"><input id="fn-${s.id}" value="${esc(s.first_name)}" style="width:130px" aria-label="Ism"><input id="ln-${s.id}" value="${esc(s.last_name)}" style="width:150px" aria-label="Familiya">
              <button class="btn sm" data-act="stuNameSave" data-v="${s.id}">Saqlash</button></div>`
            : `<b>${esc(s.first_name)} ${esc(s.last_name)}</b> <button class="link" data-act="rn" data-v="stu:${s.id}" aria-label="Ismni tahrirlash">✎</button>`}</td>
          <td><code>${esc(s.login)}</code></td>
          <td><select data-chg="stuClass" data-v="${s.id}" aria-label="Sinf">${opts(d.classes, s.class_id, "—")}</select></td>
          <td><select data-chg="stuPool" data-v="${s.id}" aria-label="Pul">${opts(d.pools, s.pool_id, "—")}</select></td>
          <td>${T.pwFor === s.id ? `<div class="row"><input id="pw-${s.id}" placeholder="Yangi parol" style="width:140px" aria-label="Yangi parol"><button class="btn sm" data-act="pwSave" data-v="${s.id}">Saqlash</button></div>`
            : `<button class="btn ghost sm" data-act="pwOpen" data-v="${s.id}">Yangi parol</button>`}</td>
          <td><button class="btn ${conf ? "danger" : "ghost"} sm" data-act="delStu" data-v="${s.id}">${conf ? "Rostdan o'chirish" : "O'chirish"}</button></td></tr>`;
      }).join("")}</tbody></table></div>` : `<div class="card empty">Bu yerda hali o'quvchi yo'q.</div>`;

    const br = T.bulkResult;
    const bulk = `<section class="card stack"><h3>O'quvchilarni qo'shish</h3>
      <p class="muted">Har qatorga bitta o'quvchi: <code>Ism Familiya, login, parol</code>. Login faqat lotin harflari va raqamlar.</p>
      <textarea id="bulkBox" aria-label="O'quvchilar ro'yxati" placeholder="Ali Valiyev, ali01, 4821&#10;Madina Karimova, madina02, 7310" style="min-height:140px">${esc(T.bulk)}</textarea>
      <div class="grid g2"><div><label for="bulkCls">Sinf</label><select id="bulkCls" data-chg="bulkCls">${opts(d.classes, Number(T.bulkCls) || null, "— sinfsiz —")}</select></div>
      <div><label for="bulkPool">Pul</label><select id="bulkPool" data-chg="bulkPool">${opts(d.pools, Number(T.bulkPool) || null, "— pulsiz —")}</select></div></div>
      <button class="btn" data-act="bulkAdd" ${T.saving ? "disabled" : ""}>Qo'shish</button>
      ${br ? `<p class="${br.errors.length ? "" : "ok-text"}">${br.added} ta o'quvchi qo'shildi.</p>${br.errors.length ? `<ul class="errlist">${br.errors.map((e) => `<li>${esc(e.login || e.line)}: ${esc(e.error)}</li>`).join("")}</ul>` : ""}` : ""}
    </section>`;

    return `<div class="grid g2">${nameList("class")}${nameList("pool")}</div>${filt}${table}${bulk}`;
  }

  function quotaScripts(text, parsed) {
    const lines = text.replace(/\r/g, "").split("\n");
    return parsed.quests.map((q, i) => {
      const start = q.line - 1;
      const end = i + 1 < parsed.quests.length ? parsed.quests[i + 1].line - 1 : lines.length;
      return lines.slice(start, end).join("\n").trim();
    });
  }

  function vQuests() {
    const d = T.data;
    const pr = T.parsed;
    let summary = "";
    if (pr) {
      if (pr.errors.length) {
        summary = `<div class="feedback bad"><h3>${I.x}Xatolar bor, tuzating:</h3><ul class="errlist">${pr.errors.map((e) => `<li>${e.line}-qator: ${esc(e.msg)}</li>`).join("")}</ul></div>`;
      } else {
        const total = pr.quests.reduce((a, q) => a + q.gradable, 0);
        summary = `<div class="feedback good"><h3>${I.check}${pr.quests.length} ta vazifa · ${total} ta savol tayyor</h3></div>
          <div class="tablebox"><table><thead><tr><th>Vazifa</th><th>Doiralar</th><th>Savollar</th><th>Pul</th></tr></thead><tbody>
          ${pr.quests.map((q, i) => {
            const sel = T.poolPick[i] !== undefined ? T.poolPick[i] : "";
            const missing = q.pool && !d.pools.some((p) => p.name.toLowerCase() === q.pool.toLowerCase());
            return `<tr><td><b>${esc(q.title)}</b>${missing ? `<div class="err small">"${esc(q.pool)}" nomli pul topilmadi</div>` : ""}</td>
              <td>${q.circles.map((c) => esc(c.name)).join(", ")}</td><td class="num">${q.gradable}</td>
              <td><select data-chg="poolPick" data-v="${i}" aria-label="Pul">${opts(d.pools, sel === "" ? null : Number(sel), "— keyin tanlayman —")}</select></td></tr>`;
          }).join("")}</tbody></table></div>
          <button class="btn grass" data-act="saveQuests" ${T.saving ? "disabled" : ""}>${T.saving ? "Saqlanmoqda…" : "Hammasini saqlash"}</button>`;
      }
    }
    const paste = `<section class="card stack"><h3>Vazifa qo'shish</h3>
      <p class="muted">Vazifa kodini shu yerga joylang. Bir yo'la bir nechta vazifa (butun hafta) bo'lishi mumkin.</p>
      <textarea id="pasteBox" aria-label="Vazifa kodi" placeholder="@quest Unit 3 · Hozirgi davomli zamon&#10;@pool A2&#10;@circle Qoida&#10;...">${esc(T.paste)}</textarea>
      <div class="row"><button class="btn" data-act="parse">Tekshirish</button></div>
      <div id="pasteSummary" class="stack">${summary}</div></section>`;

    const list = d.quests.length ? d.quests.map((q) => {
      const conf = T.confirm === "del-q:" + q.id;
      const open = T.openStudents === q.id;
      const indiv = q.students || [];
      return `<section class="card stack">
        <div class="row between"><h3>${esc(q.title)}</h3>
          <div class="row">${q.hidden ? `<span class="pill gray">Yashirin</span>` : ""}<span class="pill green">${q.finished} ta tugatdi</span></div></div>
        <div class="grid g2">
          <div><label for="qp-${q.id}">Pul</label><select id="qp-${q.id}" data-chg="qPool" data-v="${q.id}">${opts(d.pools, q.pool_id, "— faqat alohida o'quvchilar —")}</select></div>
          <div><label for="qd-${q.id}">Muddat</label><div class="row" style="flex-wrap:nowrap"><input id="qd-${q.id}" type="datetime-local" value="${esc(toLocalInput(q.deadline))}" data-chg="qDeadline" data-v="${q.id}">
            ${q.deadline ? `<button class="btn ghost sm" data-act="qNoDeadline" data-v="${q.id}" aria-label="Muddatni olib tashlash">✕</button>` : ""}</div></div>
        </div>
        <div class="row">
          <label class="row" style="margin:0;gap:8px"><input type="checkbox" data-chg="qHidden" data-v="${q.id}" ${q.hidden ? "checked" : ""}> O'quvchilardan yashirish</label>
          <span class="muted small">${q.gradable} savol · ${(q.circles || []).length} doira · ${esc(fmtDate(q.created_at))} da qo'shilgan</span>
        </div>
        <div class="row">
          <button class="btn sun sm" data-act="preview" data-v="${q.id}">Sinab ko'rish</button>
          <button class="btn ghost sm" data-act="indiv" data-v="${q.id}">Alohida o'quvchilar · ${indiv.length}</button>
          <button class="btn ${conf ? "danger" : "ghost"} sm" data-act="delQuest" data-v="${q.id}">${conf ? "Rostdan o'chirish (natijalar ham)" : "O'chirish"}</button>
        </div>
        ${open ? `<div class="stack"><p class="muted small">Belgilangan o'quvchilar bu vazifani puldan tashqari ham oladi.</p>
          <div class="checklist">${d.students.map((s) => `<label><input type="checkbox" class="indiv-box" value="${s.id}" ${indiv.includes(s.id) ? "checked" : ""}> ${esc(s.first_name + " " + s.last_name)} <span class="muted small">${esc(className(s.class_id))}</span></label>`).join("")}</div>
          <div class="row"><button class="btn sm" data-act="indivSave" data-v="${q.id}">Saqlash</button><button class="btn ghost sm" data-act="indiv" data-v="${q.id}">Yopish</button></div></div>` : ""}
      </section>`;
    }).join("") : `<div class="card empty">Hali vazifa yo'q. Yuqoriga kod joylab qo'shing.</div>`;
    return paste + `<h2>Vazifalar</h2>` + list;
  }

  function vSettings() {
    return `<section class="card form"><h3>Parolni o'zgartirish</h3>
      <div><label for="op">Hozirgi parol</label><input id="op" type="password" autocomplete="current-password"></div>
      <div><label for="np">Yangi parol (kamida 8 belgi)</label><input id="np" type="password" autocomplete="new-password"></div>
      <div><label for="np2">Yangi parolni takrorlang</label><input id="np2" type="password" autocomplete="new-password"></div>
      ${T.pwMsg ? `<p class="${T.pwMsg.ok ? "ok-text" : "err"}">${esc(T.pwMsg.t)}</p>` : ""}
      <button class="btn" data-act="changePw">Saqlash</button></section>`;
  }

  async function adminCall(fn, args, okMsg, reload = true) {
    try {
      const r = await api(fn, args);
      if (okMsg) toast(okMsg);
      if (reload) await loadAdmin();
      return r;
    } catch (e) { if (e.message !== "AUTH") toast(errText(e)); return null; }
  }

  function updateStudent(id, patch) {
    const s = T.data.students.find((x) => x.id === id); if (!s) return;
    const n = Object.assign({}, s, patch);
    adminCall("admin_student_update", { p_id: id, p_first: n.first_name, p_last: n.last_name, p_class: n.class_id, p_pool: n.pool_id }, "Saqlandi");
  }
  function updateQuest(id, patch, msg) {
    const q = T.data.quests.find((x) => x.id === id); if (!q) return;
    const n = Object.assign({}, q, patch);
    adminCall("admin_quest_update", { p_id: id, p_title: n.title, p_pool: n.pool_id, p_deadline: n.deadline, p_hidden: n.hidden, p_students: patch.students || null }, msg || "Saqlandi");
  }

  /* ---------- events ---------- */
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const a = b.dataset.act, v = b.dataset.v;
    if (a !== "delName" && a !== "delStu" && a !== "delQuest") T.confirm = "";
    switch (a) {
      case "role": V = { screen: "login", role: v }; render(); return;
      case "back": V = { screen: "pick" }; render(); return;
      case "logout": signOut(); return;
      // student
      case "stab": ST.tab = v; render(); if (v === "board") loadBoard(); return;
      case "play": startQuest(v, false); return;
      case "quit":
        if (S.role === "teacher") { V = { screen: "teacher" }; render(); }
        else { V = { screen: "student" }; ST.tab = "home"; loadStudent(); }
        return;
      case "sel": if (!P.result) { P.sel = Number(v); render(); } return;
      case "pick": if (!P.result && !P.pick.includes(Number(v))) { P.pick.push(Number(v)); render(); } return;
      case "unpick": if (!P.result) { P.pick.splice(Number(v), 1); render(); } return;
      case "check": check(); return;
      case "cont": cont(); return;
      case "next": nextCard(); return;
      // teacher
      case "ttab": T.tab = v; T.editName = null; T.pwFor = null; render(); if (v === "report") loadReport(true); return;
      case "cls": T.cls = Number(v); render(); loadReport(); return;
      case "week": { const d = dayFromStr(T.week); d.setDate(d.getDate() + 7 * Number(v)); T.week = strFromDay(d); loadReport(); return; }
      case "reload": loadReport(true); return;
      case "filter": T.filter = v; render(); return;
      case "rn": T.editName = v; render(); { const el = document.getElementById("rn-" + v); if (el) el.focus(); } return;
      case "rnCancel": T.editName = null; render(); return;
      case "rnSave": {
        const el = document.getElementById("rn-" + v); const [kind, id] = v.split(":");
        const name = el ? el.value.trim() : ""; if (!name) return;
        T.editName = null;
        await adminCall(kind === "class" ? "admin_class_save" : "admin_pool_save", { p_id: Number(id), p_name: name }, "Saqlandi");
        return;
      }
      case "delName": {
        if (T.confirm !== "del-" + v) { T.confirm = "del-" + v; render(); return; }
        T.confirm = ""; const [kind, id] = v.split(":");
        await adminCall(kind === "class" ? "admin_class_delete" : "admin_pool_delete", { p_id: Number(id) }, "O'chirildi");
        return;
      }
      case "stuNameSave": {
        const id = Number(v); const fn = document.getElementById("fn-" + id).value.trim(); const ln = document.getElementById("ln-" + id).value.trim();
        if (!fn) { toast("Ism bo'sh bo'lmasin"); return; }
        T.editName = null; updateStudent(id, { first_name: fn, last_name: ln }); return;
      }
      case "pwOpen": T.pwFor = Number(v); render(); { const el = document.getElementById("pw-" + v); if (el) el.focus(); } return;
      case "pwSave": {
        const id = Number(v); const pw = document.getElementById("pw-" + id).value.trim();
        if (pw.length < 4) { toast("Parol kamida 4 belgi"); return; }
        T.pwFor = null;
        await adminCall("admin_set_password", { p_id: id, p_password: pw }, "Yangi parol saqlandi: " + pw);
        return;
      }
      case "delStu": {
        if (T.confirm !== "del-stu:" + v) { T.confirm = "del-stu:" + v; render(); return; }
        T.confirm = ""; await adminCall("admin_student_delete", { p_id: Number(v) }, "O'quvchi o'chirildi"); return;
      }
      case "bulkAdd": {
        const lines = (T.bulk || "").split("\n").map((l) => l.trim()).filter(Boolean);
        if (!lines.length) { toast("Ro'yxat bo'sh"); return; }
        const rows = [], bad = [];
        lines.forEach((l, i) => {
          const parts = l.split(",").map((x) => x.trim());
          if (parts.length < 3 || !parts[0]) { bad.push({ line: i + 1 + "-qator", error: "Format: Ism Familiya, login, parol" }); return; }
          const nm = parts[0].split(/\s+/);
          rows.push({ first_name: nm[0], last_name: nm.slice(1).join(" "), login: parts[1].toLowerCase(), password: parts[2], class_id: T.bulkCls || "", pool_id: T.bulkPool || "" });
        });
        T.saving = true; render();
        const r = rows.length ? await adminCall("admin_students_add", { p_rows: rows }, null) : { added: 0, errors: [] };
        T.saving = false;
        if (r) { T.bulkResult = { added: r.added, errors: bad.concat(r.errors || []) }; if (!T.bulkResult.errors.length) T.bulk = ""; }
        render(); return;
      }
      case "parse": {
        const ta = $("#pasteBox"); T.paste = ta ? ta.value : T.paste;
        if (!T.paste.trim()) { toast("Avval kodni joylang"); return; }
        T.parsed = window.QuestParser.parse(T.paste);
        T.poolPick = {};
        T.parsed.quests.forEach((q, i) => {
          const p = q.pool && T.data.pools.find((x) => x.name.toLowerCase() === q.pool.toLowerCase());
          T.poolPick[i] = p ? String(p.id) : "";
        });
        render(); return;
      }
      case "saveQuests": {
        const pr = T.parsed; if (!pr || pr.errors.length) return;
        const scripts = quotaScripts(T.paste, pr);
        const payload = pr.quests.map((q, i) => ({ title: q.title, pool_id: T.poolPick[i] || "", script: scripts[i], steps: q.steps, circles: q.circles }));
        T.saving = true; render();
        const r = await adminCall("admin_quests_create", { p_quests: payload }, null);
        T.saving = false;
        if (r) { toast(`${payload.length} ta vazifa saqlandi. Endi muddat qo'ying.`); T.paste = ""; T.parsed = null; }
        render(); return;
      }
      case "qNoDeadline": updateQuest(Number(v), { deadline: null }, "Muddat olib tashlandi"); return;
      case "preview": startQuest(v, true); return;
      case "indiv": T.openStudents = T.openStudents === Number(v) ? null : Number(v); render(); return;
      case "indivSave": {
        const ids = Array.from(document.querySelectorAll(".indiv-box:checked")).map((x) => Number(x.value));
        T.openStudents = null; updateQuest(Number(v), { students: ids }, "Saqlandi"); return;
      }
      case "delQuest": {
        if (T.confirm !== "del-q:" + v) { T.confirm = "del-q:" + v; render(); return; }
        T.confirm = ""; await adminCall("admin_quest_delete", { p_id: Number(v) }, "Vazifa o'chirildi"); return;
      }
      case "changePw": {
        const op = $("#op").value, np = $("#np").value, np2 = $("#np2").value;
        if (np.length < 8) { T.pwMsg = { t: "Yangi parol kamida 8 belgi bo'lsin." }; render(); return; }
        if (np !== np2) { T.pwMsg = { t: "Yangi parollar bir xil emas." }; render(); return; }
        try {
          const r = await api("admin_change_password", { p_old: op, p_new: np });
          T.pwMsg = r && r.ok ? { ok: true, t: "Parol o'zgartirildi." } : { t: r && r.error === "OLD_WRONG" ? "Hozirgi parol noto'g'ri." : "Parol juda qisqa." };
        } catch (err) { if (err.message !== "AUTH") T.pwMsg = { t: errText(err) }; }
        render(); return;
      }
    }
  });

  document.addEventListener("submit", async (e) => {
    const f = e.target.closest("[data-form]");
    if (!f) return;
    e.preventDefault();
    const kind = f.dataset.form.replace("add-", "");
    const name = f.nm.value.trim(); if (!name) return;
    await adminCall(kind === "class" ? "admin_class_save" : "admin_pool_save", { p_id: null, p_name: name }, "Qo'shildi");
  });

  document.addEventListener("change", (e) => {
    const el = e.target; const k = el.dataset && el.dataset.chg; if (!k) return;
    const id = Number(el.dataset.v);
    const val = el.value === "" ? null : Number(el.value);
    switch (k) {
      case "stuClass": updateStudent(id, { class_id: val }); break;
      case "stuPool": updateStudent(id, { pool_id: val }); break;
      case "bulkCls": T.bulkCls = el.value; break;
      case "bulkPool": T.bulkPool = el.value; break;
      case "poolPick": T.poolPick[el.dataset.v] = el.value; break;
      case "qPool": updateQuest(id, { pool_id: val }); break;
      case "qHidden": updateQuest(id, { hidden: el.checked }, el.checked ? "Yashirildi" : "Ko'rinadigan qilindi"); break;
      case "qDeadline": if (el.value) updateQuest(id, { deadline: new Date(el.value).toISOString() }, "Muddat saqlandi"); break;
    }
  });

  // Reading passages cannot be copied.
  ["copy", "cut", "contextmenu"].forEach((ev) => document.addEventListener(ev, (e) => {
    if (e.target.closest && e.target.closest("[data-nocopy], .noselect")) e.preventDefault();
  }));

  function boot() {
    if (!S) { render(); return; }
    if (S.role === "teacher") { V = { screen: "teacher" }; render(); loadAdmin(); }
    else { V = { screen: "student" }; render(); loadStudent(); }
  }
  boot();
})();
