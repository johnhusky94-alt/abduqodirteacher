/* Abduqodir Teacher v2 — website logic. Plain JS, no libraries. */
(function () {
  "use strict";

  const SB_URL = "https://meiokexdxhyjcyfpvjvx.supabase.co";
  const SB_KEY = "sb_publishable_YXhY13kbBK3sv89Y9c1uwg_83HfRqME";

  /* ---------- helpers ---------- */
  const $ = (s) => document.querySelector(s);
  const app = $("#app");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
  const pad = (n) => String(n).padStart(2, "0");
  const fmtDate = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${d.getDate()}-${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const toLocalInput = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtTime = (sec) => { const m = Math.round((sec || 0) / 60); const h = Math.floor(m / 60); return h ? `${h} soat ${m % 60} daq` : `${m} daq`; };
  const dayFromStr = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const strFromDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const weekLabel = (s) => { const a = dayFromStr(s); const b = new Date(a); b.setDate(b.getDate() + 6); return `${a.getDate()}-${MONTHS[a.getMonth()]} – ${b.getDate()}-${MONTHS[b.getMonth()]}`; };
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function toast(t) {
    const el = $("#toast"); el.textContent = t; el.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (el.hidden = true), 2600);
  }
  function ring(p, color, sz) {
    const r = 15.5, c = 2 * Math.PI * r, v = p == null ? 0 : Math.max(0, Math.min(100, p));
    return `<div class="ring" style="--sz:${sz || 52}px"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="${r}" fill="none" stroke="var(--line)" stroke-width="4"/>${v > 0 ? `<circle cx="18" cy="18" r="${r}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(c * v) / 100} ${c}"/>` : ""}</svg><span>${p == null ? "—" : p + "%"}</span></div>`;
  }

  /* ---------- icons ---------- */
  const SV = (d, fill, w) => `<svg viewBox="0 0 24 24" fill="${fill ? "currentColor" : "none"}" stroke="${fill ? "none" : "currentColor"}" stroke-width="${w || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    home: SV('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    loop: SV('<path d="M4 12a8 8 0 0 1 14-5l2 2M20 4v5h-5M20 12a8 8 0 0 1-14 5l-2-2M4 20v-5h5"/>'),
    trophy: SV('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/>'),
    list: SV('<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>', 0, 2.2),
    castle: SV('<path d="M3 21V8h3v2h3V8h6v2h3V8h3v13z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>'),
    chart: SV('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    send: SV('<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>'),
    doc: SV('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'),
    gear: SV('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
    book: SV('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5"/>'),
    class: SV('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 20h10M12 16v4"/>'),
    x: SV('<path d="M6 6l12 12M18 6L6 18"/>', 0, 2.4),
    chev: SV('<path d="M9 6l6 6-6 6"/>', 0, 2.2),
    back: SV('<path d="M15 6l-6 6 6 6"/>', 0, 2.2),
    lock: SV('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    check: SV('<path d="M5 12l5 5 9-10"/>', 0, 3),
    plus: SV('<path d="M12 5v14M5 12h14"/>', 0, 2.4),
    users: SV('<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M17 4a4 4 0 0 1 0 8M22 21a6 6 0 0 0-4-5.7"/>'),
    out: SV('<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>'),
    flag: SV('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
    key: SV('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>'),
    fire: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#FF9500" d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z"/></svg>',
    sword: '<svg viewBox="0 0 24 24" fill="none" stroke="#E0245E" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6L9 21l-6-6z"/><path d="M5 13l6 6"/></svg>',
    coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#FFC53D" stroke="#D99A0B" stroke-width="2"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" stroke="#8A5A00" stroke-width="1.6" fill="none"/></svg>',
    target: SV('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>'),
    hammer: SV('<path d="M14 4l6 6-3 3-6-6zM11 7L3 15l3 3 8-8"/>'),
    map: SV('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>'),
    crown: SV('<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>'),
    foot: SV('<path d="M8 3c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5zM16 10c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5z"/>', 1),
    flame: SV('<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z"/>', 1),
    shield: SV('<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM8 12l3 3 5-6"/>'),
    star: SV('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', 1),
    sunrise: SV('<path d="M3 18h18M6 14a6 6 0 0 1 12 0M12 4v4M5 8l2 2M19 8l-2 2"/>'),
    bolt: SV('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', 1),
    openbook: SV('<path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2zM22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/>'),
  };

  const BIG = [
    { k: "nishonchi", ic: "target", t: "Eng yaxshi nishonchi", n: "Bu o'quvchi yetarlicha vazifa qildi va eng ko'p aniqlikni qayd etdi." },
    { k: "mehnat", ic: "hammer", t: "Mehnatkashlik nishoni", n: "Bu o'quvchi hafta davomida eng ko'p savollarga javob berdi." },
    { k: "takror", ic: "loop", t: "Eng yaxshi takrorlovchi", n: "Bu o'quvchi o'tgan haftalardagi so'z va qoidalarni eng yaxshi takrorladi." },
    { k: "side", ic: "map", t: "Eng zo'r sidequestchi", n: "Bu o'quvchi erkin mashqda eng ko'p qo'shimcha savol ishladi." },
    { k: "qomondon", ic: "crown", t: "Eng zo'r qomondon", n: "Bu o'quvchi qal'a o'yinida eng ko'p o'lja to'pladi." },
  ];
  const SMALL = [
    { k: "first_quest", ic: "foot", t: "Birinchi qadam", n: "Birinchi vazifani tugatdi" },
    { k: "streak3", ic: "flame", t: "3 kunlik olov", n: "3 kun ketma-ket mashq qildi" },
    { k: "flawless", ic: "shield", t: "Xatosiz vazifa", n: "Vazifani bitta ham xatosiz tugatdi" },
    { k: "correct50", ic: "star", t: "50 ta to'g'ri", n: "Jami 50 ta savolga to'g'ri javob berdi" },
    { k: "words30", ic: "book", t: "So'z ovchisi", n: "30 ta so'zni o'rgandi" },
    { k: "early", ic: "sunrise", t: "Erta qush", n: "Vazifani muddatidan bir kun oldin tugatdi" },
    { k: "comeback", ic: "bolt", t: "Qaytmas", n: "Xato qilgan savolini qayta ishlab, to'g'ri topdi" },
    { k: "reader", ic: "openbook", t: "Kitobxon", n: "Birinchi o'qish matnini o'qidi" },
    { k: "practice20", ic: "loop", t: "Mashqchi", n: "Erkin mashqda 20 ta savol ishladi" },
    { k: "defender", ic: "castle", t: "Mustahkam qal'a", n: "Qal'a mudofaasini 5-darajaga yetkazdi" },
  ];

  /* ---------- server calls ---------- */
  let S = null;
  try { S = JSON.parse(store.get("at_session") || "null"); } catch (e) { S = null; }

  async function rpc(fn, args) {
    let r;
    try {
      r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(args || {}) });
    } catch (e) { const err = new Error("NET"); err.net = true; throw err; }
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    if (!r.ok) { const err = new Error((data && data.message) || "HTTP " + r.status); err.status = r.status; throw err; }
    return data;
  }
  async function api(fn, args) {
    try { return await rpc(fn, Object.assign({ p_token: S && S.token }, args || {})); }
    catch (e) { if (e.message === "AUTH") { signOut("Iltimos, qaytadan kiring."); } throw e; }
  }
  function errText(e) {
    if (e && e.net) return "Internet bilan muammo. Qayta urinib ko'ring.";
    const m = (e && e.message) || "";
    if (/duplicate key|unique/i.test(m)) return "Bu nom allaqachon bor.";
    if (/violates check|check constraint/i.test(m)) return "Ma'lumot noto'g'ri kiritildi.";
    return m || "Xatolik yuz berdi.";
  }
  const quiet = (e) => { if (e && e.message !== "AUTH") toast(errText(e)); };

  function signOut(msg) {
    if (S && S.token) rpc("logout", { p_token: S.token }).catch(() => {});
    S = null; store.del("at_session");
    V = { screen: "pick", msg: msg || "" }; P = null; SHEET = null;
    render();
  }

  /* ---------- view state ---------- */
  let V = { screen: "pick" };
  let P = null;          // player
  let SHEET = null;      // bottom sheet render function

  const STU_TABS = [["home", "Bosh sahifa", "home", "--hw"], ["review", "Mashq", "loop", "--rv"], ["troph", "Kuboklar", "trophy", "--tr"], ["board", "Reyting", "list", "--cw"], ["castle", "Qal'a", "castle", "--wr"]];
  const TEA_TABS = [["results", "Natijalar", "chart", "--hw"], ["assign", "Topshiriqlar", "send", "--cw"], ["report", "Hisobot", "doc", "--rv"], ["settings", "Sozlamalar", "gear", "--sub"]];

  function nav(tabs, cur) {
    return `<nav class="nav" aria-label="Asosiy bo'limlar"><div class="brand"><span class="logo">A</span>Abduqodir Teacher</div>
      ${tabs.map(([k, l, ic, c]) => `<button data-act="tab" data-v="${k}" aria-current="${cur === k}" style="--accent:var(${c})">${I[ic]}<span>${l}</span></button>`).join("")}</nav>`;
  }

  function render() {
    let h = "";
    try {
      if (!S) h = V.screen === "login" ? vLogin() : vPick();
      else if (S.role === "teacher") h = `<main class="main">${vTeacher()}</main>${nav(TEA_TABS, T.tab)}`;
      else h = `<main class="main">${vStudent()}</main>${nav(STU_TABS, ST.tab)}`;
      if (P) h += vPlay();
      if (SHEET) h += SHEET();
    } catch (e) { console.error(e); h = `<main class="main solo"><div class="card"><p class="err">Sahifada xatolik: ${esc(e.message)}</p></div></main>`; }
    app.innerHTML = h;
    afterRender();
  }

  function afterRender() {
    const f = $("#loginForm");
    if (f) f.onsubmit = (e) => { e.preventDefault(); doLogin(); };
    const inp = $("#answerInput");
    if (inp && P && !P.result) {
      inp.value = P.typed || "";
      inp.oninput = () => (P.typed = inp.value);
      inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); P.typed = inp.value; check(); } };
      if (!("ontouchstart" in window)) inp.focus();
    }
    const ta = $("#pasteBox");
    if (ta) ta.oninput = () => { T.paste = ta.value; if (T.parsed) { T.parsed = null; const s = $("#pasteSummary"); if (s) s.innerHTML = ""; } };
    const bulk = $("#bulkBox");
    if (bulk) bulk.oninput = () => (T.bulk = bulk.value);
    document.body.style.overflow = P || SHEET ? "hidden" : "";
  }

  /* ---------- login ---------- */
  function vPick() {
    return `<main class="main solo">
      <div class="row"><span class="logo" style="width:44px;height:44px;font-size:22px;border-radius:12px">A</span><h1>Abduqodir Teacher</h1></div>
      ${V.msg ? `<p class="err">${esc(V.msg)}</p>` : `<p class="sub">Kim sifatida kirasiz?</p>`}
      <div class="roles">
        <button class="tile" style="--t:var(--hw);--t-s:var(--hw-s)" data-act="role" data-v="student"><span class="ic">${I.book}</span><div><b>O'quvchi</b><p class="sub small">Vazifalar, mashq va kuboklar</p></div></button>
        <button class="tile" style="--t:var(--cw);--t-s:var(--cw-s)" data-act="role" data-v="teacher"><span class="ic">${I.class}</span><div><b>O'qituvchi</b><p class="sub small">Natijalar, topshiriqlar, hisobot</p></div></button>
      </div></main>`;
  }
  function vLogin() {
    const t = V.role === "teacher";
    return `<main class="main solo">
      <button class="btn soft sm" data-act="back" style="align-self:flex-start;background:var(--card)">${I.back} Orqaga</button>
      <h1>${t ? "O'qituvchi" : "O'quvchi"}</h1>
      <form class="card stack" id="loginForm" novalidate>
        <div><label for="lg">Login</label><input id="lg" autocomplete="username" autocapitalize="off" spellcheck="false" required></div>
        <div><label for="pw">Parol</label><input id="pw" type="password" autocomplete="current-password" required></div>
        ${V.err ? `<p class="err" role="alert">${esc(V.err)}</p>` : ""}
        <button class="btn wide" type="submit" style="--accent:var(${t ? "--cw" : "--hw"})" ${V.busy ? "disabled" : ""}>${V.busy ? "Kirilmoqda…" : "Kirish"}</button>
      </form></main>`;
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
      boot();
    } catch (e) { V.busy = false; V.err = errText(e); render(); }
  }

  /* ================= STUDENT ================= */
  const ST = { tab: "home", home: null, board: null, troph: null, castle: null, castleMsg: null };

  async function loadStudent() {
    try { ST.home = await api("student_home"); } catch (e) { quiet(e); }
    render();
  }
  function vStudent() {
    if (!ST.home) return `<div class="loading">Yuklanmoqda…</div>`;
    switch (ST.tab) {
      case "review": return vPracticeIntro();
      case "troph": return vTrophies();
      case "board": return vBoard();
      case "castle": return vCastle();
      default: return vHome();
    }
  }
  function today() { const d = new Date(); return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}-${MONTHS[d.getMonth()]}`; }

  function questPct(q) { return q.completed_at ? 100 : q.gradable ? Math.round((q.done / q.gradable) * 100) : 0; }
  function vHome() {
    const h = ST.home;
    const now = Date.now();
    const qs = h.quests || [];
    const open = qs.filter((q) => !q.completed_at), done = qs.filter((q) => q.completed_at);
    const item = (q) => {
      const pct = questPct(q);
      const late = q.deadline && new Date(q.deadline).getTime() < now && !q.completed_at;
      const doneLate = q.completed_at && q.deadline && new Date(q.completed_at) > new Date(q.deadline);
      let sub = q.deadline ? `Muddat: ${esc(fmtDate(q.deadline))}` : "Muddatsiz";
      if (late) sub = `Muddat o'tdi · hali ham bajarsa bo'ladi`;
      if (q.completed_at) sub = doneLate ? "Bajarildi · kech" : "Bajarildi";
      return `<button class="li qitem" data-act="${q.completed_at ? "noop" : "play"}" data-v="${q.id}" style="--accent:var(--hw)">
        <span class="dot" style="background:var(${q.completed_at ? "--rv" : late ? "--warn" : "--hw"});width:12px;height:12px"></span>
        <span class="grow"><b style="font-weight:600">${esc(q.title)}</b><br><span class="small ${late ? "err" : "sub"}" style="font-weight:${late ? 600 : 400}">${sub}</span>
        <div class="bar"><i style="width:${pct}%;background:var(${q.completed_at ? "--rv" : "--hw"})"></i></div></span>
        <span class="sub small num">${pct}%</span><span class="chev">${q.completed_at ? I.check : I.chev}</span></button>`;
    };
    const wk = h.week || {};
    return `<div class="hello"><div><p class="sub">${today()}</p><h1>Salom, ${esc(h.me.first_name)}</h1></div>
        <div class="stats"><span class="stat" title="Ketma-ket kunlar">${I.fire}${h.streak || 0}</span><span class="stat" title="Askarlar">${I.sword}${h.soldiers || 0}</span><span class="stat" title="O'lja">${I.coin}${h.loot == null ? 50 : h.loot}</span>
        <button class="btn soft sm" data-act="logout" aria-label="Chiqish" style="background:var(--card)">${I.out}</button></div></div>
      <p class="sub small">Bu hafta: <b>${wk.correct || 0}</b> ta to'g'ri javob · <b>${fmtTime(wk.seconds)}</b></p>
      <h2>Vazifalar</h2>
      ${open.length ? `<div class="list">${open.map(item).join("")}</div>` : `<div class="card empty">Hozircha vazifa yo'q. O'qituvchingiz bergan vazifalar shu yerda chiqadi.</div>`}
      ${done.length ? `<h3 class="sub">Bajarilganlar</h3><div class="list">${done.map(item).join("")}</div>` : ""}`;
  }

  async function loadBoard() { try { ST.board = await api("class_board"); } catch (e) { quiet(e); } render(); }
  function vBoard() {
    if (!ST.board) return `<h1>Reyting</h1><div class="loading">Yuklanmoqda…</div>`;
    if (!ST.board.length) return `<h1>Reyting</h1><div class="card empty">Reyting sinfga biriktirilgan o'quvchilar uchun ko'rinadi.</div>`;
    return `<h1>Reyting</h1><p class="sub">${esc(ST.home.me.class || "")} · bu hafta · ochko = to'g'ri javoblar</p>
      <div class="list">${ST.board.map((s, i) => `<div class="li" style="${s.me ? "background:var(--hw-s)" : ""}"><span class="num" style="width:24px;font-weight:700;color:${i < 3 && s.points > 0 ? "var(--tr)" : "var(--sub)"}">${i + 1}</span>
        <span class="grow">${esc(s.name)}${s.me ? " (siz)" : ""}</span><b class="num">${s.points}</b></div>`).join("")}</div>`;
  }

  async function loadTrophies() { try { ST.troph = await api("my_trophies"); } catch (e) { quiet(e); } render(); }
  function vTrophies() {
    if (!ST.troph) return `<h1>Kuboklar</h1><div class="loading">Yuklanmoqda…</div>`;
    const mine = ST.troph.mine || [], leaders = ST.troph.leaders || [];
    const me = (ST.home.me.first_name + " " + ST.home.me.last_name).trim();
    const big = BIG.map((b) => {
      const won = mine.filter((m) => m.kind === b.k && m.week).length;
      const lead = leaders.find((l) => l.kind === b.k);
      return `<div class="troph big ${won ? "" : "locked"}"><span class="medal">${I[b.ic]}</span><h3>${b.t}</h3><p>${b.n}</p>
        <span class="pill ${won ? "rv" : ""}">${won ? won + " marta yutilgan" : "Hali yutilmagan"}</span>
        ${lead ? `<span class="pill ${lead.name.trim() === me ? "rv" : ""}">${lead.name.trim() === me ? "Bu hafta siz yetakchisiz!" : "Bu hafta yetakchi: " + esc(lead.name)}</span>` : ""}</div>`;
    }).join("");
    const small = SMALL.map((t) => { const has = mine.some((m) => m.kind === t.k); return `<div class="troph small ${has ? "" : "locked"}"><span class="medal">${I[t.ic]}</span><h3>${t.t}</h3><p>${t.n}</p></div>`; }).join("");
    return `<div class="row between"><h1>Kuboklar</h1><span class="pill">${mine.length} ta yig'ildi</span></div>
      <p class="sub">Katta kuboklar har dushanba o'tgan hafta g'oliblariga beriladi.</p>
      <div class="trophies">${big}</div><h2>Kichik kuboklar</h2><div class="trophies">${small}</div>`;
  }

  async function loadCastle() { try { ST.castle = await api("castle_state"); } catch (e) { quiet(e); } render(); }
  function vCastle() {
    const c = ST.castle;
    if (!c) return `<h1>Qal'a</h1><div class="loading">Yuklanmoqda…</div>`;
    const me = c.me, msg = ST.castleMsg, h = 70 + Math.min(me.defense, 20) * 4;
    return `<h1>Qal'a</h1>
      <div class="grid2"><section class="card stack"><h3>Mening qal'am</h3>
        <div class="castle" aria-hidden="true"><div class="tower" style="height:${h}px"></div><div class="keep"><span class="flagpole"></span></div><div class="tower" style="height:${h}px"></div></div><div class="ground"></div>
        <div class="row"><span class="pill hw">Mudofaa: ${me.defense}</span><span class="pill wr">O'lja: ${me.loot}</span></div>
        <button class="btn soft sm" data-act="defend" ${me.soldiers < 5 || me.defense >= 20 ? "disabled" : ""}>Mudofaani kuchaytirish · 5 askar</button></section>
      <section class="card stack"><h3>Askarlar: <span class="num">${me.soldiers}</span></h3>
        <div class="army">${Array.from({ length: Math.min(me.soldiers, 80) }, () => '<span class="soldier"></span>').join("")}</div>
        <p class="sub small">Har to'g'ri javob = 1 askar. Hujum 10 askar, mudofaa 5 askar. Vazifani tugatsangiz +20 o'lja.</p></section></div>
      ${msg ? `<div class="fb ${msg.ok ? "good" : "bad"}" role="status"><b>${esc(msg.t)}</b></div>` : ""}
      <h2>Hujum qilish</h2>
      ${c.others.length ? `<div class="list">${c.others.map((o) => `<div class="li" style="flex-wrap:wrap"><span class="grow" style="min-width:120px">${esc(o.name)}<br><span class="sub small">Mudofaa ${o.defense} · O'lja ${o.loot}</span></span>
        <button class="btn sm" style="--accent:var(--tr)" data-act="attack" data-v="${o.id}" ${me.soldiers < 10 || o.cooldown ? "disabled" : ""}>${o.cooldown ? "1 soat kuting" : "Hujum"}</button></div>`).join("")}</div>` : `<div class="card empty">Sinfingizda boshqa o'quvchi yo'q.</div>`}
      ${c.log.length ? `<h3>So'nggi janglar</h3><div class="card stack">${c.log.map((l) => `<p class="small">${l.mine ? (l.win ? `${esc(l.other)}ning qal'asidan <b>${l.loot}</b> o'lja oldingiz.` : `${esc(l.other)}ning qal'asi chidadi.`) : (l.win ? `${esc(l.other)} qal'angizdan <b>${l.loot}</b> o'lja oldi.` : `${esc(l.other)} hujum qildi, qal'angiz chidadi.`)}</p>`).join("")}</div>` : ""}`;
  }

  function vPracticeIntro() {
    return `<h1>Mashq</h1><p class="sub">Vazifalar tugadimi? O'tgan so'z va savollar aralash chiqadi, xatolaringiz ko'proq chiqadi.</p>
      <section class="card stack"><div class="row between"><h3>Erkin mashq</h3><span class="pill rv">Cheksiz</span></div>
      <p class="sub small">Har to'g'ri javob = 1 askar.</p>
      <button class="btn" style="--accent:var(--rv)" data-act="practice">Boshlash</button></section>`;
  }

  /* ---------- player ---------- */
  async function startQuest(id, preview) {
    P = { loading: true, preview: !!preview, accent: "--hw" }; render();
    try {
      const q = await api("get_quest", { p_quest: Number(id) });
      const byId = {}; q.steps.forEach((s) => (byId[s.id] = s));
      let st = q.state;
      const ok = st && Array.isArray(st.order) && st.order.every((x) => byId[x]) && typeof st.i === "number";
      if (!ok || preview) st = { order: q.steps.map((s) => s.id), i: 0, final: [], tries: {} };
      st.final = st.final || []; st.tries = st.tries || {};
      P = { quest: q, byId, state: st, preview: !!preview, right: 0, answered: 0, accent: "--hw" };
      loadStep();
    } catch (e) { if (e.message === "AUTH") return; P = { error: errText(e), accent: "--hw" }; }
    render();
  }
  async function startPractice() {
    P = { practice: true, loading: true, right: 0, answered: 0, accent: "--rv" }; render();
    await nextPractice();
  }
  async function nextPractice() {
    P.loading = true; render();
    try {
      const q = await api("practice_next");
      if (q && q.empty) { P.empty = true; P.loading = false; render(); return; }
      P.cur = q; P.loading = false; loadStep();
    } catch (e) { if (e.message === "AUTH") return; P.error = errText(e); P.loading = false; }
    render();
  }
  function curStep() { return P.practice ? P.cur : P.byId[P.state.order[P.state.i]]; }
  function loadStep() {
    P.sel = null; P.pick = []; P.typed = ""; P.result = null; P.busy = false; P.offline = false; P.reportOpen = false; P.reportSent = false;
    const s = P.practice ? P.cur : P.state.i < P.state.order.length ? curStep() : null;
    P.opts = s && s.opts ? (s.t === "tf" ? s.opts.slice() : shuffle(s.opts)) : null;
    P.t0 = Date.now();
  }
  function circleName(c) { const cs = P.quest && P.quest.circles; return cs && cs[c] ? cs[c].name : ""; }

  function vPlay() {
    const top = (pct, label) => `<div class="p-top"><button class="x" data-act="quit" aria-label="Chiqish">${I.x}</button><div class="p-prog"><i style="width:${pct}%"></i></div>${label ? `<span class="pill" style="max-width:40%;overflow:hidden;text-overflow:ellipsis">${esc(label)}</span>` : ""}</div>`;
    const shell = (inner, foot, pct, label) => `<div class="player" style="--accent:var(${P.accent || "--hw"})" role="dialog" aria-label="Vazifa">${top(pct || 0, label)}<div class="p-body">${inner}</div><div class="p-foot">${foot || ""}</div></div>`;
    if (P.error) return shell(`<div class="card"><p class="err">${esc(P.error)}</p></div>`, `<button class="btn wide" data-act="quit">Orqaga</button>`);
    if (P.practice && P.empty) return shell(`<h2>Hozircha mashq uchun savol yo'q</h2><p class="sub">Birinchi vazifani boshlang. O'rgangan so'z va savollaringiz shu yerda takrorlanadi.</p>`, `<button class="btn wide" data-act="quit">Orqaga</button>`);
    if (P.loading || (!P.quest && !P.practice) || (P.practice && !P.cur)) return shell(`<div class="loading">Yuklanmoqda…</div>`);

    let pct = 0, label = "";
    if (P.practice) { label = `${P.right} / ${P.answered} to'g'ri`; pct = 100; }
    else {
      const g = P.quest.steps.filter((s) => s.g).length;
      pct = g ? Math.round((P.state.final.length / g) * 100) : 0;
      if (P.preview) label = "Sinov rejimi";
    }
    if (!P.practice && P.state.i >= P.state.order.length) {
      const acc = P.answered ? Math.round((P.right / P.answered) * 100) : null;
      return shell(`<div class="stack" style="align-items:center;text-align:center;margin-top:8vh">${ring(100, "var(--hw)", 96)}<h1>Vazifa tugadi!</h1>
        ${acc !== null ? `<p class="sub">Bu safargi aniqlik: <b>${acc}%</b></p>` : ""}<p class="sub">Barakalla! Natijangiz saqlandi.</p></div>`,
        `<button class="btn wide" data-act="quit">Bosh sahifaga qaytish</button>`, 100, label);
    }
    const s = curStep();
    if (!P.practice) label = label || circleName(s.c);
    const locked = !!P.result || P.busy;
    const passage = s.p && P.byId && P.byId[s.p] ? `<details class="pbox"><summary>Matnni ko'rish: ${esc(P.byId[s.p].title)}</summary><div class="passage" data-nocopy>${esc(P.byId[s.p].text)}</div></details>` : "";
    let body = "";
    if (s.t === "card") {
      body = `<div class="concept"><span class="p-kind">${s.rv ? "Takrorlash" : "Yangi qoida"}</span><p class="p-q">${esc(s.title)}</p><div class="body">${esc(s.body)}</div></div>`;
    } else if (s.t === "word") {
      body = `<div class="wordcard"><span class="p-kind">Yangi so'z</span><span class="en">${esc(s.en)}</span><span class="uz">${esc(s.uz)}</span>${s.ex ? `<p style="font-size:18px">${esc(s.ex)}</p>` : ""}</div>`;
    } else if (s.t === "read") {
      body = `<span class="p-kind">O'qish</span><p class="p-q">${esc(s.title)}</p><div class="passage" data-nocopy>${esc(s.text)}</div>`;
    } else if (s.t === "choice" || s.t === "tf") {
      const kind = s.rv ? "Takrorlash" : s.t === "tf" ? "To'g'rimi?" : s.p ? "Matn bo'yicha savol" : "Savol";
      body = `${passage}<span class="p-kind">${kind}</span><p class="p-q noselect">${esc(s.q)}</p>
        <div class="opts ${s.t === "tf" ? "two" : ""}">${P.opts.map((o, i) => {
          let c = "";
          if (P.result) { if (P.result.ok && i === P.sel) c = "right"; else if (!P.result.ok && i === P.sel) c = "wrong"; else if (!P.result.ok && P.result.right && o === P.result.right) c = "right"; }
          return `<button class="opt ${c}" aria-pressed="${P.sel === i}" data-act="sel" data-v="${i}" ${locked ? "disabled" : ""}>${esc(o)}</button>`;
        }).join("")}</div>`;
    } else if (s.t === "gap") {
      body = `${passage}<span class="p-kind">Bo'sh joyni to'ldiring</span>
        <div class="gapline noselect"><span>${esc(s.before)}</span><input id="answerInput" aria-label="Javob" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" ${locked ? "disabled" : ""}><span>${esc(s.after)}</span></div>
        ${s.hint ? `<p class="sub">Yordam: ${esc(s.hint)}</p>` : ""}<p class="sub small">Katta-kichik harf xato hisoblanmaydi.</p>`;
    } else if (s.t === "spell") {
      body = `<span class="p-kind">${s.rv ? "Takrorlash · " : ""}Inglizchasini yozing</span><p class="p-q">${esc(s.uz)}</p>
        <input id="answerInput" class="bigin" aria-label="Inglizcha so'z" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="${esc(s.hint)}…" ${locked ? "disabled" : ""}>
        <p class="sub small">Birinchi harf: <b>${esc(s.hint)}</b></p>`;
    } else if (s.t === "order" || s.t === "letters") {
      const items = s.t === "order" ? s.words : s.L, lc = s.t === "letters" ? "letter" : "";
      body = `<span class="p-kind">${s.t === "order" ? "So'zlarni tartiblang" : "Harflardan so'z yasang"}</span><p class="p-q">${esc(s.t === "order" ? s.uz || "Gapni tuzing" : s.uz)}</p>
        <div class="slot" aria-label="Javobingiz">${P.pick.length ? P.pick.map((w, i) => `<button class="chip ${lc}" data-act="unpick" data-v="${i}" ${locked ? "disabled" : ""}>${esc(items[w])}</button>`).join("") : `<span class="sub">${s.t === "order" ? "So'zlarni bosing" : "Harflarni bosing"}</span>`}</div>
        <div class="chips">${items.map((w, i) => `<button class="chip ${lc} ${P.pick.includes(i) ? "used" : ""}" data-act="pick" data-v="${i}" ${locked ? "disabled" : ""}>${esc(w)}</button>`).join("")}</div>`;
    }
    let foot = "";
    if (P.offline) foot += `<div class="fb bad" role="status"><b>Internet yo'q</b>Javobingiz saqlangan. Internet qaytishi bilan avtomatik yuboriladi.</div>`;
    if (s.t === "card" || s.t === "word" || s.t === "read") {
      foot += `<button class="btn wide" data-act="next" ${P.busy ? "disabled" : ""}>${s.t === "card" ? "Tushundim" : s.t === "word" ? "Yodladim" : "O'qidim"}</button>`;
    } else if (P.result) {
      foot += `<div class="fb ${P.result.ok ? "good" : "bad"}" role="status"><b>${P.result.ok ? "To'g'ri!" : "Hechqisi yo'q, keling tushunib olamiz"}</b>
        ${!P.result.ok && P.result.right ? `To'g'ri javob: <b style="display:inline">${esc(P.result.right)}</b><br>` : ""}${P.result.why ? esc(P.result.why) : ""}
        ${!P.result.ok && P.result.again ? `<br><span class="sub small">Bu savol keyinroq yana chiqadi.</span>` : ""}</div>
        <button class="btn wide" style="--accent:var(${P.result.ok ? "--rv" : P.accent})" data-act="cont">Davom etish</button>`;
    } else {
      foot += `<button class="btn wide" data-act="check" ${P.busy ? "disabled" : ""}>${P.busy ? "Tekshirilmoqda…" : "Tekshirish"}</button>`;
    }
    if (!P.practice && !P.preview && s.g && s.t !== "card") {
      if (P.reportSent) foot += `<p class="ok small" style="text-align:center">Rahmat! Xabaringiz o'qituvchiga yuborildi.</p>`;
      else if (P.reportOpen) body += `<div class="card stack"><label for="repNote">Savolda nima xato? (ixtiyoriy)</label><textarea id="repNote" style="min-height:80px" maxlength="500"></textarea>
          <div class="row"><button class="btn sm" data-act="repSend">Yuborish</button><button class="btn soft sm" data-act="repToggle">Bekor qilish</button></div></div>`;
      else if (!P.result) foot += `<button class="link small" style="align-self:center;color:var(--sub)" data-act="repToggle">Bu savolda xato bormi?</button>`;
    }
    return shell(body, foot, pct, label);
  }

  function retryLater(fn) {
    const myP = P;
    P.offline = true; P.busy = true; render();
    setTimeout(() => { if (P !== myP) return; P.busy = false; fn(); }, 4000);
  }
  async function nextCard() {
    if (P.busy) return;
    const s = curStep();
    const st = clone(P.state); st.i += 1;
    if (s.g && !st.final.includes(s.id)) st.final.push(s.id);
    P.busy = true; render();
    try {
      if (!P.preview) await api("advance", { p_quest: P.quest.id, p_step: s.id, p_answer: "", p_ms: Date.now() - P.t0, p_state: st });
      P.state = st; loadStep();
    } catch (e) { if (e.net) { retryLater(nextCard); return; } P.busy = false; quiet(e); }
    render(); const b = $(".p-body"); if (b) b.scrollTop = 0;
  }
  function currentAnswer(s) {
    if (s.t === "choice" || s.t === "tf") return P.sel == null ? "" : P.opts[P.sel];
    if (s.t === "gap" || s.t === "spell") { const el = $("#answerInput"); return ((el ? el.value : "") || P.typed || "").trim(); }
    if (s.t === "order") return P.pick.map((i) => s.words[i]).join(" ");
    if (s.t === "letters") return P.pick.map((i) => s.L[i]).join("");
    return "";
  }
  async function check() {
    if (!P || P.busy || P.result) return;
    const s = curStep();
    const ans = currentAnswer(s);
    if (!ans) { toast(s.t === "choice" || s.t === "tf" ? "Avval javobni tanlang" : s.t === "order" || s.t === "letters" ? "Avval bo'laklarni joylang" : "Avval javobni yozing"); return; }
    if ((s.t === "order" && P.pick.length < s.words.length) || (s.t === "letters" && P.pick.length < s.L.length)) { toast("Hamma bo'laklarni joylang"); return; }
    P.typed = ans;
    if (P.practice) {
      P.busy = true; render();
      let res;
      try { res = await api("practice_answer", { p_answer: ans, p_ms: Date.now() - P.t0 }); }
      catch (e) { if (e.net) { retryLater(check); return; } P.busy = false; quiet(e); render(); return; }
      P.busy = false; P.offline = false;
      if (res && res.error) { nextPractice(); return; }
      P.answered += 1; if (res.ok) { P.right += 1; if (ST.home) ST.home.soldiers = (ST.home.soldiers || 0) + 1; }
      P.result = res; render(); return;
    }
    const tries = (P.state.tries[s.id] || 0) + 1;
    const ifRight = clone(P.state);
    ifRight.tries[s.id] = tries;
    if (!ifRight.final.includes(s.id)) ifRight.final.push(s.id);
    ifRight.i += 1;
    P.busy = true; render();
    let res;
    try { res = await api("advance", { p_quest: P.quest.id, p_step: s.id, p_answer: ans, p_ms: Date.now() - P.t0, p_state: P.preview ? null : ifRight }); }
    catch (e) { if (e.net) { retryLater(check); return; } P.busy = false; quiet(e); render(); return; }
    P.busy = false; P.offline = false;
    P.answered += 1; if (res.ok) P.right += 1;
    if (res.ok) P.next = ifRight;
    else {
      const st = clone(P.state);
      st.tries[s.id] = tries;
      if (tries >= 2) { if (!st.final.includes(s.id)) st.final.push(s.id); }
      else {
        let j = st.i + 1;
        while (j < st.order.length && P.byId[st.order[j]].c === s.c) j++;
        st.order.splice(j, 0, s.id);
        res.again = true;
      }
      st.i += 1;
      P.next = st;
      if (!P.preview) api("save_state", { p_quest: P.quest.id, p_state: st }).catch(() => {});
    }
    P.result = res; render();
  }
  function cont() {
    if (P.practice) { nextPractice(); return; }
    P.state = P.next; P.next = null; loadStep(); render();
    const b = $(".p-body"); if (b) b.scrollTop = 0;
  }
  async function sendReport() {
    const s = curStep(), el = $("#repNote");
    try {
      const r = await api("report_problem", { p_quest: P.quest.id, p_step: s.id, p_note: el ? el.value.trim() : "" });
      if (r && r.error) { toast("Bugun juda ko'p xabar yuborildi."); return; }
      P.reportOpen = false; P.reportSent = true; render();
    } catch (e) { quiet(e); }
  }
  function quitPlayer() {
    const wasPreview = P && P.preview;
    P = null;
    if (S.role === "teacher") { render(); if (!wasPreview) loadAdmin(); }
    else loadStudent();
  }

  /* ================= TEACHER ================= */
  const T = { tab: "results", me: null, data: null, cls: null, week: strFromDay(mondayOf(new Date())), report: null, reportKey: "",
    filter: "all", paste: "", parsed: null, poolPick: {}, bulk: "", bulkCls: "", bulkPool: "", bulkResult: null,
    confirm: "", editName: null, pwFor: null, openStudents: null, saving: false, pwMsg: null, sub: null, teachers: null,
    showMonthly: false, monthly: null, monthlyCls: null, problems: [] };

  async function loadAdmin() {
    try {
      const [me, data] = await Promise.all([api("teacher_me"), api("admin_data")]);
      T.me = me; T.data = data;
      if (!T.cls || !data.classes.some((c) => c.id === T.cls)) T.cls = data.classes.length ? data.classes[0].id : null;
      T.problems = data.problems ? await api("admin_problems") : [];
    } catch (e) { quiet(e); }
    render();
    if (T.tab === "results" || T.tab === "report") loadReport();
  }
  async function loadReport(force) {
    if (!T.cls) return;
    const key = T.cls + "|" + T.week;
    if (!force && T.reportKey === key && T.report) return;
    T.reportKey = key; T.report = null; render();
    try { const r = await api("admin_report", { p_class: T.cls, p_week: T.week }); if (T.reportKey === key) { T.report = r; render(); } }
    catch (e) { quiet(e); }
  }
  const className = (id) => { const c = T.data && T.data.classes.find((x) => x.id === id); return c ? c.name : ""; };
  const opts = (list, sel, none) => (none !== undefined ? `<option value="">${esc(none)}</option>` : "") + list.map((x) => `<option value="${x.id}" ${x.id === sel ? "selected" : ""}>${esc(x.name)}</option>`).join("");
  const classSeg = () => T.data.classes.length ? `<div class="seg" role="group" aria-label="Sinf">${T.data.classes.map((c) => `<button aria-pressed="${T.cls === c.id}" data-act="cls" data-v="${c.id}">${esc(c.name)}</button>`).join("")}</div>` : "";

  function vTeacher() {
    if (!T.data) return `<div class="loading">Yuklanmoqda…</div>`;
    const banner = T.me && T.me.acting ? `<div class="banner"><span>Siz hozir <b>${esc(T.me.acting.name)}</b> sahifasini ko'ryapsiz</span><button class="btn sm" style="--accent:var(--amber)" data-act="actAs" data-v="">O'zimga qaytish</button></div>` : "";
    let body;
    if (T.tab === "assign") body = vAssign();
    else if (T.tab === "report") body = vReport();
    else if (T.tab === "settings") body = vSettings();
    else body = vResults();
    return banner + body;
  }

  /* results */
  function vResults() {
    const d = T.data;
    const head = `<div class="row between"><h1>Natijalar</h1><button class="btn soft sm" data-act="logout" style="background:var(--card)">${I.out} Chiqish</button></div>`;
    if (!d.classes.length) return head + `<div class="card empty">Avval Sozlamalar → Sinflar, pullar, o'quvchilar bo'limida sinf yarating.</div>`;
    const thisWeek = strFromDay(mondayOf(new Date()));
    const weekNav = `<div class="row"><button class="btn soft sm" style="background:var(--card)" data-act="week" data-v="-1" aria-label="Oldingi hafta">${I.back}</button><b class="small">${esc(weekLabel(T.week))}</b>
      <button class="btn soft sm" style="background:var(--card)" data-act="week" data-v="1" aria-label="Keyingi hafta" ${T.week >= thisWeek ? "disabled" : ""}>${I.chev}</button></div>`;
    const probs = T.problems.length ? `<button class="banner" style="border:0;cursor:pointer;background:var(--warn-s);color:var(--warn);font:inherit;font-weight:600;font-size:14px;text-align:left" data-act="tab" data-v="assign">${T.problems.length} ta savol bo'yicha o'quvchilar xato haqida xabar berdi ›</button>` : "";
    if (!T.report) return head + probs + classSeg() + weekNav + `<div class="loading">Yuklanmoqda…</div>`;
    const rows = T.report.rows || [];
    const byPool = {};
    rows.forEach((r) => { const k = r.pool || "Pulsiz"; (byPool[k] = byPool[k] || []).push(r); });
    const groups = Object.keys(byPool).sort().map((p) => `<h3>${esc(p)} · ${byPool[p].length} o'quvchi</h3><div class="list">${byPool[p].sort((a, b) => (b.pct || 0) - (a.pct || 0)).map((r) => `
      <div class="li">${ring(r.pct, "var(--hw)", 46)}<span class="grow"><b style="font-weight:600">${esc(r.first_name + " " + r.last_name)}</b><br>
        <span class="sub small">${r.quests ? `${r.finished}/${r.quests} vazifa` : "Vazifa yo'q"} · ${fmtTime(r.seconds)} · aniqlik ${r.answered ? Math.round((r.correct / r.answered) * 100) + "%" : "—"}</span>
        ${r.late ? ` <span class="pill amber">${r.late} kech</span>` : ""}${r.flag ? `<div class="flag ${r.flag.kind}" style="margin-top:6px">${esc(r.flag.text)}</div>` : ""}</span></div>`).join("")}</div>`).join("");
    return head + probs + classSeg() + weekNav + (rows.length ? groups : `<div class="card empty">Bu sinfda hali o'quvchi yo'q.</div>`) +
      `<p class="sub small">Doira: shu haftaga muddati qo'yilgan vazifalarning bajarilgan qismi. Batafsil grafiklar keyingi bosqichda qo'shiladi.</p>`;
  }

  /* report */
  function vReport() {
    const d = T.data;
    if (!d.classes.length) return `<h1>Hisobot</h1><div class="card empty">Avval sinf yarating.</div>`;
    const thisWeek = strFromDay(mondayOf(new Date()));
    const lastWeek = (() => { const x = dayFromStr(thisWeek); x.setDate(x.getDate() - 7); return strFromDay(x); })();
    const head = `<div class="row between"><h1>Hisobot</h1><div class="seg" role="group" aria-label="Hafta"><button aria-pressed="${T.week === thisWeek}" data-act="setweek" data-v="${thisWeek}">Bu hafta</button><button aria-pressed="${T.week === lastWeek}" data-act="setweek" data-v="${lastWeek}">O'tgan hafta</button></div></div>` + classSeg();
    if (!T.report) return head + `<div class="loading">Yuklanmoqda…</div>`;
    const rows = (T.report.rows || []).slice().sort((a, b) => b.correct - a.correct || (b.pct || 0) - (a.pct || 0));
    if (!rows.length) return head + `<div class="card empty">Bu sinfda hali o'quvchi yo'q.</div>`;
    const withHw = rows.filter((r) => r.pct != null);
    const avgPct = withHw.length ? Math.round(withHw.reduce((a, r) => a + r.pct, 0) / withHw.length) : null;
    const avgTime = Math.round(rows.reduce((a, r) => a + r.seconds, 0) / rows.length);
    const totAns = rows.reduce((a, r) => a + r.answered, 0), totCor = rows.reduce((a, r) => a + r.correct, 0);
    const winners = T.report.winners || [];
    return head + `<section class="card stack">
      <div class="row between"><div><h2>${esc(className(T.cls))} sinf · haftalik natijalar</h2><p class="sub small">${esc(weekLabel(T.week))} · ${rows.length} o'quvchi</p></div><span class="row"><span class="logo">A</span><b>Abduqodir Teacher</b></span></div>
      <div class="kpis"><div class="kpi"><b>${avgPct == null ? "—" : avgPct + "%"}</b><span>O'rtacha vazifa</span></div><div class="kpi"><b>${fmtTime(avgTime)}</b><span>O'rtacha vaqt</span></div>
        <div class="kpi"><b>${totAns ? Math.round((totCor / totAns) * 100) + "%" : "—"}</b><span>O'rtacha aniqlik</span></div><div class="kpi"><b>${totAns}</b><span>Jami javoblar</span></div></div>
      ${winners.length ? `<div class="winners">${winners.map((w) => { const b = BIG.find((x) => x.k === w.kind) || {}; return `<div class="winner"><span class="t">${I[b.ic] || ""}${esc(b.t || w.kind)}</span><span class="n">${esc(w.name)}</span><p>${esc(b.n || "")}</p></div>`; }).join("")}</div>` : ""}
      <div class="tablebox" style="background:var(--card)"><table class="wide-table"><thead><tr><th>#</th><th>O'quvchi</th><th class="c">Uy vazifasi</th><th class="c">Aniqlik</th><th>Tugatgan</th><th>Vaqt</th><th>Izoh</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td class="num sub">${i + 1}</td><td><b style="font-weight:600">${esc(r.first_name + " " + r.last_name)}</b><br><span class="sub small">${esc(r.pool || "")}</span></td>
        <td class="c">${ring(r.pct, "var(--hw)", 46)}</td><td class="c">${ring(r.answered ? Math.round((r.correct / r.answered) * 100) : null, "var(--rv)", 46)}</td>
        <td class="num">${r.quests ? `${r.finished} / ${r.quests}` : "—"}${r.late ? ` <span class="pill amber">${r.late} kech</span>` : ""}</td><td class="num">${fmtTime(r.seconds)}</td>
        <td>${r.flag ? `<div class="flag ${r.flag.kind}">${esc(r.flag.text)}</div>` : `<span class="sub">—</span>`}</td></tr>`).join("")}
      </tbody></table></div>
      <p class="sub small">Doira to'la bo'lsa, o'quvchi shu haftaning barcha vazifalarini bajargan. Izohlar faqat bir xil holat bir necha marta takrorlanganda qo'yiladi.</p></section>
      ${vMonthly()}`;
  }
  async function loadMonthly() { try { T.monthly = await api("admin_monthly", { p_class: T.cls }); T.monthlyCls = T.cls; } catch (e) { quiet(e); } render(); }
  function vMonthly() {
    if (!T.showMonthly) return `<button class="btn soft" style="background:var(--card);align-self:flex-start" data-act="monthly">Oylik natijalar</button>`;
    if (!T.monthly || T.monthlyCls !== T.cls) return `<div class="loading">Yuklanmoqda…</div>`;
    if (!T.monthly.length) return `<div class="card empty">Oylik natijalar har oy oxirida saqlanadi.</div>`;
    return `<section class="card stack"><h3>Oylik natijalar</h3><div class="tablebox"><table class="wide-table"><thead><tr><th>Oy</th><th>O'quvchi</th><th>Vazifa</th><th>Vaqt</th><th>Aniqlik</th></tr></thead><tbody>
      ${T.monthly.map((m) => { const d = dayFromStr(m.month); return `<tr><td>${MONTHS[d.getMonth()]} ${d.getFullYear()}</td><td>${esc(m.name)}</td><td class="num">${m.pct == null ? "—" : m.pct + "%"}</td><td class="num">${fmtTime(m.seconds)}</td><td class="num">${m.answered ? Math.round((m.correct / m.answered) * 100) + "%" : "—"}</td></tr>`; }).join("")}
      </tbody></table></div></section>`;
  }

  /* assign */
  function scriptsFor(text, parsed) {
    const lines = text.replace(/\r/g, "").split("\n");
    return parsed.quests.map((q, i) => lines.slice(q.line - 1, i + 1 < parsed.quests.length ? parsed.quests[i + 1].line - 1 : lines.length).join("\n").trim());
  }
  function vAssign() {
    const d = T.data, pr = T.parsed;
    let summary = "";
    if (pr) {
      if (pr.errors.length) summary = `<div class="fb bad"><b>Xatolar bor, tuzating:</b><ul class="errlist">${pr.errors.map((e) => `<li>${e.line}-qator: ${esc(e.msg)}</li>`).join("")}</ul></div>`;
      else {
        const total = pr.quests.reduce((a, q) => a + q.gradable, 0);
        summary = `<div class="fb good"><b>${pr.quests.length} ta vazifa · ${total} ta savol tayyor</b></div>
          <div class="list">${pr.quests.map((q, i) => {
            const missing = q.pool && !d.pools.some((p) => p.name.toLowerCase() === q.pool.toLowerCase());
            return `<div class="li" style="flex-wrap:wrap"><span class="grow" style="min-width:180px"><b style="font-weight:600">${esc(q.title)}</b><br><span class="sub small">${q.circles.length} doira · ${q.gradable} savol</span>${missing ? `<br><span class="err small">"${esc(q.pool)}" nomli pul topilmadi</span>` : ""}</span>
              <select data-chg="poolPick" data-v="${i}" aria-label="Pul" style="max-width:220px">${opts(d.pools, T.poolPick[i] ? Number(T.poolPick[i]) : null, "— pulni tanlang —")}</select></div>`;
          }).join("")}</div>
          <button class="btn" style="--accent:var(--rv)" data-act="saveQuests" ${T.saving ? "disabled" : ""}>${T.saving ? "Saqlanmoqda…" : "Hammasini saqlash"}</button>`;
      }
    }
    const probs = T.problems.length ? `<section class="card stack"><h3>O'quvchilar xabar bergan savollar · ${T.problems.length}</h3>
      ${T.problems.map((r) => `<div class="fb bad"><p><b style="display:inline">${esc(r.quest)}</b> · ${esc(r.student)} · ${esc(fmtDate(r.at))}</p><p>Savol: <i>${esc(r.text || r.step)}</i></p>${r.note ? `<p>Izoh: ${esc(r.note)}</p>` : ""}
        <div class="row" style="margin-top:6px"><button class="btn soft sm" data-act="preview" data-v="${r.quest_id}">Vazifani ko'rish</button><button class="btn sm" data-act="probDone" data-v="${r.id}">Ko'rib chiqildi</button></div></div>`).join("")}</section>` : "";
    const list = d.quests.length ? d.quests.map((q) => {
      const conf = T.confirm === "del-q:" + q.id, open = T.openStudents === q.id, indiv = q.students || [];
      return `<section class="card stack">
        <div class="row between"><h3>${esc(q.title)}</h3><div class="row">${q.problems ? `<span class="pill warn">${q.problems} xabar</span>` : ""}${q.hidden ? `<span class="pill">Yashirin</span>` : ""}<span class="pill rv">${q.finished} tugatdi</span></div></div>
        <div class="grid2"><div><label for="qp-${q.id}">Pul</label><select id="qp-${q.id}" data-chg="qPool" data-v="${q.id}">${opts(d.pools, q.pool_id, "— faqat alohida o'quvchilar —")}</select></div>
          <div><label for="qd-${q.id}">Muddat</label><div class="row" style="flex-wrap:nowrap"><input id="qd-${q.id}" type="datetime-local" value="${esc(toLocalInput(q.deadline))}" data-chg="qDeadline" data-v="${q.id}">
            ${q.deadline ? `<button class="btn soft sm" data-act="qNoDeadline" data-v="${q.id}" aria-label="Muddatni olib tashlash">${I.x}</button>` : ""}</div></div></div>
        <div class="row"><label class="row" style="margin:0;gap:8px;color:var(--ink);font-size:15px;font-weight:500"><input type="checkbox" data-chg="qHidden" data-v="${q.id}" ${q.hidden ? "checked" : ""}> O'quvchilardan yashirish</label>
          <span class="sub small">${q.gradable} savol · ${(q.circles || []).length} doira · ${esc(fmtDate(q.created_at))}</span></div>
        <div class="row"><button class="btn sm" style="--accent:var(--cw)" data-act="preview" data-v="${q.id}">Sinab ko'rish</button>
          <button class="btn soft sm" data-act="indiv" data-v="${q.id}">Alohida o'quvchilar · ${indiv.length}</button>
          <button class="btn ${conf ? "danger" : "soft"} sm" data-act="delQuest" data-v="${q.id}">${conf ? "Rostdan o'chirish" : "O'chirish"}</button></div>
        ${open ? `<div class="stack"><div class="checklist">${d.students.map((s) => `<label><input type="checkbox" class="indiv-box" value="${s.id}" ${indiv.includes(s.id) ? "checked" : ""}> ${esc(s.first_name + " " + s.last_name)} <span class="sub small">${esc(className(s.class_id))}</span></label>`).join("")}</div>
          <div class="row"><button class="btn sm" data-act="indivSave" data-v="${q.id}">Saqlash</button><button class="btn soft sm" data-act="indiv" data-v="${q.id}">Yopish</button></div></div>` : ""}
      </section>`;
    }).join("") : `<div class="card empty">Hali vazifa yo'q. Yuqoriga kod joylab qo'shing.</div>`;
    return `<h1>Topshiriqlar</h1>${probs}
      <section class="card stack"><h3>Yangi vazifa qo'shish</h3><p class="sub small">Kodni joylang. Bir yo'la butun haftani joylash mumkin.</p>
        <textarea id="pasteBox" class="code" aria-label="Vazifa kodi" placeholder="@quest Unit 4 · Oila&#10;@circle Kimning?&#10;...">${esc(T.paste)}</textarea>
        <div class="row"><button class="btn" style="--accent:var(--cw)" data-act="parse">Tekshirish</button></div>
        <div id="pasteSummary" class="stack">${summary}</div></section>
      <h2>Vazifalar</h2>${list}`;
  }

  /* settings */
  function vSettings() {
    if (T.sub === "people") return vPeople();
    if (T.sub === "pw") return vPassword();
    if (T.sub === "teachers") return vTeachers();
    const isAdmin = T.me && T.me.is_admin;
    return `<h1>Sozlamalar</h1>
      <div class="list">
        <button class="li" data-act="sub" data-v="people"><span class="sub">${I.users}</span><span class="grow">Sinflar, pullar, o'quvchilar<br><span class="sub small">Qo'shish, ko'chirish, parolni tiklash</span></span><span class="chev">${I.chev}</span></button>
        <button class="li" data-act="sub" data-v="pw"><span class="sub">${I.key}</span><span class="grow">Parolni o'zgartirish</span><span class="chev">${I.chev}</span></button>
        <button class="li" data-act="logout"><span class="sub">${I.out}</span><span class="grow">Chiqish</span></button>
      </div>
      <p class="sub small">Dars jadvali keyingi bosqichda shu yerga qo'shiladi.</p>
      ${isAdmin ? `<button class="link" style="align-self:flex-start;color:var(--sub)" data-act="sub" data-v="teachers">O'qituvchilarni boshqarish</button>` : ""}`;
  }
  const backBtn = () => `<button class="btn soft sm" style="background:var(--card);align-self:flex-start" data-act="sub" data-v="">${I.back} Sozlamalar</button>`;

  function vPassword() {
    return `${backBtn()}<h1>Parolni o'zgartirish</h1><section class="card stack" style="max-width:460px">
      <div><label for="op">Hozirgi parol</label><input id="op" type="password" autocomplete="current-password"></div>
      <div><label for="np">Yangi parol (kamida 8 belgi)</label><input id="np" type="password" autocomplete="new-password"></div>
      <div><label for="np2">Yangi parolni takrorlang</label><input id="np2" type="password" autocomplete="new-password"></div>
      ${T.pwMsg ? `<p class="${T.pwMsg.ok ? "ok" : "err"}">${esc(T.pwMsg.t)}</p>` : ""}
      <button class="btn" data-act="changePw">Saqlash</button></section>`;
  }

  function nameList(kind) {
    const list = kind === "class" ? T.data.classes : T.data.pools;
    return `<section class="card stack"><div><h3>${kind === "class" ? "Sinflar" : "Pullar"}</h3><p class="sub small">${kind === "class" ? "Sinf hisobot va reyting uchun." : "Pul qaysi vazifa berilishini belgilaydi."}</p></div>
      <div class="row">${list.length ? list.map((x) => {
        const key = kind + ":" + x.id;
        if (T.editName === key) return `<span class="chip-tag"><input id="rn-${key}" value="${esc(x.name)}" style="width:130px;padding:4px 8px" aria-label="Yangi nom"><button data-act="rnSave" data-v="${key}">Saqlash</button><button data-act="rnCancel">Bekor</button></span>`;
        const conf = T.confirm === "del-" + key;
        return `<span class="chip-tag">${esc(x.name)} <span class="sub">${x.n}</span><button data-act="rn" data-v="${key}" aria-label="Nomini o'zgartirish">✎</button>
          <button data-act="delName" data-v="${key}" aria-label="O'chirish" style="${conf ? "color:var(--warn);font-weight:700" : ""}">${conf ? "O'chirilsinmi?" : "✕"}</button></span>`;
      }).join("") : `<span class="sub">Hali yo'q</span>`}</div>
      <form class="row" data-form="add-${kind}" style="flex-wrap:nowrap"><input name="nm" placeholder="${kind === "class" ? "Masalan: IT 1" : "Masalan: A2"}" aria-label="Yangi nom" maxlength="40"><button class="btn sm" type="submit">Qo'shish</button></form></section>`;
  }
  function vPeople() {
    const d = T.data;
    let list = d.students;
    if (T.filter === "none") list = list.filter((s) => !s.class_id);
    else if (T.filter !== "all") list = list.filter((s) => s.class_id === Number(T.filter));
    const filt = `<div class="seg" role="group" aria-label="Sinf bo'yicha"><button aria-pressed="${T.filter === "all"}" data-act="filter" data-v="all">Hammasi · ${d.students.length}</button>
      ${d.classes.map((c) => `<button aria-pressed="${T.filter === String(c.id)}" data-act="filter" data-v="${c.id}">${esc(c.name)} · ${c.n}</button>`).join("")}<button aria-pressed="${T.filter === "none"}" data-act="filter" data-v="none">Sinfsiz</button></div>`;
    const table = list.length ? `<div class="tablebox"><table class="wide-table"><thead><tr><th>O'quvchi</th><th>Login</th><th>Sinf</th><th>Pul</th><th>Parol</th><th></th></tr></thead><tbody>
      ${list.map((s) => {
        const editing = T.editName === "stu:" + s.id, conf = T.confirm === "del-stu:" + s.id;
        return `<tr><td>${editing ? `<div class="row" style="flex-wrap:nowrap"><input id="fn-${s.id}" value="${esc(s.first_name)}" style="width:120px" aria-label="Ism"><input id="ln-${s.id}" value="${esc(s.last_name)}" style="width:140px" aria-label="Familiya"><button class="btn sm" data-act="stuNameSave" data-v="${s.id}">Saqlash</button></div>`
            : `<b style="font-weight:600">${esc(s.first_name)} ${esc(s.last_name)}</b> <button class="link" data-act="rn" data-v="stu:${s.id}" aria-label="Ismni tahrirlash">✎</button>`}</td>
          <td><code>${esc(s.login)}</code></td>
          <td><select data-chg="stuClass" data-v="${s.id}" aria-label="Sinf">${opts(d.classes, s.class_id, "—")}</select></td>
          <td><select data-chg="stuPool" data-v="${s.id}" aria-label="Pul">${opts(d.pools, s.pool_id, "—")}</select></td>
          <td>${T.pwFor === s.id ? `<div class="row" style="flex-wrap:nowrap"><input id="pw-${s.id}" placeholder="Yangi parol" style="width:130px" aria-label="Yangi parol"><button class="btn sm" data-act="pwSave" data-v="${s.id}">Saqlash</button></div>` : `<button class="btn soft sm" data-act="pwOpen" data-v="${s.id}">Yangi parol</button>`}</td>
          <td><button class="btn ${conf ? "danger" : "soft"} sm" data-act="delStu" data-v="${s.id}">${conf ? "Rostdan o'chirish" : "O'chirish"}</button></td></tr>`;
      }).join("")}</tbody></table></div>` : `<div class="card empty">Bu yerda hali o'quvchi yo'q.</div>`;
    const br = T.bulkResult;
    return `${backBtn()}<h1>Sinflar, pullar, o'quvchilar</h1>
      <div class="grid2">${nameList("class")}${nameList("pool")}</div>
      <section class="card stack"><h3>O'quvchilarni qo'shish</h3><p class="sub small">Har qatorga: <code>Ism Familiya, login, parol</code></p>
        <textarea id="bulkBox" class="code" aria-label="O'quvchilar ro'yxati" placeholder="Ali Valiyev, shadow12, tiger4821" style="min-height:120px">${esc(T.bulk)}</textarea>
        <div class="grid2"><div><label for="bulkCls">Sinf</label><select id="bulkCls" data-chg="bulkCls">${opts(d.classes, Number(T.bulkCls) || null, "— sinfsiz —")}</select></div>
        <div><label for="bulkPool">Pul</label><select id="bulkPool" data-chg="bulkPool">${opts(d.pools, Number(T.bulkPool) || null, "— pulsiz —")}</select></div></div>
        <button class="btn" data-act="bulkAdd" ${T.saving ? "disabled" : ""}>Qo'shish</button>
        ${br ? `<p class="${br.errors.length ? "" : "ok"}">${br.added} ta o'quvchi qo'shildi.</p>${br.errors.length ? `<ul class="errlist">${br.errors.map((e) => `<li>${esc(e.login || e.line)}: ${esc(e.error)}</li>`).join("")}</ul>` : ""}` : ""}</section>
      <h2>O'quvchilar</h2>${filt}${table}`;
  }

  async function loadTeachers() { try { T.teachers = await api("admin_teachers"); } catch (e) { quiet(e); } render(); }
  function vTeachers() {
    if (!T.teachers) return `${backBtn()}<h1>O'qituvchilar</h1><div class="loading">Yuklanmoqda…</div>`;
    return `${backBtn()}<h1>O'qituvchilar</h1><p class="sub">Har o'qituvchining sinflari, o'quvchilari va vazifalari alohida. Faqat siz qo'sha va o'chira olasiz.</p>
      <div class="list">${T.teachers.map((t) => {
        const conf = T.confirm === "del-t:" + t.id, editing = T.editName === "t:" + t.id, pw = T.pwFor === "t:" + t.id;
        return `<div class="li" style="flex-wrap:wrap;align-items:flex-start"><span class="grow" style="min-width:180px">
          ${editing ? `<div class="stack"><div class="row" style="flex-wrap:nowrap"><input id="tf-${t.id}" value="${esc(t.first_name)}" aria-label="Ism"><input id="tl-${t.id}" value="${esc(t.last_name)}" aria-label="Familiya"></div>
              <input id="tg-${t.id}" value="${esc(t.login)}" aria-label="Login"><div class="row"><button class="btn sm" data-act="tSave" data-v="${t.id}">Saqlash</button><button class="btn soft sm" data-act="rnCancel">Bekor</button></div></div>`
            : `<b style="font-weight:600">${esc(t.first_name + " " + t.last_name)}</b> ${t.is_admin ? `<span class="pill hw">Bosh admin</span>` : ""}<br><span class="sub small"><code>${esc(t.login)}</code> · ${t.classes} sinf · ${t.students} o'quvchi</span>`}
          ${pw ? `<div class="row" style="margin-top:8px;flex-wrap:nowrap"><input id="tp-${t.id}" placeholder="Yangi parol (6+ belgi)" aria-label="Yangi parol"><button class="btn sm" data-act="tPwSave" data-v="${t.id}">Saqlash</button></div>` : ""}</span>
          ${editing ? "" : `<div class="row">${t.is_admin ? "" : `<button class="btn sm" style="--accent:var(--cw)" data-act="actAs" data-v="${t.id}">Ko'rish</button>`}
            <button class="btn soft sm" data-act="tEdit" data-v="${t.id}">Tahrirlash</button><button class="btn soft sm" data-act="tPw" data-v="${t.id}">Parol</button>
            ${t.is_admin ? "" : `<button class="btn ${conf ? "danger" : "soft"} sm" data-act="tDel" data-v="${t.id}">${conf ? "Barcha ma'lumotlari bilan o'chirish" : "O'chirish"}</button>`}</div>`}</div>`;
      }).join("")}</div>
      <section class="card stack"><h3>Yangi o'qituvchi</h3>
        <div class="grid2"><div><label for="ntf">Ism</label><input id="ntf"></div><div><label for="ntl">Familiya</label><input id="ntl"></div>
        <div><label for="ntg">Login</label><input id="ntg" autocapitalize="off" spellcheck="false"></div><div><label for="ntp">Parol (6+ belgi)</label><input id="ntp"></div></div>
        <button class="btn" data-act="tAdd">Qo'shish</button></section>`;
  }

  async function adminCall(fn, args, okMsg, reload = true) {
    try { const r = await api(fn, args); if (okMsg) toast(okMsg); if (reload) await loadAdmin(); return r; }
    catch (e) { quiet(e); return null; }
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
    if (!/^(delName|delStu|delQuest|tDel)$/.test(a)) T.confirm = "";
    switch (a) {
      case "noop": return;
      case "role": V = { screen: "login", role: v }; render(); return;
      case "back": V = { screen: "pick" }; render(); return;
      case "logout": signOut(); return;
      case "tab":
        if (S.role === "teacher") {
          if (T.tab === v) T.sub = null;
          T.tab = v; T.editName = null; T.pwFor = null; render(); window.scrollTo(0, 0);
          if (v === "results" || v === "report") loadReport();
        } else {
          ST.tab = v; ST.castleMsg = null; render(); window.scrollTo(0, 0);
          if (v === "board") loadBoard(); else if (v === "troph") loadTrophies(); else if (v === "castle") loadCastle(); else if (v === "home") loadStudent();
        }
        return;
      // student
      case "play": startQuest(v, false); return;
      case "practice": startPractice(); return;
      case "quit": quitPlayer(); return;
      case "sel": if (P && !P.result) { P.sel = Number(v); render(); } return;
      case "pick": if (P && !P.result && !P.pick.includes(Number(v))) { P.pick.push(Number(v)); render(); } return;
      case "unpick": if (P && !P.result) { P.pick.splice(Number(v), 1); render(); } return;
      case "check": check(); return;
      case "cont": cont(); return;
      case "next": nextCard(); return;
      case "repToggle": P.reportOpen = !P.reportOpen; render(); { const el = $("#repNote"); if (el) el.focus(); } return;
      case "repSend": sendReport(); return;
      case "defend": {
        b.disabled = true;
        try { const r = await api("castle_defend"); ST.castleMsg = r.error ? { ok: false, t: r.error === "MAX" ? "Mudofaa eng yuqori darajada." : "5 ta askar kerak." } : { ok: true, t: "Mudofaa kuchaytirildi!" }; } catch (err) { quiet(err); }
        loadCastle(); return;
      }
      case "attack": {
        b.disabled = true;
        try {
          const r = await api("castle_attack", { p_target: Number(v) });
          if (r.error) ST.castleMsg = { ok: false, t: r.error === "COOLDOWN" ? "Bu qal'aga 1 soatdan keyin yana hujum qilish mumkin." : r.error === "NO_SOLDIERS" ? "10 ta askar kerak." : "Hujum qilib bo'lmadi." };
          else ST.castleMsg = r.win ? { ok: true, t: `G'alaba! ${r.name}dan ${r.loot} o'lja oldingiz.` } : { ok: false, t: `${r.name}ning qal'asi chidadi. Keyingi safar omad!` };
        } catch (err) { quiet(err); }
        loadCastle(); return;
      }
      // teacher
      case "cls": T.cls = Number(v); render(); loadReport(); if (T.showMonthly) loadMonthly(); return;
      case "week": { const d = dayFromStr(T.week); d.setDate(d.getDate() + 7 * Number(v)); T.week = strFromDay(d); loadReport(); return; }
      case "setweek": T.week = v; loadReport(); return;
      case "monthly": T.showMonthly = true; render(); loadMonthly(); return;
      case "sub": T.sub = v || null; T.editName = null; T.pwFor = null; T.pwMsg = null; render(); window.scrollTo(0, 0); if (v === "teachers") loadTeachers(); return;
      case "filter": T.filter = v; render(); return;
      case "rn": T.editName = v; render(); { const el = document.getElementById("rn-" + v); if (el) el.focus(); } return;
      case "rnCancel": T.editName = null; render(); return;
      case "rnSave": {
        const el = document.getElementById("rn-" + v); const [kind, id] = v.split(":"); const name = el ? el.value.trim() : ""; if (!name) return;
        T.editName = null; await adminCall(kind === "class" ? "admin_class_save" : "admin_pool_save", { p_id: Number(id), p_name: name }, "Saqlandi"); return;
      }
      case "delName": {
        if (T.confirm !== "del-" + v) { T.confirm = "del-" + v; render(); return; }
        T.confirm = ""; const [kind, id] = v.split(":");
        await adminCall(kind === "class" ? "admin_class_delete" : "admin_pool_delete", { p_id: Number(id) }, "O'chirildi"); return;
      }
      case "stuNameSave": {
        const id = Number(v), fn = document.getElementById("fn-" + id).value.trim(), ln = document.getElementById("ln-" + id).value.trim();
        if (!fn) { toast("Ism bo'sh bo'lmasin"); return; }
        T.editName = null; updateStudent(id, { first_name: fn, last_name: ln }); return;
      }
      case "pwOpen": T.pwFor = Number(v); render(); { const el = document.getElementById("pw-" + v); if (el) el.focus(); } return;
      case "pwSave": {
        const id = Number(v), pw = document.getElementById("pw-" + id).value.trim();
        if (pw.length < 4) { toast("Parol kamida 4 belgi"); return; }
        T.pwFor = null; await adminCall("admin_set_password", { p_id: id, p_password: pw }, "Yangi parol saqlandi: " + pw); return;
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
        T.parsed = window.QuestParser.parse(T.paste); T.poolPick = {};
        T.parsed.quests.forEach((q, i) => { const p = q.pool && T.data.pools.find((x) => x.name.toLowerCase() === q.pool.toLowerCase()); T.poolPick[i] = p ? String(p.id) : ""; });
        render(); return;
      }
      case "saveQuests": {
        const pr = T.parsed; if (!pr || pr.errors.length) return;
        const scripts = scriptsFor(T.paste, pr);
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
      case "indivSave": { const ids = Array.from(document.querySelectorAll(".indiv-box:checked")).map((x) => Number(x.value)); T.openStudents = null; updateQuest(Number(v), { students: ids }, "Saqlandi"); return; }
      case "delQuest": {
        if (T.confirm !== "del-q:" + v) { T.confirm = "del-q:" + v; render(); return; }
        T.confirm = ""; await adminCall("admin_quest_delete", { p_id: Number(v) }, "Vazifa o'chirildi"); return;
      }
      case "probDone": await adminCall("admin_problem_resolve", { p_id: Number(v) }, "Belgilandi"); return;
      case "changePw": {
        const op = $("#op").value, np = $("#np").value, np2 = $("#np2").value;
        if (np.length < 8) { T.pwMsg = { t: "Yangi parol kamida 8 belgi bo'lsin." }; render(); return; }
        if (np !== np2) { T.pwMsg = { t: "Yangi parollar bir xil emas." }; render(); return; }
        try { const r = await api("admin_change_password", { p_old: op, p_new: np }); T.pwMsg = r && r.ok ? { ok: true, t: "Parol o'zgartirildi." } : { t: r && r.error === "OLD_WRONG" ? "Hozirgi parol noto'g'ri." : "Parol juda qisqa." }; }
        catch (err) { if (err.message !== "AUTH") T.pwMsg = { t: errText(err) }; }
        render(); return;
      }
      // teachers (main admin)
      case "actAs":
        try { await api("admin_act_as", { p_teacher: v ? Number(v) : null }); } catch (err) { quiet(err); return; }
        T.sub = null; T.tab = "results"; T.cls = null; T.report = null; T.reportKey = ""; T.data = null; render(); loadAdmin(); return;
      case "tEdit": T.editName = "t:" + v; render(); return;
      case "tSave": {
        const id = Number(v);
        const r = await adminCall("admin_teacher_update", { p_id: id, p_first: $("#tf-" + id).value.trim(), p_last: $("#tl-" + id).value.trim(), p_login: $("#tg-" + id).value.trim() }, null, false);
        if (r && r.error) { toast(r.error); return; }
        T.editName = null; toast("Saqlandi"); loadTeachers(); return;
      }
      case "tPw": T.pwFor = "t:" + v; render(); return;
      case "tPwSave": {
        const id = Number(v), pw = $("#tp-" + id).value.trim();
        const r = await adminCall("admin_teacher_password", { p_id: id, p_password: pw }, null, false);
        if (r && r.error) { toast(r.error); return; }
        T.pwFor = null; toast("Yangi parol saqlandi: " + pw); render(); return;
      }
      case "tDel": {
        if (T.confirm !== "del-t:" + v) { T.confirm = "del-t:" + v; render(); return; }
        T.confirm = "";
        const r = await adminCall("admin_teacher_delete", { p_id: Number(v) }, null, false);
        if (r && r.error) { toast(r.error); return; }
        toast("O'qituvchi o'chirildi"); loadTeachers(); return;
      }
      case "tAdd": {
        const f = $("#ntf").value.trim(), l = $("#ntl").value.trim(), g = $("#ntg").value.trim(), p = $("#ntp").value.trim();
        if (!f || !g || !p) { toast("Ism, login va parolni kiriting"); return; }
        const r = await adminCall("admin_teacher_add", { p_first: f, p_last: l, p_login: g, p_password: p }, null, false);
        if (r && r.error) { toast(r.error); return; }
        toast(`O'qituvchi qo'shildi: ${g} / ${p}`); loadTeachers(); return;
      }
    }
  });

  document.addEventListener("submit", async (e) => {
    const f = e.target.closest("[data-form]"); if (!f) return;
    e.preventDefault();
    const kind = f.dataset.form.replace("add-", ""), name = f.nm.value.trim(); if (!name) return;
    await adminCall(kind === "class" ? "admin_class_save" : "admin_pool_save", { p_id: null, p_name: name }, "Qo'shildi");
  });

  document.addEventListener("change", (e) => {
    const el = e.target, k = el.dataset && el.dataset.chg; if (!k) return;
    const id = Number(el.dataset.v), val = el.value === "" ? null : Number(el.value);
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

  ["copy", "cut", "contextmenu"].forEach((ev) => document.addEventListener(ev, (e) => {
    if (e.target.closest && e.target.closest("[data-nocopy], .noselect")) e.preventDefault();
  }));

  function boot() {
    if (!S) { V = { screen: "pick" }; render(); return; }
    if (S.role === "teacher") { render(); loadAdmin(); }
    else { render(); loadStudent(); }
  }
  boot();
})();
