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
  const DOWN = ["", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];
  const hm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const toMin = (t) => { const [h, m] = String(t || "").split(":").map(Number); return h * 60 + m; };
  const clock = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const dayName = (iso) => WEEKDAYS[new Date(iso).getDay()];
  function defaultWeek() { const d = new Date(), mon = mondayOf(d); if ([0, 5, 6].includes(d.getDay())) mon.setDate(mon.getDate() + 7); return strFromDay(mon); }
  function dueToDate(week, due) {
    if (!due || due.lesson) return null;
    if (due.date) { const [y, m, dd] = due.date.split("-").map(Number); return new Date(y, m - 1, dd, due.h, due.m); }
    const d = dayFromStr(week); d.setDate(d.getDate() + due.dow - 1); d.setHours(due.h, due.m, 0, 0); return d;
  }
  function lockText(l) {
    if (!l) return "";
    if (l.code === "cw_soon") return `${dayName(l.at)} ${clock(l.at)} darsda ochiladi`;
    if (l.code === "hw_soon") return `${dayName(l.at)} ${clock(l.at)} da, darsdan keyin ochiladi`;
    if (l.code === "cw_closed") return "Yopildi: 3 kunlik muddat tugadi";
    if (l.code === "in_lesson") return `Dars paytida yopiq · ${clock(l.at)} da ochiladi`;
    return "Hozir yopiq";
  }
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
    { k: "defender", ic: "castle", t: "Mustahkam qal'a", n: "Devorni 5-darajaga yetkazdi" },
    { k: "olov7", ic: "flame", t: "7 kunlik olov", n: "7 kun ketma-ket mashq qildi" },
    { k: "yozuvchi", ic: "doc", t: "Yozuvchi", n: "Birinchi yozma ishini yubordi" },
    { k: "ielts_ace", ic: "openbook", t: "IELTS ustasi", n: "IELTS matnini birinchi urinishda xatosiz ishladi" },
    { k: "takror5", ic: "loop", t: "Takrorlash ustasi", n: "Kunlik takrorlashni 5 kun bajardi" },
    { k: "g3", ic: "star", t: "Uch yulduz", n: "Qal'a jangida 3 yulduz bilan yutdi (har kuni yutish mumkin)" },
    { k: "himoya", ic: "shield", t: "Qal'a himoyachisi", n: "Qal'asi hujumga bardosh berdi (har kuni yutish mumkin)" },
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
    if (m === "LOCKED") return "Bu vazifa hozir yopiq. Bosh sahifada qachon ochilishini ko'ring.";
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

  const STU_TABS = [["home", "Bosh sahifa", "home", "--hw"], ["vocab", "Lug'at", "book", "--rv"], ["troph", "Kuboklar", "trophy", "--tr"], ["board", "Reyting", "list", "--cw"], ["castle", "Qal'a", "castle", "--wr"]];
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
    const wb = $("#wbox");
    if (wb && P) {
      wb.oninput = () => { P.wtext = wb.value; store.set(P.wkey, wb.value); writeCounter(); };
      wb.onkeydown = () => { P.wkeys += 1; };
      wb.onpaste = (e) => { e.preventDefault(); toast("Nusxa joylash mumkin emas. O'zingiz yozing."); };
      wb.ondrop = (e) => { e.preventDefault(); };
      writeCounter();
    }
    document.querySelectorAll(".ishort").forEach((el) => { el.oninput = () => { if (P) P.ia[Number(el.dataset.i)] = el.value; }; });
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
    try { const [h, w] = await Promise.all([api("student_home"), api("my_writings").catch(() => [])]); ST.home = h; ST.writ = w || []; } catch (e) { quiet(e); }
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

  /* homework buckets: current = due at the next lesson (server decides from the timetable), future = later, old = past */
  const HW_CAT = {
    cur: { t: "HOZIRGI VAZIFA", d: "Keyingi darsgacha bajaring", c: "--warn", s: "--warn-s" },
    fut: { t: "KEYINGI VAZIFA", d: "Hali vaqt bor", c: "--rv", s: "--rv-s" },
    old: { t: "O'TGAN VAZIFA", d: "Muddati o'tgan", c: "--amber", s: "--amber-s" },
  };
  function hwCat(q, cur, now) {
    if (cur.includes(q.id) || !q.deadline) return "cur";
    return new Date(q.deadline).getTime() > now ? "fut" : "old";
  }
  function hwGroups(list, cur, now) {
    const t = (q) => (q.deadline ? new Date(q.deadline).getTime() : 0);
    list.forEach((q) => (q.cat = hwCat(q, cur, now)));
    const by = (c) => list.filter((q) => q.cat === c);
    const ordered = by("cur").sort((a, b) => t(a) - t(b)).concat(by("fut").sort((a, b) => t(a) - t(b)), by("old").sort((a, b) => t(b) - t(a)));
    return { shown: ordered.slice(0, 5), rest: ordered.slice(5) };
  }
  function hwCard(q, inner) {
    const c = HW_CAT[q.cat] || HW_CAT.cur;
    return `<div class="hwcat" style="--k:var(${c.c});--ks:var(${c.s})"><div class="hwcat-h"><b>${c.t}</b><span>${c.d}</span></div><div class="list">${inner}</div></div>`;
  }
  function questPct(q) { return q.completed_at ? 100 : q.gradable ? Math.round((q.done / q.gradable) * 100) : 0; }
  function vHome() {
    const h = ST.home;
    const now = Date.now();
    const qs = h.quests || [];
    const open = qs.filter((q) => !q.completed_at), done = qs.filter((q) => q.completed_at && q.kind === "cw");
    const openCw = open.filter((q) => q.kind === "cw");
    const hwSets = hwGroups(qs.filter((q) => q.kind !== "cw"), h.cur || [], now);
    const item = (q) => {
      if (q.lock && !q.completed_at) {
        return `<button class="li qitem" data-act="locked" data-v="${esc(lockText(q.lock))}" style="opacity:.6">
          <span class="sub">${I.lock}</span><span class="grow"><b style="font-weight:600">${esc(q.title)}</b><br><span class="small sub">${esc(lockText(q.lock))}</span></span></button>`;
      }
      const pct = questPct(q);
      const late = q.deadline && new Date(q.deadline).getTime() < now && !q.completed_at;
      const doneLate = q.completed_at && q.deadline && new Date(q.completed_at) > new Date(q.deadline);
      let sub = q.kind === "cw" ? `${q.lesson ? q.lesson + "-dars · " : ""}Sinf ishi` : q.deadline ? `Muddat: ${esc(fmtDate(q.deadline))}` : "Muddatsiz";
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
        <div class="stats"><span class="stat" title="Ketma-ket kunlar">${I.fire}${h.streak || 0}</span><span class="stat" title="Oltin">${I.coin}${h.gold == null ? 300 : h.gold}</span>
        <button class="btn soft sm" data-act="logout" aria-label="Chiqish" style="background:var(--card)">${I.out}</button></div></div>
      <p class="sub small">Bu hafta: <b>${wk.correct || 0}</b> ta to'g'ri javob · <b>${fmtTime(wk.seconds)}</b></p>
      ${h.lesson_until ? `<div class="banner" style="background:var(--cw-s);color:var(--cw)">Hozir dars ketmoqda. Uy vazifalari ${clock(h.lesson_until)} da ochiladi.</div>` : ""}
      ${(() => { const dl = h.daily || { n: 0, goal: 10 }, dd = dl.n >= dl.goal;
        return `<button class="li card" style="flex-direction:row;--accent:var(--rv)" data-act="${dd ? "noop" : "daily"}">${ring(Math.round((Math.min(dl.n, dl.goal) / dl.goal) * 100), "var(--rv)", 46)}
          <span class="grow"><b style="font-weight:600">Kunlik takrorlash</b> <span class="pill ${dd ? "rv" : "warn"}">${dd ? "Bajarildi" : "Majburiy"}</span><br><span class="small sub">${dd ? "Bugungi 10 ta so'z takrorlandi. Ertaga yana!" : `${dl.n}/${dl.goal} so'z · taxminan 5 daqiqa`}</span></span>${dd ? I.check : `<span class="chev">${I.chev}</span>`}</button>`; })()}
      <button class="li card" style="flex-direction:row" data-act="practice"><span class="sub">${I.loop}</span><span class="grow"><b style="font-weight:600">Erkin mashq</b><br><span class="small sub">Vazifalar tugadimi? O'tgan savollar aralash, cheksiz</span></span><span class="chev">${I.chev}</span></button>
      ${openCw.length ? `<h2>Sinf ishi</h2><div class="list">${openCw.map(item).join("")}</div>` : ""}
      <h2>Uy vazifasi</h2>
      ${hwSets.shown.length ? `<div class="stack">${hwSets.shown.map((q) => hwCard(q, item(q))).join("")}</div>` : `<div class="card empty">Hozircha uy vazifasi yo'q. O'qituvchingiz bergan vazifalar shu yerda chiqadi.</div>`}
      ${hwSets.rest.length ? `<details class="card"><summary style="cursor:pointer;font-weight:700;font-size:17px">Eski vazifalar · ${hwSets.rest.length} ta</summary>
        <p class="sub small" style="margin:6px 0 0">Oxirgi 2 oydagi eski uy vazifalari. Bajarilmaganlarini hali ham bajarsa bo'ladi.</p>
        <div class="stack" style="margin-top:10px">${hwSets.rest.map((q) => hwCard(q, item(q))).join("")}</div></details>` : ""}
      ${(h.words || []).length ? `<details class="card"><summary style="cursor:pointer;font-weight:600">Bu haftaning so'zlari · ${h.words.length} ta</summary>
        <div class="list" style="margin-top:10px">${h.words.map((w) => `<div class="li"><b style="font-weight:600" class="grow">${esc(w.en)}</b><span class="sub">${esc(w.uz)}</span></div>`).join("")}</div></details>` : ""}
      ${(ST.writ || []).length ? `<h2>Yozma ishlarim</h2><div class="stack">${ST.writ.slice(0, 6).map((w) => `<details class="card"><summary style="cursor:pointer;list-style:none"><div class="row between" style="flex-wrap:nowrap"><span class="grow"><b style="font-weight:600">${esc(w.title || "Yozma ish")}</b><br><span class="small sub">${esc(w.quest)} · ${w.words} so'z</span></span>
          ${w.mark != null ? `<span class="pill rv" style="font-size:15px">${w.mark}/10</span>` : `<span class="pill">Tekshirilmoqda</span>`}</div></summary>
          ${w.comment ? `<div class="fb good" style="margin-top:10px"><b>O'qituvchi izohi</b>${esc(w.comment)}</div>` : ""}<p class="small" style="white-space:pre-wrap;margin:10px 0 0;overflow-wrap:anywhere">${esc(w.text)}</p></details>`).join("")}</div>` : ""}
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

  /* ---------- trophies (count, sell for gold, shop) ---------- */
  async function loadTrophies() {
    try { const [t, g] = await Promise.all([api("my_trophies"), api("game_state")]); ST.troph = t; ST.g = g; } catch (e) { quiet(e); }
    render();
  }
  const T_VAL = (k) => (BIG.some((b) => b.k === k) ? 250 : 40);
  const SHOP = [
    { k: "builder", n: "Ikkinchi quruvchi", p: 6, d: "Ikki binoni bir vaqtda qurish", ic: "hammer" },
    { k: "shield", n: "Qalqon · 12 soat", p: 2, d: "Hech kim hujum qila olmaydi", ic: "shield" },
    { k: "rush", n: "Qurilishni darhol tugatish", p: 1, d: "Hozirgi qurilish shu zahoti tayyor", ic: "bolt" },
    { k: "banner", n: "Oltin bayroq", p: 3, d: "Qal'angizda oltin bayroq hilpiraydi", ic: "flag" },
  ];
  function vTrophies() {
    if (!ST.troph || !ST.g || !ST.g.me) return `<h1>Kuboklar</h1><div class="loading">Yuklanmoqda…</div>`;
    const leaders = ST.troph.leaders || [], cnt = ST.g.trophies || {}, me = (ST.home.me.first_name + " " + ST.home.me.last_name).trim();
    const have = (k) => (cnt[k] ? cnt[k].have : 0), won = (k) => (cnt[k] ? cnt[k].won : 0);
    const total = Object.values(cnt).reduce((a, x) => a + x.have, 0), g = ST.g.me;
    const sellBtn = (k) => have(k) ? `<button class="btn soft sm" style="background:var(--card)" data-act="tsell" data-v="${k}">${I.coin} ${T_VAL(k)} oltinga</button>` : "";
    const big = BIG.map((b) => { const lead = leaders.find((l) => l.kind === b.k);
      return `<div class="troph big ${won(b.k) ? "" : "locked"}">${have(b.k) ? `<span class="tcount">×${have(b.k)}</span>` : ""}<span class="medal">${I[b.ic]}</span><h3>${b.t}</h3><p>${b.n}</p>
        <span class="pill ${won(b.k) ? "rv" : ""}">${won(b.k) ? won(b.k) + " marta yutilgan" : "Hali yutilmagan"}</span>
        ${lead ? `<span class="pill ${lead.name.trim() === me ? "rv" : ""}">${lead.name.trim() === me ? "Bu hafta siz yetakchisiz!" : "Bu hafta yetakchi: " + esc(lead.name)}</span>` : ""}${sellBtn(b.k)}</div>`; }).join("");
    const small = SMALL.map((t) => `<div class="troph small ${won(t.k) ? "" : "locked"}">${have(t.k) > 1 ? `<span class="tcount">×${have(t.k)}</span>` : ""}<span class="medal">${I[t.ic]}</span><h3>${t.t}</h3><p>${t.n}</p>${sellBtn(t.k)}</div>`).join("");
    const shop = SHOP.map((it) => { const owned = (it.k === "builder" && g.builders > 1) || (it.k === "banner" && g.banner);
      return `<div class="card" style="flex-direction:row;align-items:center;gap:12px"><span class="medal shopi" style="color:var(--wr)">${I[it.ic]}</span><span class="grow"><b style="font-weight:600">${it.n}</b><br><span class="small sub">${it.d}</span></span>
        ${owned ? `<span class="pill rv">Olingan</span>` : `<button class="btn sm" style="--accent:var(--wr)" data-act="tbuy" data-v="${it.k}" ${total < it.p || (it.k === "rush" && !g.queue.length) ? "disabled" : ""}>${it.p} kubok</button>`}</div>`; }).join("");
    return `<div class="row between"><h1>Kuboklar</h1><span class="pill">${total} ta bor</span></div>
      <p class="sub">Katta kuboklar har dushanba o'tgan hafta g'oliblariga beriladi. Kubokni oltinga almashtirish yoki do'konda sarflash mumkin. Ota-onalar hisobotida jami yutilganlar saqlanadi.</p>
      <div class="trophies">${big}</div><h2>Kichik kuboklar</h2><div class="trophies">${small}</div>
      <h2>Kubok do'koni</h2><div class="stack">${shop}</div>`;
  }

  /* ---------- castle game ---------- */
  const GB = {
    castle: { n: "Qal'a", base: 250, g: 2.2, t: 2.0, d: "Boshqa binolar darajasi qal'adan oshmaydi. Qal'a qanchalik baland bo'lsa, shuncha kuchli dushmanlar chiqadi." },
    wall: { n: "Devor", base: 60, g: 1.8, t: 1.0, d: "Dushman askarlarini to'xtatadi. Katapulta devorni ikki barobar tez buzadi." },
    tower: { n: "Kamon minorasi", base: 90, g: 1.85, t: 1.2, d: "Hujumchilarga o'q otadi. Otliqlarga o'q kam tegadi." },
    barracks: { n: "Kazarma", base: 80, g: 1.8, t: 1.2, d: "Qo'shin sig'imi, askarlar kuchi va yangi askar turlari." },
    storage: { n: "Ombor", base: 100, g: 1.9, t: 1.0, d: "Qancha oltin saqlash mumkinligini belgilaydi." },
  };
  const G_ORDER = ["castle", "wall", "tower", "barracks", "storage"];
  const gCost = (k, l) => Math.round((GB[k].base * Math.pow(GB[k].g, l - 1)) / 5) * 5;
  const gHours = (k, l) => Math.round(GB[k].t * Math.pow(2.1, l - 1) * 10) / 10;
  const gCap = (l) => Math.round((400 * Math.pow(1.8, l - 1)) / 10) * 10;
  const gArmy = (l) => Math.round(10 * Math.pow(1.22, l - 1));
  const gMul = (l) => Math.pow(1.2, l - 1);
  const gDef = (k, l) => Math.round({ wall: 162, tower: 144, keep: 306 }[k] * Math.pow(1.464, l - 1));
  const GT = {
    spear: { n: "Nayzachi", cost: 15, sp: 1, atk: 5, hp: 16, open: 1, d: "Arzon va chidamli. Har qanday qo'shinning asosi." },
    archer: { n: "Kamonchi", cost: 25, sp: 1, atk: 7, hp: 12, open: 2, d: "Minorani tez yiqitadi, devorga kuchsiz." },
    cav: { n: "Otliq", cost: 50, sp: 2, atk: 11, hp: 30, open: 3, d: "Tez yuguradi: minora o'qlari yarim kuch bilan tegadi." },
    cat: { n: "Katapulta", cost: 95, sp: 4, atk: 28, hp: 22, open: 4, d: "Devorni ikki barobar kuchli buzadi." },
  };
  const housing = (a) => Object.keys(GT).reduce((s, k) => s + (a[k] || 0) * GT[k].sp, 0);
  const hrs = (h) => (h >= 24 ? `${Math.round((h / 24) * 10) / 10} kun` : h >= 1 ? `${h} soat` : `${Math.round(h * 60)} daqiqa`);
  const coin = (w) => `<svg viewBox="0 0 24 24" style="width:${w || 18}px;height:${w || 18}px;flex:none" aria-hidden="true"><use href="#coin"/></svg>`;
  async function loadCastle(silent) {
    try { const [g, t] = await Promise.all([api("game_state"), ST.gsub === "battle" && !ST.targets ? api("game_targets") : Promise.resolve(ST.targets)]); ST.g = g; ST.targets = t; }
    catch (e) { if (!silent) quiet(e); }
    render();
  }
  function gSet() {
    const me = ST.g.me, off = Date.now() - new Date(me.now).getTime();
    window.GameArt.set({ gold: me.gold, army: me.army, cap: me.cap, queue: me.queue.map((q) => ({ k: q.k, start: new Date(q.start).getTime() + off, end: new Date(q.end).getTime() + off })) });
    ST.gOff = off;
  }
  const gTime = (iso) => new Date(iso).getTime() + (ST.gOff || 0);
  function vCastle() {
    if (!ST.g || !ST.g.me) return `<h1>Qal'a</h1><div class="loading">Yuklanmoqda…</div>`;
    gSet();
    const me = ST.g.me, b = me.b, sub = ST.gsub || "base";
    const used = housing(me.army), capA = gArmy(b.barracks);
    const head = `<div class="gres"><div class="chip-g grow">${coin(22)}<div class="grow"><div class="row between" style="flex-wrap:nowrap"><b class="num">${me.gold}</b><span class="small sub">/ ${me.cap}</span></div><div class="bar" style="margin:3px 0 0"><i style="width:${(me.gold / me.cap) * 100}%;background:var(--gold)"></i></div></div></div>
      <div class="chip-g"><svg viewBox="0 0 24 24" style="width:20px;height:20px"><use href="#sword"/></svg><b class="num">${used}/${capA}</b></div></div>
      <div class="seg" role="group" aria-label="Bo'lim">${[["base", "Qal'a"], ["army", "Qo'shin"], ["battle", "Jang"]].map(([k, l]) => `<button aria-pressed="${sub === k}" data-act="gsub" data-v="${k}">${l}</button>`).join("")}</div>`;
    if (ST.battle) return `<h1>Jang</h1>` + vBattleRun();
    if (sub === "army") return `<h1>Qo'shin</h1>` + head + vArmy(me, used, capA);
    if (sub === "battle") return `<h1>Jang</h1>` + head + vBattleList(me, used);
    const free = me.queue.length < me.builders, damaged = !!me.damaged;
    const cards = G_ORDER.map((k) => {
      const l = b[k], q = me.queue.find((x) => x.k === k), max = k === "castle" ? 10 : Math.min(10, b.castle), atMax = l >= max, c = gCost(k, l);
      const eff = { castle: `Boshqa binolar maks. ${l + 1}-daraja`, wall: `Mustahkamlik ${gDef("wall", l)} → ${gDef("wall", l + 1)}`, tower: `Kuch ${gDef("tower", l)} → ${gDef("tower", l + 1)}`,
        barracks: `Sig'im ${gArmy(l)} → ${gArmy(l + 1)}, askarlar +20% kuchli`, storage: `${gCap(l)} → ${gCap(l + 1)} oltin` }[k];
      let btn;
      if (q) btn = `<div class="stack" style="gap:5px"><span class="small"><span class="ico">${I.hammer}</span> ${l + 1}-darajaga ko'tarilmoqda · qoldi: <b data-glive="q:${k}" style="color:var(--wr)"></b></span><div class="bar" style="margin:0"><i data-glive="qb:${k}" style="background:var(--rv)"></i></div></div>`;
      else if (atMax) btn = `<span class="small sub">${k === "castle" ? "Eng yuqori daraja" : "Avval qal'ani ko'taring"}</span>`;
      else btn = `<button class="btn sm" style="--accent:var(--wr);align-self:flex-start" data-act="gup" data-v="${k}" ${me.gold < c || !free || damaged ? "disabled" : ""}>${coin()} ${c} · ${hrs(gHours(k, l))}</button>`;
      return `<div class="card" style="flex-direction:row;gap:12px;align-items:flex-start"><div class="gicon">${window.GameArt.buildIcon(k)}</div><div class="grow stack" style="gap:6px">
        <div class="row between"><h3>${GB[k].n}</h3><span class="pill" style="background:var(--hw-s);color:var(--hw)">${l}-daraja · ${window.GameArt.LOOKNAME[window.GameArt.look(l).k]}</span></div>
        <span class="small sub">${GB[k].d}</span>${atMax || q ? "" : `<span class="small">${eff}</span>`}${btn}</div></div>`;
    }).join("");
    return `<h1>Qal'a</h1>` + head + `<div class="gscene">${window.GameArt.scene(b, { damaged, shield: !!me.shield, banner: me.banner })}</div>
      ${damaged ? `<div class="banner" style="background:var(--warn-s);color:var(--warn)">Qal'angizga hujum bo'ldi. Ta'mirlanmoqda: <b data-glive="dmg"></b>. Ta'mir tugaguncha qurilish boshlab bo'lmaydi.</div>` : ""}
      <div class="card stack" style="gap:6px"><div class="row small sub"><span class="ico">${I.shield}</span> Qalqon: <b data-glive="shield">${me.shield ? "" : "yo'q"}</b> · Quruvchilar: ${me.builders - me.queue.length}/${me.builders} bo'sh</div>
        <span class="small sub">Oltin faqat o'qish orqali keladi: har to'g'ri javob +5, vazifani tugatish +120, kunlik takrorlash +40.</span></div>
      <h2>Binolar</h2><div class="stack">${cards}</div>`;
  }
  function vArmy(me, used, capA) {
    const bl = me.b.barracks;
    return `<p class="sub small" style="margin:0">Kazarmani ko'tarsangiz joy ko'payadi, askarlar kuchayadi va yangi turlar ochiladi. Jangdan tirik qaytganlar qo'shinda qoladi.</p>
      <div class="stack">${Object.keys(GT).map((k) => { const t = GT[k], locked = bl < t.open, n = me.army[k] || 0;
        return `<div class="card" style="flex-direction:row;gap:12px;${locked ? "opacity:.55" : ""}"><div class="gicon"><svg viewBox="0 0 56 48" style="width:52px;height:46px"><use href="#t-${k}"/></svg></div>
          <div class="grow stack" style="gap:6px"><div class="row between"><h3>${t.n}</h3><b class="num" style="font-size:20px">${n}</b></div>
          <span class="small sub">${t.d}</span><span class="small">Hujum ${Math.round(t.atk * gMul(bl))} · Jon ${Math.round(t.hp * gMul(bl))} · Joy ${t.sp}</span>
          ${locked ? `<span class="small sub">Kazarma ${t.open}-darajada ochiladi</span>` : `<div class="row">
            <button class="btn sm" style="--accent:var(--wr)" data-act="gtrain" data-v="${k}|1" ${me.gold < t.cost || used + t.sp > capA ? "disabled" : ""}>${coin()} ${t.cost}</button>
            <button class="btn soft sm" style="background:var(--card2,var(--bg))" data-act="gtrain" data-v="${k}|5" ${me.gold < t.cost * 5 || used + t.sp * 5 > capA ? "disabled" : ""}>×5</button>
            <button class="btn soft sm" style="background:var(--card2,var(--bg))" data-act="guntrain" data-v="${k}" ${n ? "" : "disabled"} aria-label="Bittasini qaytarish (yarim narx)">−</button></div>`}</div></div>`; }).join("")}</div>`;
  }
  function vBattleList(me, used) {
    const tg = ST.targets;
    const log = (ST.g.log || []).map((l) => `<p class="small" style="margin:0">${l.mine ? (l.win ? `${esc(l.other)}ga hujum: g'alaba, +${l.loot} oltin` : `${esc(l.other)}ga hujum: mag'lubiyat`) : (l.win ? `${esc(l.other)} hujum qildi va ${l.loot} oltin oldi` : `${esc(l.other)} hujum qildi, qal'angiz chidadi`)}</p>`).join("");
    return `<p class="sub small" style="margin:0">Dushmanlar darajangizga yaqin qal'alardan tanlanadi. Hujum qilsangiz qalqoningiz o'chadi. Qal'aning yarmi ham buzilmasa, butun qo'shin va oltinning 10% i yo'qoladi.</p>
      ${used ? "" : `<div class="banner" style="background:var(--warn-s);color:var(--warn)">Qo'shiningiz yo'q. Avval "Qo'shin" bo'limida askar tayyorlang.</div>`}
      ${!tg ? `<div class="loading">Yuklanmoqda…</div>` : tg.length ? `<div class="stack">${tg.map((e) => `<div class="card" style="flex-direction:row;gap:12px;align-items:center;flex-wrap:wrap">
          <div style="width:120px;border-radius:12px;overflow:hidden;flex:none">${window.GameArt.scene(e.b, { enemy: 1, id: "e" + e.id })}</div>
          <div class="grow stack" style="gap:3px;min-width:150px"><b style="font-weight:600">${esc(e.name)}</b><span class="small sub">Qal'a ${e.b.castle} · Devor ${e.b.wall} · Minora ${e.b.tower}</span>
            <span class="small row" style="gap:4px">${coin(14)} ${e.gold} oltin · <b style="color:${e.chance >= 60 ? "var(--rv)" : e.chance >= 30 ? "var(--wr)" : "var(--warn)"}">g'alaba ehtimoli ~${e.chance}%</b></span></div>
          <button class="btn sm" style="--accent:var(--tr)" data-act="gattack" data-v="${e.id}" ${used ? "" : "disabled"}>Hujum</button></div>`).join("")}</div>`
        : `<div class="card empty">Hozir hujum qilish mumkin bo'lgan qal'a yo'q (hammada qalqon bor yoki darajasi uzoq). Keyinroq qayta urinib ko'ring.</div>`}
      <button class="btn soft sm" style="background:var(--card);align-self:flex-start" data-act="gretarget">Boshqa dushmanlar</button>
      ${log ? `<div class="card stack" style="gap:6px"><h3>So'nggi janglar</h3>${log}</div>` : ""}`;
  }
  function battleSvg() {
    const r = ST.battle.r, f = ST.battle.f, fr = r.frames[Math.min(f, r.frames.length - 1)] || { h: [100, 100, 100], ti: 1, a: [r.sent.spear || 0, r.sent.archer || 0, r.sent.cav || 0, r.sent.cat || 0] };
    const e = r.b, X = [236, 300, 350], gy = 168, cur = (fr.ti || 1) - 1;
    let s = `<svg viewBox="0 0 400 200" role="img" aria-label="Jang"><rect width="400" height="200" fill="#8fd0ff"/><path d="M0 150 Q100 130 200 148 T400 140 V200 H0z" fill="#6fbf73"/><rect y="${gy}" width="400" height="32" fill="#4f9a53"/>`;
    s += fr.h[0] > 0 ? `<rect x="${X[0]}" y="${gy - 14 - e.wall * 3}" width="14" height="${14 + e.wall * 3}" fill="#9aa6b6" stroke="#0003"/>` : `<rect x="${X[0] - 4}" y="${gy - 6}" width="18" height="6" fill="#9aa6b6"/>`;
    s += fr.h[1] > 0 ? `<rect x="${X[1] - 11}" y="${gy - 50 - e.tower * 7}" width="22" height="${50 + e.tower * 7}" fill="#9aa6b6" stroke="#0003"/><path d="M${X[1] - 13} ${gy - 50 - e.tower * 7} l13 -12 13 12z" fill="#b5482f"/>` : `<g class="smoke" fill="#666"><circle cx="${X[1]}" cy="${gy - 10}" r="8"/></g><rect x="${X[1] - 12}" y="${gy - 10}" width="24" height="10" fill="#8e9bb0"/>`;
    s += fr.h[2] > 0 ? `<rect x="${X[2] - 24}" y="${gy - 60 - e.castle * 5}" width="48" height="${60 + e.castle * 5}" fill="#9aa6b6" stroke="#0003"/><path class="flagw" d="M${X[2]} ${gy - 86 - e.castle * 5} h16 l-4 5 4 5 h-16z" fill="#ff5d6c"/><line x1="${X[2]}" y1="${gy - 60 - e.castle * 5}" x2="${X[2]}" y2="${gy - 86 - e.castle * 5}" stroke="#5a3a1c" stroke-width="2"/>` : `<g class="smoke" fill="#555"><circle cx="${X[2]}" cy="${gy - 20}" r="10"/></g><rect x="${X[2] - 26}" y="${gy - 14}" width="52" height="14" fill="#8e9bb0"/>`;
    fr.h.forEach((p, i) => { if (p > 0) s += `<rect x="${X[i] - 18 + (i === 0 ? 7 : 0)}" y="22" width="36" height="5" rx="2" fill="#0005"/><rect x="${X[i] - 18 + (i === 0 ? 7 : 0)}" y="22" width="${0.36 * p}" height="5" rx="2" fill="${p > 50 ? "#3ccf7a" : p > 25 ? "#ffc53d" : "#ff5d6c"}"/>`; });
    const front = f === 0 ? 30 : X[cur] - 26, kinds = ["spear", "archer", "cav", "cat"], units = [];
    fr.a.forEach((n, i) => { for (let j = 0; j < Math.min(n, 30); j++) units.push(kinds[i]); });
    units.forEach((k, i) => { const big = k === "cav" || k === "cat", row = i % 4, col = Math.floor(i / 4);
      s += `<use href="#t-${k}" x="${Math.max(2, front - col * 13 - row * 4 - (big ? 10 : 0))}" y="${gy - 22 + row * 5}" width="${big ? 26 : 18}" height="22"/>`; });
    if (fr.h[1] > 0 && f > 0) for (let i = 0; i < 3; i++) s += `<line x1="${X[1]}" y1="${gy - 60}" x2="${front - 8 - i * 12}" y2="${gy - 14}" stroke="#5a3a1c" stroke-width="1.5" stroke-dasharray="6 30"/>`;
    return s + `</svg>`;
  }
  function vBattleRun() {
    const r = ST.battle.r, done = ST.battle.done;
    const lost = Object.keys(GT).map((k) => { const d = (r.sent[k] || 0) - (r.surv[k] || 0); return d ? `${d} ${GT[k].n.toLowerCase()}` : ""; }).filter(Boolean).join(", ") || "yo'qotish yo'q";
    return `<div class="card stack"><div class="row between"><h3>${esc(r.name)}ning qal'asi</h3><span class="sub">${done ? r.pct + "% buzildi" : "Jang ketmoqda…"}</span></div>
      <div class="gscene" id="battleBox">${battleSvg()}</div>
      ${done ? `<div class="stars">${[1, 2, 3].map((i) => `<svg viewBox="0 0 24 24" style="color:${i <= r.stars ? "#ffc53d" : "var(--line)"}"><use href="#star"/></svg>`).join("")}</div>
        ${r.stars ? `<div class="fb good"><b>G'alaba!</b>${coin(16)} +${r.got} oltin${r.got < r.loot ? ` (omborga ${r.loot - r.got} sig'madi)` : ""}. Halok bo'lganlar: ${lost}.</div>`
                  : `<div class="fb bad"><b>Mag'lubiyat</b>Qal'aning yarmi ham buzilmadi. Butun qo'shin yo'qotildi va ${r.penalty} oltin dushmanga tovon sifatida berildi.</div>`}
        <p class="small sub" style="margin:0">1 yulduz: 50% buzildi (dushman oltinining 10%) · 2: 80% (18%) · 3: 100% (25%)</p>
        <button class="btn" data-act="gbattleEnd">Davom etish</button>` : `<p class="small sub" style="margin:0">Devor → minora → qal'a tartibida hujum qilinadi.</p>`}</div>`;
  }
  function gTick() {
    if (!ST.g || !ST.g.me || ST.tab !== "castle" || !S || S.role !== "student") return;
    const me = ST.g.me; let reload = false;
    me.queue.forEach((q) => {
      const end = gTime(q.end), st = gTime(q.start), left = end - Date.now();
      if (left <= 0) reload = true;
      document.querySelectorAll(`[data-glive="q:${q.k}"]`).forEach((el) => (el.textContent = window.GameArt.dur(left)));
      document.querySelectorAll(`[data-glive="qb:${q.k}"]`).forEach((el) => (el.style.width = Math.min(100, ((Date.now() - st) / (end - st)) * 100) + "%"));
      document.querySelectorAll(`[data-live="q:${q.k}"]`).forEach((el) => (el.textContent = window.GameArt.dur(left)));
    });
    const sh = document.querySelector('[data-glive="shield"]'); if (sh && me.shield) sh.textContent = window.GameArt.dur(gTime(me.shield) - Date.now());
    const dm = document.querySelector('[data-glive="dmg"]'); if (dm && me.damaged) { const l = gTime(me.damaged) - Date.now(); dm.textContent = window.GameArt.dur(l); if (l <= 0) reload = true; }
    if (reload && !gTick.busy) { gTick.busy = true; loadCastle(true).then(() => (gTick.busy = false)); }
  }
  setInterval(gTick, 1000);

  function vPracticeIntro() {
    return `<h1>Mashq</h1><p class="sub">Vazifalar tugadimi? O'tgan so'z va savollar aralash chiqadi, xatolaringiz ko'proq chiqadi.</p>
      <section class="card stack"><div class="row between"><h3>Erkin mashq</h3><span class="pill rv">Cheksiz</span></div>
      <p class="sub small">Har to'g'ri javob = 1 oltin. Vazifa va kunlik takrorlash ko'proq oltin beradi.</p>
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
      P = { quest: q, byId, state: st, preview: !!preview, right: 0, answered: 0, accent: "--hw", istat: {} };
      if (!preview && q.steps.some((x) => x.t === "ielts")) { try { P.istat = (await api("ielts_status", { p_quest: q.id })) || {}; } catch (e) { P.istat = {}; } }
      loadStep();
    } catch (e) { if (e.message === "AUTH") return; P = { error: errText(e), accent: "--hw" }; }
    render();
  }
  async function startDaily() {
    P = { practice: true, daily: true, loading: true, right: 0, answered: 0, n: 0, goal: 10, accent: "--rv" }; render();
    await nextPractice();
  }
  async function startPractice() {
    P = { practice: true, loading: true, right: 0, answered: 0, accent: "--rv" }; render();
    await nextPractice();
  }
  async function nextPractice() {
    P.loading = true; render();
    try {
      const q = await api(P.daily ? "daily_next" : "practice_next");
      if (q && q.empty) { P.empty = true; P.loading = false; render(); return; }
      if (P.daily) { P.n = q.n || 0; if (q.done) { P.dailyDone = true; P.loading = false; render(); return; } }
      P.cur = q; P.loading = false; loadStep();
    } catch (e) { if (e.message === "AUTH") return; P.error = errText(e); P.loading = false; }
    render();
  }
  function curStep() { return P.practice ? P.cur : P.byId[P.state.order[P.state.i]]; }
  function loadStep() {
    P.sel = null; P.pick = []; P.typed = ""; P.result = null; P.busy = false; P.offline = false; P.reportOpen = false; P.reportSent = false;
    const s = P.practice ? P.cur : P.state.i < P.state.order.length ? curStep() : null;
    P.opts = s && s.opts ? (s.t === "tf" ? s.opts.slice() : shuffle(s.opts)) : null;
    if (s && s.t === "match") { P.mopts = shuffle(s.opts); P.msel = s.left.map(() => ""); }
    if (s && s.t === "write") {
      const key = `w:${P.quest.id}:${s.id}`;
      P.wkey = key; P.wtext = store.get(key) || ""; P.wkeys = 0; P.wprev = null;
      if (!P.preview) api("writing_get", { p_quest: P.quest.id, p_step: s.id }).then((r) => { if (!P || curStep() !== s) return; P.wprev = r; if (r && !P.wtext) P.wtext = r.text; render(); }).catch(() => {});
    }
    if (s && s.t === "ielts") {
      const stt = (P.istat && P.istat[s.id]) || {};
      P.ia = s.qs.map(() => ""); P.ires = stt.tries ? { tries: stt.tries, wrong: stt.wrong || [], can_reveal: stt.tries >= 5 && !stt.done, score: null } : null;
      P.idet = null; P.irev = null; P.ihl = null;
    }
    P.t0 = Date.now();
  }
  function circleName(c) { const cs = P.quest && P.quest.circles; return cs && cs[c] ? cs[c].name : ""; }

  /* ---------- IELTS reading ---------- */
  function passageHtml(text, hl) {
    return text.split(/\n\s*\n/).map((para) => {
      const low = para.toLowerCase(), k = hl ? low.indexOf(hl.toLowerCase()) : -1;
      const inner = k < 0 ? esc(para) : esc(para.slice(0, k)) + `<mark id="hlMark">${esc(para.slice(k, k + hl.length))}</mark>` + esc(para.slice(k + hl.length));
      return `<p>${inner.replace(/\n/g, "<br>")}</p>`;
    }).join("");
  }
  function ieltsBody(s) {
    const det = P.idet, wrong = (P.ires && P.ires.wrong) || [], checked = P.ires && P.ires.score != null, locked = !!det || P.busy;
    const qh = (x, i) => {
      const bad = checked && wrong.includes(i), good = checked && !bad;
      const d = det && det.find((y) => y.i === i);
      let inp = "";
      if (x.type === "tfng") inp = `<div class="tfng" role="group">${[["true", "TRUE"], ["false", "FALSE"], ["not given", "NOT GIVEN"]].map(([v, l]) => `<button class="chip" aria-pressed="${P.ia[i] === v}" data-act="ians" data-v="${i}|${v}" ${locked ? "disabled" : ""}>${l}</button>`).join("")}</div>`;
      else if (x.type === "mcq") inp = `<div class="stack" style="gap:6px">${x.opts.map((o) => `<button class="opt" style="min-height:44px;font-size:15px" aria-pressed="${P.ia[i] === o}" data-act="ians" data-v="${i}|${esc(o)}" ${locked ? "disabled" : ""}>${esc(o)}</button>`).join("")}</div>`;
      else if (x.type === "sel") inp = `<select data-chg="isel" data-v="${i}" aria-label="${i + 1}-savol javobi" ${locked ? "disabled" : ""}><option value="">— tanlang —</option>${x.opts.map((o) => `<option ${P.ia[i] === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
      else inp = `<input class="ishort" data-i="${i}" value="${esc(P.ia[i])}" aria-label="${i + 1}-savol javobi" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Javob (1–3 so'z yoki raqam)" ${locked ? "disabled" : ""}>`;
      const prev = s.qs[i - 1];
      const head = x.type === "sel" && x.title && !(prev && prev.type === "sel" && prev.title === x.title) ? `<p class="sub small" style="margin:4px 0 -2px;font-weight:600">${esc(x.title)}</p>` : "";
      return head + `<div class="iq ${bad ? "bad" : good ? "good" : ""} ${P.irev && P.irev.order[P.irev.k] === i ? "focus" : ""}" id="iq${i}">
        <div class="row" style="flex-wrap:nowrap;align-items:flex-start"><b class="num">${i + 1}.</b><span class="grow">${esc(x.q)}</span>${bad ? `<span class="pill warn">xato</span>` : good ? `<span class="pill rv">to'g'ri</span>` : ""}</div>${inp}
        ${d ? `<div class="idet"><b>Javob: ${esc(x.type === "tfng" ? String(d.answer).toUpperCase() : d.answer)}</b>${d.why ? `<span>${esc(d.why)}</span>` : ""}${d.ev ? `<button class="link small" data-act="ihl" data-v="${i}">Matnda ko'rsatish</button>` : ""}</div>` : ""}</div>`;
    };
    return `<span class="p-kind">IELTS Reading</span><p class="p-q">${esc(s.title)}</p>
      ${P.ires || det ? "" : `<div class="ihelp small"><b>TRUE</b> – matnda aynan shunday deyilgan. <b>FALSE</b> – matnda buning teskarisi yozilgan. <b>NOT GIVEN</b> – matnda bu haqda ma'lumot yo'q.<br>Vaqt cheklanmagan, urinishlar cheksiz. Tekshirgandan keyin faqat qaysi javob xato ekani ko'rinadi.</div>`}
      <div class="ielts"><div class="ipass passage" data-nocopy>${passageHtml(s.text, P.ihl)}</div><div class="iqs">${s.qs.map(qh).join("")}</div></div>`;
  }
  function ieltsFoot(s) {
    const r = P.ires, n = s.qs.length;
    if (P.irev) {
      const k = P.irev.k, i = P.irev.order[k], d = P.idet.find((y) => y.i === i) || {}, last = k >= P.irev.order.length - 1;
      return `<div class="fb ${P.irev.wrong.includes(i) ? "bad" : "good"}"><b>${i + 1}-savol · javob: ${esc(s.qs[i].type === "tfng" ? String(d.answer || "").toUpperCase() : d.answer || "")}</b>${d.why ? esc(d.why) : ""}</div>
        <div class="row" style="flex-wrap:nowrap">${last ? "" : `<button class="btn soft grow" style="background:var(--card)" data-act="irevNext">Keyingisi (${k + 1}/${P.irev.order.length})</button>`}<button class="btn ${last ? "wide" : ""}" data-act="inext">Davom etish</button></div>`;
    }
    if (P.idet) return `<div class="fb good" role="status"><b>Barakalla! Hammasi to'g'ri${r && r.tries ? ` · ${r.tries}-urinishda` : ""}.</b>Izohlarni o'qing: har bir javob matnning qayerida ekanini ko'rish mumkin.</div><button class="btn wide" style="--accent:var(--rv)" data-act="inext">Davom etish</button>`;
    const status = r && r.score != null ? `<div class="fb bad" role="status"><b>${r.score} / ${n} to'g'ri${r.tries ? ` · ${r.tries}-urinish` : ""}</b>Qizil belgilangan javoblarni matndan qayta qidiring.</div>` : r && r.tries ? `<p class="sub small" style="text-align:center;margin:0">${r.tries} marta tekshirilgan</p>` : "";
    return `${status}<div class="row" style="flex-wrap:nowrap">${r && r.can_reveal ? `<button class="btn soft grow" style="background:var(--card)" data-act="ireveal">Javoblarni ko'rish</button>` : ""}<button class="btn grow" data-act="icheck" ${P.busy ? "disabled" : ""}>${P.busy ? "Tekshirilmoqda…" : "Tekshirish"}</button></div>
      ${r && r.tries && !r.can_reveal ? `<p class="sub small" style="text-align:center;margin:0">"Javoblarni ko'rish" 5-urinishdan keyin ochiladi</p>` : ""}`;
  }
  async function ieltsCheck() {
    const s = curStep();
    document.querySelectorAll(".ishort").forEach((el) => (P.ia[Number(el.dataset.i)] = el.value.trim()));
    if (P.ia.some((x) => !x)) { toast("Hamma savolga javob bering"); return; }
    P.busy = true; render();
    try {
      const r = await api("ielts_check", { p_quest: P.quest.id, p_step: s.id, p_answers: P.ia, p_ms: Date.now() - P.t0, p_state: P.preview ? null : P.state });
      P.t0 = Date.now(); P.busy = false; P.ires = r;
      if (r.details) P.idet = r.details;
    } catch (e) { P.busy = false; quiet(e); }
    render();
  }
  async function ieltsReveal() {
    const s = curStep();
    try {
      const r = await api("ielts_reveal", { p_quest: P.quest.id, p_step: s.id, p_state: P.preview ? null : P.state });
      P.idet = r.details;
      const wrong = (r.wrong && r.wrong.length ? r.wrong : (P.ires && P.ires.wrong) || []);
      const order = wrong.concat(s.qs.map((_, i) => i).filter((i) => !wrong.includes(i)));
      P.irev = { order, k: 0, wrong }; ieltsFocus();
    } catch (e) { quiet(e); }
  }
  function ieltsFocus() {
    const i = P.irev.order[P.irev.k], d = P.idet.find((y) => y.i === i);
    P.ihl = d && d.ev ? d.ev : null; render();
    const m = $("#hlMark"); if (m) m.scrollIntoView({ block: "center", behavior: "smooth" });
    const q = $("#iq" + i); if (q) q.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  /* ---------- writing ---------- */
  const wordCount = (t) => (String(t || "").trim() ? String(t).trim().split(/\s+/).length : 0);
  function writeBody(s) {
    const marked = P.wprev && P.wprev.mark != null;
    return `<span class="p-kind">Yozma ish</span><p class="p-q">${esc(s.title)}</p>
      <div class="card" style="white-space:pre-wrap">${esc(s.prompt)}</div>
      ${marked ? `<div class="fb good"><b>Baho: ${P.wprev.mark}/10</b>${esc(P.wprev.comment || "")}</div>` : P.wprev ? `<p class="sub small" style="margin:0">Siz buni yuborgansiz. O'qituvchi baholamaguncha o'zgartirib, qayta yuborishingiz mumkin.</p>` : ""}
      <textarea id="wbox" class="wbox" aria-label="Yozma ish" placeholder="Shu yerga o'zingiz yozing…" ${marked ? "disabled" : ""}>${esc(P.wtext || "")}</textarea>
      <div class="row between small"><span id="wcount" class="num"></span><span class="sub">Nusxa joylash (paste) o'chirilgan</span></div>`;
  }
  function writeFoot(s) {
    if (P.wprev && P.wprev.mark != null) return `<button class="btn wide" data-act="wnext">Davom etish</button>`;
    return `<button class="btn wide" id="wsend" data-act="wsend" ${P.busy ? "disabled" : ""}>${P.busy ? "Yuborilmoqda…" : P.wprev ? "Qayta yuborish" : "Yuborish"}</button>${P.wprev ? `<button class="link small" style="align-self:center;color:var(--sub)" data-act="wnext">O'zgartirmasdan davom etish</button>` : ""}`;
  }
  function writeCounter() {
    const s = curStep(), n = wordCount(P.wtext), el = $("#wcount"), b = $("#wsend");
    if (el) { el.textContent = `${n} / ${s.max} so'z · kamida ${s.min}`; el.style.color = n > s.max ? "var(--warn)" : n >= s.min ? "var(--rv)" : "var(--sub)"; }
    if (b && !P.busy) b.disabled = n < s.min || n > s.max;
  }
  async function writeSend() {
    const s = curStep(), n = wordCount(P.wtext);
    if (n < s.min) { toast(`Kamida ${s.min} so'z yozing`); return; }
    if (n > s.max) { toast(`Ko'pi bilan ${s.max} so'z`); return; }
    P.busy = true; render();
    try {
      const st = clone(P.state); st.i += 1; if (!st.final.includes(s.id)) st.final.push(s.id);
      const r = await api("writing_submit", { p_quest: P.quest.id, p_step: s.id, p_text: P.wtext, p_ms: Date.now() - P.t0, p_keys: P.wkeys, p_state: P.preview ? null : st });
      P.busy = false;
      if (r && r.error) { toast(r.error === "MARKED" ? "Bu ish allaqachon baholangan" : r.error === "TOO_SHORT" ? "Juda qisqa" : "Juda uzun"); render(); return; }
      store.del(P.wkey); toast(P.preview ? "Sinov: yuborish ishlaydi" : "Yuborildi! O'qituvchi baholaydi.");
      P.state = st; loadStep(); render(); const b = $(".p-body"); if (b) b.scrollTop = 0;
    } catch (e) { P.busy = false; quiet(e); render(); }
  }

  function ieltsNext() {
    const s = curStep(), st = clone(P.state); st.i += 1;
    if (!st.final.includes(s.id)) st.final.push(s.id);
    P.state = st;
    if (!P.preview) api("save_state", { p_quest: P.quest.id, p_state: st }).catch(() => {});
    loadStep(); render(); const b = $(".p-body"); if (b) b.scrollTop = 0;
  }

  function vPlay() {
    if (P) P.wide = false;
    const top = (pct, label) => `<div class="p-top"><button class="x" data-act="quit" aria-label="Chiqish">${I.x}</button><div class="p-prog"><i style="width:${pct}%"></i></div>${label ? `<span class="pill" style="max-width:40%;overflow:hidden;text-overflow:ellipsis">${esc(label)}</span>` : ""}</div>`;
    const shell = (inner, foot, pct, label) => `<div class="player" style="--accent:var(${P.accent || "--hw"})" role="dialog" aria-label="Vazifa">${top(pct || 0, label)}<div class="p-body ${P.wide ? "wide" : ""}">${inner}</div><div class="p-foot ${P.wide ? "wide" : ""}">${foot || ""}</div></div>`;
    if (P.error) return shell(`<div class="card"><p class="err">${esc(P.error)}</p></div>`, `<button class="btn wide" data-act="quit">Orqaga</button>`);
    if (P.daily && P.dailyDone) return shell(`<div class="stack" style="align-items:center;text-align:center;margin-top:8vh">${ring(100, "var(--rv)", 96)}<h1>Bugungi takrorlash bajarildi!</h1><p class="sub">${P.answered ? `${P.right} / ${P.answered} to'g'ri. ` : ""}Xato qilgan so'zlaringiz ertaga yana chiqadi.</p></div>`, `<button class="btn wide" data-act="quit">Bosh sahifaga qaytish</button>`, 100, "");
    if (P.daily && P.empty) return shell(`<h2>Takrorlash uchun so'z hali yo'q</h2><p class="sub">Vazifalarni bajaring: o'rgangan so'zlaringiz shu yerda takrorlanadi.</p>`, `<button class="btn wide" data-act="quit">Orqaga</button>`);
    if (P.practice && P.empty) return shell(`<h2>Hozircha mashq uchun savol yo'q</h2><p class="sub">Birinchi vazifani boshlang. O'rgangan so'z va savollaringiz shu yerda takrorlanadi.</p>`, `<button class="btn wide" data-act="quit">Orqaga</button>`);
    if (P.loading || (!P.quest && !P.practice) || (P.practice && !P.cur)) return shell(`<div class="loading">Yuklanmoqda…</div>`);

    let pct = 0, label = "";
    if (P.daily) { label = `${P.n} / ${P.goal}`; pct = Math.round((P.n / P.goal) * 100); }
    else if (P.practice) { label = `${P.right} / ${P.answered} to'g'ri`; pct = 100; }
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
    P.wide = s.t === "ielts";
    if (s.t === "ielts") return shell(ieltsBody(s), ieltsFoot(s), pct, label);
    if (s.t === "write") return shell(writeBody(s), writeFoot(s), pct, label);
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
    } else if (s.t === "match") {
      body = `<span class="p-kind">${s.rv ? "Takrorlash · " : ""}Mosini toping</span><p class="p-q">${esc(s.q)}</p>
        <div class="list">${s.left.map((l, i) => `<div class="li" style="cursor:default;flex-wrap:wrap"><b class="grow" style="font-weight:600;min-width:120px">${esc(l)}</b>
          <select data-chg="msel" data-v="${i}" aria-label="${esc(l)} uchun javob" style="max-width:60%;min-width:140px" ${locked ? "disabled" : ""}><option value="">— tanlang —</option>${P.mopts.map((o) => `<option ${P.msel[i] === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`).join("")}</div>`;
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
    if (s.t === "match") return P.msel.some((x) => !x) ? "" : P.msel.join(" | ");
    if (s.t === "gap" || s.t === "spell") { const el = $("#answerInput"); return ((el ? el.value : "") || P.typed || "").trim(); }
    if (s.t === "order") return P.pick.map((i) => s.words[i]).join(" ");
    if (s.t === "letters") return P.pick.map((i) => s.L[i]).join("");
    return "";
  }
  async function check() {
    if (!P || P.busy || P.result) return;
    const s = curStep();
    const ans = currentAnswer(s);
    if (!ans) { toast(s.t === "choice" || s.t === "tf" || s.t === "match" ? "Avval hamma javobni tanlang" : s.t === "order" || s.t === "letters" ? "Avval bo'laklarni joylang" : "Avval javobni yozing"); return; }
    if ((s.t === "order" && P.pick.length < s.words.length) || (s.t === "letters" && P.pick.length < s.L.length)) { toast("Hamma bo'laklarni joylang"); return; }
    P.typed = ans;
    if (P.practice) {
      P.busy = true; render();
      let res;
      try { res = await api(P.daily ? "daily_answer" : "practice_answer", { p_answer: ans, p_ms: Date.now() - P.t0 }); }
      catch (e) { if (e.net) { retryLater(check); return; } P.busy = false; quiet(e); render(); return; }
      P.busy = false; P.offline = false;
      if (res && res.error) { nextPractice(); return; }
      P.answered += 1; if (res.ok) P.right += 1;
      if (P.daily) { P.n = res.n; if (res.done) P.finishAfter = true; }
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
    if (P.practice && P.finishAfter) { P.dailyDone = true; P.result = null; render(); return; }
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
    showMonthly: false, monthly: null, monthlyCls: null, problems: [], poolView: null, poolRes: null };

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
    try {
      const cur = T.week === strFromDay(mondayOf(new Date()));
      const [r, ov, lh] = await Promise.all([api("admin_report", { p_class: T.cls, p_week: T.week }), api("admin_overview", { p_class: T.cls, p_week: T.week }),
        cur ? api("admin_lesson_hw", { p_class: T.cls }).catch(() => null) : null]);
      if (T.reportKey === key) {
        T.report = r; T.ov = Array.isArray(ov) ? ov : [];
        T.lh = lh && Array.isArray(lh.rows) ? { lw: lh.lw, map: Object.fromEntries(lh.rows.map((x) => [x.id, x.cells || []])) } : null;
        render();
      }
    } catch (e) { quiet(e); }
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
  function poolsInClass() {
    const ids = [...new Set(T.data.students.filter((s) => s.class_id === T.cls && s.pool_id).map((s) => s.pool_id))];
    return T.data.pools.filter((p) => ids.includes(p.id));
  }
  async function loadPoolRes() {
    const key = T.cls + "|" + T.poolView; T.poolRes = null; T.poolKey = key; render();
    try { const r = await api("admin_pool_results", { p_class: T.cls, p_pool: T.poolView, p_n: 3 }); if (T.poolKey === key) { T.poolRes = r; render(); } }
    catch (e) { quiet(e); }
  }
  function vPoolResults() {
    const pool = T.data.pools.find((p) => p.id === T.poolView);
    const back = `<div><button class="btn soft sm" style="background:var(--card)" data-act="poolView" data-v="">${I.back} Natijalar</button></div>`;
    if (!T.poolRes) return back + `<div class="loading">Yuklanmoqda…</div>`;
    const qs = T.poolRes.quests, rows = T.poolRes.rows;
    if (!qs.length) return back + `<div class="card empty">Bu pulga hali vazifa berilmagan.</div>`;
    const cell = (c) => {
      const st = c.done ? (c.late ? `<span class="pill amber">kech</span>` : `<span class="pill rv">vaqtida</span>`) : c.overdue ? `<span class="pill warn">bajarilmadi</span>` : c.pct ? `<span class="pill">jarayonda</span>` : "";
      return `<td class="c"><div style="display:flex;flex-direction:column;align-items:center;gap:4px">${ring(c.pct, c.done && !c.late ? "var(--rv)" : "var(--hw)", 46)}<b class="num small">${c.ochko} ochko</b>${st}</div></td>`;
    };
    return back + `<section class="card stack">
      <div class="row between"><div><h2>${esc(className(T.cls))} sinf · ${esc(pool ? pool.name : "")}</h2><p class="sub small">Oxirgi ${qs.length} ta vazifa · ${rows.length} o'quvchi</p></div><span class="row"><span class="logo">A</span><b>Abduqodir Teacher</b></span></div>
      <div class="tablebox" style="background:var(--card)"><table class="wide-table pooltbl"><thead><tr><th>#</th><th>O'quvchi</th>
        ${qs.map((q) => `<th class="c" style="white-space:normal">${esc(q.title)}${q.deadline ? `<br><span class="sub small" style="font-weight:400">${esc(fmtDate(q.deadline))}</span>` : ""}</th>`).join("")}<th class="c">Jami ochko</th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr><td class="num sub">${i + 1}</td><td><b style="font-weight:600">${esc(r.name)}</b></td>${r.cells.map(cell).join("")}<td class="c"><b class="num" style="font-size:18px">${r.total}</b></td></tr>`).join("")}
      </tbody></table></div>
      <p class="sub small">Doira: vazifaning bajarilgan qismi. Ochko: shu vazifadagi to'g'ri javoblar soni. "Kech" = muddatdan keyin tugatilgan.</p></section>`;
  }
  const METRICS = [
    { k: "hw", t: "Uy vazifasi", c: "--hw" }, { k: "cw", t: "Sinf ishi", c: "--cw" },
    { k: "wr", t: "Yozma ish", c: "--wr" }, { k: "rv", t: "Takrorlash", c: "--rv" },
  ];
  const lhOn = () => T.lh && (T.hwMode || "cur") === "cur";
  const lhCells = (o) => (T.lh && o && T.lh.map[o.id]) || [];
  function metricPct(o, k) {
    if (k === "hw" && lhOn()) { const c = lhCells(o); return c.length ? Math.round(c.reduce((a, x) => a + x.pct, 0) / c.length) : null; }
    const m = o && o[k]; return m ? m.pct : null;
  }
  function lhState(c) { return c.done ? (c.late ? "kech bajardi" : "bajardi") : c.overdue ? "bajarmadi" : c.pct ? "bajarmoqda" : "boshlamagan"; }
  function metricSub(o, k) {
    const m = o[k] || {};
    if (k === "hw") return m.n ? `${m.done}/${m.n} vazifa · ${m.ochko || 0} ochko${m.late ? ` · ${m.late} kech` : ""}` : "Bu hafta uy vazifasi yo'q";
    if (k === "cw") return m.n ? `${m.done}/${m.n} dars · ${m.ochko || 0} ochko` : "Bu hafta sinf ishi yo'q";
    if (k === "wr") return m.n ? `${m.n} ta ish · ${m.marked ? `o'rtacha ${m.avg}/10` : "baholanmagan"}` : "Yozma ish yo'q";
    return `${m.days || 0}/${m.of || 7} kun bajarilgan · ${m.ok || 0}/${m.n || 0} to'g'ri`;
  }
  function lhRings(r, M) {
    const cells = lhCells(r);
    if (!cells.length) return ring(null, `var(${M.c})`, 46);
    return `<span class="row" style="gap:6px;flex-wrap:nowrap">${cells.map((c) => `<span title="${esc(c.title)}">${ring(c.pct, c.done && !c.late ? "var(--rv)" : c.overdue ? "var(--warn)" : `var(${M.c})`, 46)}</span>`).join("")}</span>`;
  }
  const avgOf = (rows, k) => { const v = rows.map((o) => metricPct(o, k)).filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  function vResults() {
    const d = T.data;
    if (T.poolView) return vPoolResults();
    if (T.stuView) return vStudentPage();
    const head = `<div class="row between"><h1>Natijalar</h1><button class="btn soft sm" data-act="logout" style="background:var(--card)">${I.out} Chiqish</button></div>`;
    if (!d.classes.length) return head + `<div class="card empty">Avval Sozlamalar → Sinflar, pullar, o'quvchilar bo'limida sinf yarating.</div>`;
    const thisWeek = strFromDay(mondayOf(new Date()));
    const weekNav = `<div class="row"><button class="btn soft sm" style="background:var(--card)" data-act="week" data-v="-1" aria-label="Oldingi hafta">${I.back}</button><b class="small">${esc(weekLabel(T.week))}</b>
      <button class="btn soft sm" style="background:var(--card)" data-act="week" data-v="1" aria-label="Keyingi hafta" ${T.week >= thisWeek ? "disabled" : ""}>${I.chev}</button></div>`;
    const probs = T.problems.length ? `<button class="banner" style="border:0;cursor:pointer;background:var(--warn-s);color:var(--warn);font:inherit;font-weight:600;font-size:14px;text-align:left" data-act="tab" data-v="assign">${T.problems.length} ta savol bo'yicha o'quvchilar xato haqida xabar berdi ›</button>` : "";
    const pls = poolsInClass();
    const poolBtns = pls.length ? `<div class="row"><span class="sub small">Pul natijalari (oxirgi 3 vazifa):</span>${pls.map((p) => `<button class="btn sm" style="--accent:var(--cw)" data-act="poolView" data-v="${p.id}">${esc(p.name)}</button>`).join("")}</div>` : "";
    const mk = T.metric || "hw", M = METRICS.find((x) => x.k === mk);
    if (!T.ov) return head + probs + classSeg() + weekNav + `<div class="loading">Yuklanmoqda…</div>`;
    const rows = T.ov;
    const tiles = `<div class="mtiles">${METRICS.map((m) => { const v = avgOf(rows, m.k);
      return `<button class="mtile" aria-pressed="${mk === m.k}" style="--t:var(${m.c})" data-act="metric" data-v="${m.k}">${ring(v, `var(${m.c})`, 52)}<b>${m.t}</b><span class="small sub">sinf o'rtachasi</span></button>`; }).join("")}</div>`;
    const flags = {}; ((T.report && T.report.rows) || []).forEach((r) => { if (r.flag) flags[r.id] = r.flag; });
    const byPool = {};
    rows.forEach((r) => { const k = r.pool || "Pulsiz"; (byPool[k] = byPool[k] || []).push(r); });
    const groups = Object.keys(byPool).sort().map((p) => `<h3>${esc(p)} · ${byPool[p].length} o'quvchi · o'rtacha ${avgOf(byPool[p], mk) == null ? "—" : avgOf(byPool[p], mk) + "%"}</h3><div class="list">${byPool[p].slice().sort((a, b) => (metricPct(b, mk) ?? -1) - (metricPct(a, mk) ?? -1)).map((r) => `
      <button class="li" data-act="stu" data-v="${r.id}">${mk === "hw" && lhOn() ? lhRings(r, M) : ring(metricPct(r, mk), `var(${M.c})`, 46)}<span class="grow"><b style="font-weight:600">${esc(r.name)}</b><br>
        <span class="sub small">${esc(mk === "hw" && lhOn() ? (lhCells(r).length ? lhCells(r).map((c) => `${c.title}: ${lhState(c)}`).join(" · ") : "Hozirgi vazifa yo'q") : metricSub(r, mk))}</span>${flags[r.id] ? `<div class="flag ${flags[r.id].kind}" style="margin-top:6px">${esc(flags[r.id].text)}</div>` : ""}</span><span class="chev">${I.chev}</span></button>`).join("")}</div>`).join("");
    let hwHead = "";
    if (mk === "hw" && T.lh) {
      const lw = T.lh.lw, on = lhOn();
      const when = !lw ? "" : lw.now ? "Hozir dars ketmoqda" : `Keyingi dars: ${dayName(lw.start)} ${clock(lw.start)}`;
      hwHead = `<div class="seg" role="group" aria-label="Uy vazifasi ko'rinishi"><button aria-pressed="${on}" data-act="hwMode" data-v="cur">Hozirgi vazifa</button><button aria-pressed="${!on}" data-act="hwMode" data-v="week">Butun hafta</button></div>
        <p class="sub small" style="margin:0">${on ? `${esc(when)}${when ? ". " : ""}Faqat oldingi darsdan keyin berilgan, shu darsgacha bo'lgan vazifa(lar). Har bir vazifa alohida doira.` : "Shu haftada muddati tugaydigan barcha uy vazifalari birga."}</p>`;
    }
    return head + probs + classSeg() + weekNav + tiles + poolBtns + `<h2>${M.t}</h2>` + hwHead + (rows.length ? groups : `<div class="card empty">Bu sinfda hali o'quvchi yo'q.</div>`) +
      `<p class="sub small">O'quvchini bosing: oxirgi 18 ta vazifa grafigi va vaqt taqsimoti. Takrorlash = kunlik 10 so'zlik majburiy takrorlash bajarilgan kunlar.</p>`;
  }

  /* one student: graph of last 18 tasks + time split */
  async function loadStudentPage(id) {
    T.stu = null; render();
    try { const r = await api("admin_student", { p_student: id }); if (T.stuView === id) { T.stu = r; render(); } } catch (e) { quiet(e); }
  }
  function lineChart(points, color) {
    if (!points.length) return `<div class="card empty">Hali ma'lumot yo'q.</div>`;
    const narrow = window.innerWidth < 600, W = narrow ? 360 : 680, H = narrow ? 230 : 260, L = 30, Rr = 14, Tp = 26, B = 40, n = points.length;
    const x = (i) => n === 1 ? (L + W - Rr) / 2 : L + (i * (W - L - Rr)) / (n - 1);
    const y = (v) => Tp + ((100 - v) * (H - Tp - B)) / 100;
    const avg = Math.round(points.reduce((a, p) => a + p.v, 0) / n);
    let g = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Oxirgi ${n} ta natija, o'rtacha ${avg}%">`;
    [0, 50, 100].forEach((v) => { g += `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="ct">${v}</text>`; });
    g += `<path d="${points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.v)}`).join(" ")} L${x(n - 1)},${y(0)} L${x(0)},${y(0)}Z" fill="${color}" opacity=".08"/>`;
    g += `<polyline points="${points.map((p, i) => `${x(i)},${y(p.v)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;
    g += `<line x1="${L}" x2="${W - Rr}" y1="${y(avg)}" y2="${y(avg)}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="6 5" opacity=".55"/><text x="${W - Rr}" y="${y(avg) - 6}" text-anchor="end" class="ct" style="font-weight:700;fill:var(--ink)">o'rtacha ${avg}%</text>`;
    points.forEach((p, i) => {
      const st = p.state, fill = st === "ok" ? "var(--rv)" : st === "late" ? "var(--amber)" : st === "miss" ? "var(--card)" : color, stroke = st === "miss" ? "var(--warn)" : "var(--card)";
      g += `<circle cx="${x(i)}" cy="${y(p.v)}" r="6" fill="${fill}" stroke="${stroke}" stroke-width="2.5"><title>${esc(p.t)}: ${p.v}%</title></circle>`;
      if (!narrow || n <= 9 || i % 2 === 0 || i === n - 1) g += `<text x="${x(i)}" y="${y(p.v) - 11}" text-anchor="middle" class="ct" style="font-weight:700;fill:var(--ink)">${p.v}</text>`;
      if ((narrow ? n <= 6 : n <= 9) || i % (narrow ? 3 : 2) === 0) g += `<text x="${x(i)}" y="${H - 14}" text-anchor="middle" class="ct">${esc(p.d)}</text>`;
    });
    return g + `</svg>`;
  }
  function vStudentPage() {
    const back = `<div><button class="btn soft sm" style="background:var(--card)" data-act="stu" data-v="">${I.back} Natijalar</button></div>`;
    const st = T.stu;
    if (!st) return back + `<div class="loading">Yuklanmoqda…</div>`;
    const kind = T.stuKind || "hw";
    const shortDate = (iso) => { const d = new Date(iso); return `${d.getDate()}.${pad(d.getMonth() + 1)}`; };
    let pts = [];
    if (kind === "wr") pts = st.writings.filter((w) => w.mark != null).map((w) => ({ v: w.mark * 10, t: w.title || "Yozma ish", d: shortDate(w.submitted_at), state: "ok" }));
    else pts = st.tasks.filter((t) => t.kind === kind && new Date(t.at) <= new Date()).map((t) => ({ v: t.pct, t: t.title, d: shortDate(t.at),
      state: t.completed_at ? (t.late ? "late" : "ok") : t.deadline && new Date(t.deadline) < new Date() ? "miss" : "open", ochko: t.ochko }));
    const color = kind === "hw" ? "var(--hw)" : kind === "cw" ? "var(--cw)" : "var(--wr)";
    const tw = st.time.week, ta = st.time.all, sum = (o) => o.hw + o.cw + o.rv + o.wr;
    const timeCard = (title, o) => `<div class="card stack" style="gap:6px"><h3>${title}: ${fmtTime(sum(o))}</h3>
      ${[["Uy vazifasi", o.hw, "--hw"], ["Sinf ishi", o.cw, "--cw"], ["Takrorlash", o.rv, "--rv"], ["Yozma ish", o.wr, "--wr"]].map(([l, v, c]) => `<div class="row" style="flex-wrap:nowrap"><span style="width:96px" class="small">${l}</span><div class="bar grow" style="margin:0"><i style="width:${sum(o) ? (v / sum(o)) * 100 : 0}%;background:var(${c})"></i></div><span class="small num" style="width:92px;text-align:right;white-space:nowrap">${fmtTime(v)}</span></div>`).join("")}</div>`;
    const list = kind === "wr" ? st.writings.slice().reverse().map((w) => `<div class="li"><span class="grow">${esc(w.title || "Yozma ish")}<br><span class="sub small">${esc(fmtDate(w.submitted_at))} · ${w.words} so'z</span></span>${w.mark != null ? `<b>${w.mark}/10</b>` : `<span class="pill">baholanmagan</span>`}</div>`).join("")
      : st.tasks.filter((t) => t.kind === kind).slice().reverse().map((t) => `<div class="li"><span class="grow">${esc(t.title)}<br><span class="sub small">${t.deadline ? esc(fmtDate(t.deadline)) : esc(shortDate(t.at))} · ${t.ochko} ochko</span></span>
        ${t.completed_at ? (t.late ? `<span class="pill amber">kech</span>` : `<span class="pill rv">vaqtida</span>`) : t.deadline && new Date(t.deadline) < new Date() ? `<span class="pill warn">bajarilmadi</span>` : ""}<b class="num" style="width:44px;text-align:right">${t.pct}%</b></div>`).join("");
    return back + `<section class="card stack">
      <div class="row between"><div><h2>${esc(st.name)}</h2><p class="sub small" style="margin:0">${esc(st.class || "")}${st.pool ? " · " + esc(st.pool) : ""}</p></div><span class="row"><span class="logo">A</span><b>Abduqodir Teacher</b></span></div>
      <div class="seg" role="group" aria-label="Turi">${[["hw", "Uy vazifasi"], ["cw", "Sinf ishi"], ["wr", "Yozma ish"]].map(([k, l]) => `<button aria-pressed="${kind === k}" data-act="stuKind" data-v="${k}">${l}</button>`).join("")}</div>
      <h3>Oxirgi ${pts.length} ta ${kind === "wr" ? "yozma ish (baho × 10)" : "vazifa"}</h3>
      <div class="chartbox">${lineChart(pts, color)}</div>
      <div class="row small sub"><span class="row" style="gap:5px"><i class="lg" style="background:var(--rv)"></i>vaqtida</span><span class="row" style="gap:5px"><i class="lg" style="background:var(--amber)"></i>kech</span><span class="row" style="gap:5px"><i class="lg" style="background:var(--card);border:2px solid var(--warn)"></i>bajarilmadi</span><span class="row" style="gap:5px"><i class="lg" style="background:${color}"></i>jarayonda</span><span>- - - o'rtacha</span></div>
      </section>
      <div class="grid2">${timeCard("Bu hafta", tw)}${timeCard("Jami", ta)}</div>
      <div class="card stack" style="gap:6px"><h3>Takrorlash</h3><p class="small" style="margin:0">Oxirgi 7 kunda kunlik takrorlash: <b>${st.review.days7}/7 kun</b> · o'rganilgan so'zlar: <b>${st.review.words}</b> · yaxshi eslab qolingan: <b>${st.review.strong}</b></p></div>
      ${list ? `<div class="list">${list}</div>` : ""}`;
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
    const lhUse = T.week === thisWeek && lhOn();
    const lhAvg = (() => { const v = rows.map((r) => metricPct({ id: r.id }, "hw")).filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; })();
    const avgPct = lhUse ? lhAvg : withHw.length ? Math.round(withHw.reduce((a, r) => a + r.pct, 0) / withHw.length) : null;
    const lw = T.lh && T.lh.lw, when = !lw ? "" : lw.now ? "Hozir dars ketmoqda" : `Keyingi dars: ${dayName(lw.start)} ${clock(lw.start)}`;
    const hwToggle = T.week === thisWeek && T.lh ? `<div class="row"><div class="seg" role="group" aria-label="Uy vazifasi doirasi"><button aria-pressed="${lhOn()}" data-act="hwMode" data-v="cur">Hozirgi vazifa</button><button aria-pressed="${!lhOn()}" data-act="hwMode" data-v="week">Butun hafta</button></div>
      <span class="sub small">${lhOn() ? `${esc(when)}${when ? " · " : ""}uy vazifasi doiralari faqat shu darsgacha berilgan vazifa(lar)ni ko'rsatadi, har biri alohida.` : "Uy vazifasi doirasi shu haftaning barcha vazifalari bo'yicha."}</span></div>` : "";
    const avgTime = Math.round(rows.reduce((a, r) => a + r.seconds, 0) / rows.length);
    const totAns = rows.reduce((a, r) => a + r.answered, 0), totCor = rows.reduce((a, r) => a + r.correct, 0);
    const winners = T.report.winners || [];
    const top5 = rows.filter((r) => r.correct > 0).slice(0, 5);
    const ovOf = (id, k) => { const o = (T.ov || []).find((x) => x.id === id); return o && o[k] ? o[k].pct : null; };
    const ovRows = T.ov || [];
    return head + hwToggle + `<section class="card stack">
      <div class="row between"><div><h2>${esc(className(T.cls))} sinf · haftalik natijalar</h2><p class="sub small">${esc(weekLabel(T.week))} · ${rows.length} o'quvchi</p></div><span class="row"><span class="logo">A</span><b>Abduqodir Teacher</b></span></div>
      <div class="mtiles static">${[["Uy vazifasi", avgPct, "--hw"], ["Takrorlash", avgOf(ovRows, "rv"), "--rv"], ["Lug'at", avgOf(ovRows, "vocab"), "--cw"], ["Yozma ish", avgOf(ovRows, "wr"), "--wr"]].map(([l, v, c]) => `<div class="mtile">${ring(v, `var(${c})`, 56)}<b>${l}</b><span class="small sub">sinf o'rtachasi</span></div>`).join("")}</div>
      <div class="kpis"><div class="kpi"><b>${fmtTime(avgTime)}</b><span>O'rtacha vaqt</span></div>
        <div class="kpi"><b>${totAns ? Math.round((totCor / totAns) * 100) + "%" : "—"}</b><span>O'rtacha aniqlik</span></div><div class="kpi"><b>${totAns}</b><span>Jami javoblar</span></div><div class="kpi"><b>${totCor}</b><span>Jami ochko</span></div></div>
      ${top5.length ? `<div><h3>Eng yaxshi ${top5.length} o'quvchi</h3><div class="list" style="margin-top:8px">${top5.map((r, i) => `<div class="li"><b class="num" style="width:22px;color:${i < 3 ? "var(--tr)" : "var(--sub)"}">${i + 1}</b><span class="grow">${esc(r.first_name + " " + r.last_name)}</span><b class="num">${r.correct} ochko</b></div>`).join("")}</div></div>` : ""}
      ${winners.length ? `<div class="winners">${winners.map((w) => { const b = BIG.find((x) => x.k === w.kind) || {}; return `<div class="winner"><span class="t">${I[b.ic] || ""}${esc(b.t || w.kind)}</span><span class="n">${esc(w.name)}</span><p>${esc(b.n || "")}</p></div>`; }).join("")}</div>` : ""}
      <div class="tablebox" style="background:var(--card)"><table class="wide-table"><thead><tr><th>#</th><th>O'quvchi</th><th class="c">Uy vazifasi</th><th class="c">Takrorlash</th><th class="c">Lug'at</th><th class="c">Yozma ish</th><th>Ochko</th><th>Tugatgan</th><th>Vaqt</th><th>Javoblar</th><th>Izoh</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td class="num sub">${i + 1}</td><td><button class="link" style="font-weight:600;color:var(--ink);text-align:left" data-act="stuR" data-v="${r.id}">${esc(r.first_name + " " + r.last_name)}</button><br><span class="sub small">${esc(r.pool || "")}</span></td>
        <td class="c">${lhUse ? `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">${lhRings(r, { c: "--hw" })}${lhCells(r).length > 1 ? `<span class="sub small">${lhCells(r).length} ta vazifa</span>` : ""}</div>` : ring(r.pct, "var(--hw)", 46)}</td><td class="c">${ring(ovOf(r.id, "rv"), "var(--rv)", 46)}</td><td class="c">${ring(ovOf(r.id, "vocab"), "var(--cw)", 46)}</td><td class="c">${ring(ovOf(r.id, "wr"), "var(--wr)", 46)}</td>
        <td class="num"><b>${r.correct}</b></td>
        <td class="num">${r.quests ? `${r.finished} / ${r.quests}` : "—"}${r.late ? ` <span class="pill amber">${r.late} kech</span>` : ""}</td><td class="num">${fmtTime(r.seconds)}</td>
        <td class="num">${r.answered}${r.practice_n ? `<br><span class="sub small">+${r.practice_n} mashq</span>` : ""}</td>
        <td>${r.flag ? `<div class="flag ${r.flag.kind}">${esc(r.flag.text)}</div>` : `<span class="sub">—</span>`}</td></tr>`).join("")}
      </tbody></table></div>
      <p class="sub small">Takrorlash = kunlik 10 so'zlik takrorlash bajarilgan kunlar. Lug'at = shu haftaning so'zlaridan o'rganilganlari. Yozma ish = o'rtacha baho × 10. Ochko = shu haftadagi to'g'ri javoblar soni. Ismni bosing: o'quvchi sahifasi. Doira to'la bo'lsa, o'quvchi shu haftaning barcha vazifalarini bajargan (dushanba ertalabgacha muddatli vazifalar o'tgan haftaga kiradi). Izohlar faqat bir xil holat bir necha marta takrorlanganda qo'yiladi.</p></section>
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
  async function loadWritings() {
    try { T.writ = await api("admin_writings", { p_class: null, p_all: !!T.wAll }); } catch (e) { quiet(e); }
    render();
  }
  function writingRequest(list) {
    return `Abduqodir Teacher — writing feedback request
Instructions for Claude: below are English writings by Uzbek school students (beginner to pre-intermediate). For EACH writing give a mark out of 10 for its level (task done, grammar, vocabulary, organisation) and short, kind feedback IN UZBEK: one thing done well, then 1–3 concrete mistakes with the corrected version. Keep each feedback under 60 words, on one line.
Reply ONLY with one code block, one line per writing, exactly in this format:
@w ID | MARK | feedback
` + list.map((w) => `
---
#${w.id} · ${w.student} · ${w.class || ""} · ${w.title || "Yozma ish"} (${w.words} words, max ${w.max || 150})
Task: ${String(w.prompt || "").replace(/\s+/g, " ")}
Text:
${w.text}`).join("\n") + "\n---\n";
  }
  function parseFeedback(text) {
    const out = [], errs = [];
    String(text || "").split(/\r?\n/).forEach((l, i) => {
      const t = l.trim(); if (!t.startsWith("@w")) return;
      const m = t.match(/^@w\s*#?(\d+)\s*\|\s*(\d+(?:[.,]\d+)?)\s*(?:\/\s*10)?\s*\|\s*(.+)$/);
      if (!m) { errs.push(`${i + 1}-qator tushunilmadi`); return; }
      const mark = Math.round(Number(m[2].replace(",", ".")));
      if (!(mark >= 0 && mark <= 10)) { errs.push(`${i + 1}-qator: baho 0–10 bo'lsin`); return; }
      out.push({ id: Number(m[1]), mark, comment: m[3].trim() });
    });
    return { items: out, errs };
  }
  function vWritings() {
    const all = T.writ;
    const back = `<div><button class="btn soft sm" style="background:var(--card)" data-act="wview" data-v="">${I.back} Topshiriqlar</button></div>`;
    if (!all) return back + `<div class="loading">Yuklanmoqda…</div>`;
    const list = T.wCls ? all.filter((w) => w.class_id === T.wCls) : all;
    const unmarked = list.filter((w) => w.mark == null);
    const segs = `<div class="seg" role="group" aria-label="Sinf"><button aria-pressed="${!T.wCls}" data-act="wcls" data-v="">Hammasi</button>${T.data.classes.map((c) => `<button aria-pressed="${T.wCls === c.id}" data-act="wcls" data-v="${c.id}">${esc(c.name)}</button>`).join("")}</div>`;
    const fp = T.wParsed;
    const preview = fp ? `<div class="fb ${fp.items.length ? "good" : "bad"}"><b>${fp.items.length} ta baho topildi${fp.errs.length ? ` · ${fp.errs.length} ta xato qator` : ""}</b>
        ${fp.items.map((x) => { const w = all.find((y) => y.id === x.id); return `<div class="small" style="margin-top:4px">${w ? esc(w.student) : `#${x.id} (topilmadi)`}: <span style="font-weight:700">${x.mark}/10</span> · ${esc(x.comment.slice(0, 80))}${x.comment.length > 80 ? "…" : ""}</div>`; }).join("")}
        ${fp.errs.map((e) => `<div class="small err">${esc(e)}</div>`).join("")}</div>
        ${fp.items.length ? `<button class="btn" style="--accent:var(--rv)" data-act="aiSave">Hammasini saqlash (${fp.items.length})</button>` : ""}` : "";
    const card = (w) => {
      const sus = w.text.length > 120 && w.keys < w.text.length * 0.5;
      return `<section class="card stack"><div class="row between"><div><b style="font-weight:600">${esc(w.student)}</b> <span class="sub small">${esc(w.class || "")}</span><br>
          <span class="small sub">${esc(w.quest)} · ${esc(w.title || "")} · ${w.words} so'z · ${fmtTime(Math.round(w.ms / 1000))} · ${esc(fmtDate(w.submitted_at))}</span></div>
          ${w.mark != null ? `<span class="pill rv" style="font-size:15px">${w.mark}/10</span>` : `<span class="pill amber">Baholanmagan</span>`}</div>
        ${sus ? `<div class="flag amber">Shubhali: matnning katta qismi klaviaturada yozilmaganga o'xshaydi (avtoto'ldirish yoki boshqa usul bilan qo'yilgan bo'lishi mumkin).</div>` : ""}
        <p style="white-space:pre-wrap;margin:0;overflow-wrap:anywhere">${esc(w.text)}</p>
        <div class="row" style="flex-wrap:nowrap;align-items:flex-start"><select id="wm-${w.id}" aria-label="Baho" style="max-width:90px">${w.mark == null ? `<option value="" selected>Baho</option>` : ""}${Array.from({ length: 11 }, (_, i) => `<option value="${i}" ${w.mark === i ? "selected" : ""}>${i}/10</option>`).join("")}</select>
          <textarea id="wc-${w.id}" aria-label="Izoh" style="min-height:44px" placeholder="Izoh (o'quvchi ko'radi)">${esc(w.comment || "")}</textarea></div>
        <button class="btn sm" style="align-self:flex-start" data-act="wsave" data-v="${w.id}">Saqlash</button></section>`;
    };
    return back + `<div class="row between"><h1>Yozma ishlar</h1><div class="seg" role="group"><button aria-pressed="${!T.wAll}" data-act="wall" data-v="0">Baholanmagan</button><button aria-pressed="${!!T.wAll}" data-act="wall" data-v="1">Hammasi</button></div></div>${segs}
      <section class="card stack"><h3>AI bilan baholash</h3>
        <p class="sub small" style="margin:0">1) "Nusxalash"ni bosing va Claude'ga yuboring. 2) Claude qaytargan kodni pastga joylang. 3) Tekshirib, "Hammasini saqlash"ni bosing. Har o'quvchi faqat o'z izohini ko'radi.</p>
        <div class="row"><button class="btn" style="--accent:var(--cw)" data-act="wcopy" ${unmarked.length ? "" : "disabled"}>Baholanmaganlarni nusxalash (${unmarked.length})</button></div>
        ${T.wCopyText ? `<textarea id="wCopyBox" class="code" readonly style="min-height:120px">${esc(T.wCopyText)}</textarea><p class="sub small" style="margin:0">Nusxalash ishlamasa, matnni belgilab o'zingiz nusxalang.</p>` : ""}
        <textarea id="aiBox" class="code" placeholder="@w 12 | 7 | Yaxshi..." style="min-height:90px">${esc(T.aiText || "")}</textarea>
        <div class="row"><button class="btn soft" data-act="aiParse">Tekshirish</button></div>${preview}</section>
      ${list.length ? list.map(card).join("") : `<div class="card empty">${T.wAll ? "Hali yozma ish yo'q." : "Hamma ishlar baholangan."}</div>`}`;
  }
  /* ---------- class game (teacher hosts on the board) ---------- */
  async function cgPoll() {
    if (!T.cg || !T.cg.id) return;
    try { T.cg.st = await api("vg_host_state", { p_id: T.cg.id }); } catch (e) {}
    if (T.tab === "assign" && T.cg) render();
  }
  function cgStop() { clearInterval(T.cgTimer); T.cgTimer = null; }
  function vClassGame() {
    const back = `<div><button class="btn soft sm" style="background:var(--card)" data-act="cg" data-v="">${I.back} Topshiriqlar</button></div>`;
    const cg = T.cg;
    if (!cg.id) {
      const cls = T.data.classes;
      return back + `<h1>Sinf o'yini</h1><p class="sub">Darsda butun sinf bilan so'z o'yini (Kahoot kabi). Doskada kodni ko'rsatasiz, o'quvchilar "Lug'at → Sinf o'yini" orqali kiradi. To'g'ri javobdan keyin ba'zan sandiq chiqadi: o'g'irlash, qalqon yoki ×2.</p>
        <section class="card stack">
          <div><label>Sinf</label><div class="seg" role="group">${cls.map((c) => `<button aria-pressed="${cg.cls === c.id}" data-act="cgcls" data-v="${c.id}">${esc(c.name)}</button>`).join("")}</div></div>
          <div><label for="cgq">So'zlar</label><select id="cgq"><option value="">Oxirgi bir oydagi barcha so'zlar</option>${T.data.quests.map((q) => `<option value="${q.id}">${esc(q.title)}</option>`).join("")}</select></div>
          <div><label for="cgn">Savollar soni</label><select id="cgn"><option>5</option><option selected>10</option><option>15</option><option>20</option></select></div>
          <button class="btn" style="--accent:var(--hw)" data-act="cgcreate" ${cg.cls ? "" : "disabled"}>O'yin yaratish</button></section>`;
    }
    const st = cg.st;
    if (!st) return back + `<div class="loading">Yuklanmoqda…</div>`;
    const board = (n) => `<div class="list">${st.board.slice(0, n).map((x, k) => `<div class="li"><b class="num" style="width:26px;color:${k < 3 ? "var(--tr)" : "var(--sub)"}">${k + 1}</b><span class="grow" style="font-size:18px">${esc(x.name)}</span><b class="num" style="font-size:18px">${x.score}</b></div>`).join("")}</div>`;
    const feed = st.feed.length ? `<div class="card stack" style="gap:4px">${st.feed.map((f) => `<p class="small" style="margin:0">${esc(f)}</p>`).join("")}</div>` : "";
    const head = `<div class="row between">${back}<span class="pill">Kod: <b>${esc(st.code)}</b></span></div>`;
    if (st.state === "lobby") return head + `<section class="card stack" style="align-items:center;text-align:center;padding:28px 16px">
        <p class="sub" style="margin:0">O'quvchilar: Lug'at → Sinf o'yini → kodni kiriting</p><div class="cgcode">${esc(st.code)}</div>
        <h2>${st.players} o'quvchi kirdi</h2><div class="row" style="justify-content:center">${st.names.map((n) => `<span class="pill">${esc(n)}</span>`).join("")}</div>
        <button class="btn" style="--accent:var(--rv)" data-act="cgnext" ${st.players ? "" : "disabled"}>Boshlash · ${st.n} savol</button></section>`;
    if (st.state === "q") return head + `<section class="card stack" style="text-align:center;padding:24px 16px">
        <p class="sub" style="margin:0">${st.qi + 1} / ${st.n} savol · ${st.left} soniya · ${st.answered}/${st.players} javob berdi</p>
        <div class="cgq">${esc(st.q.q)}</div>
        <div class="opts two" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${st.q.opts.map((o) => `<div class="opt" style="pointer-events:none;justify-content:center">${esc(o)}</div>`).join("")}</div>
        <button class="btn soft" style="background:var(--bg)" data-act="cgnext">Vaqtni to'xtatib, keyingisiga</button></section>`;
    if (st.state === "board") return head + `<section class="card stack" style="text-align:center"><p class="sub" style="margin:0">${st.qi + 1} / ${st.n} savol</p><div class="cgq" style="font-size:28px">${esc(st.q.q)} → <span style="color:var(--rv)">${esc(st.q.ans)}</span></div>
        <p class="sub" style="margin:0">${st.answered}/${st.players} javob berdi</p></section>${feed}${board(10)}
        <button class="btn" data-act="cgnext">${st.qi + 1 >= st.n ? "Yakuniy natijalar" : "Keyingi savol"}</button>`;
    return head + `<section class="card stack" style="text-align:center"><h1>O'yin tugadi!</h1><p class="sub" style="margin:0">Oltin o'quvchilarga berildi: to'g'ri javoblar + 1–3-o'rinlarga bonus.</p></section>
      ${board(st.board.length)}<button class="btn" data-act="cgnew">Yangi o'yin</button>`;
  }
  function vAssign() {
    if (T.cg) return vClassGame();
    if (T.wview) return vWritings();
    const d = T.data, pr = T.parsed;
    let summary = "";
    if (pr) {
      if (pr.errors.length) summary = `<div class="fb bad"><b>Xatolar bor, tuzating:</b><ul class="errlist">${pr.errors.map((e) => `<li>${e.line}-qator: ${esc(e.msg)}</li>`).join("")}</ul></div>`;
      else {
        const total = pr.quests.reduce((a, q) => a + q.gradable, 0);
        summary = `<div class="fb good"><b>${pr.quests.length} ta vazifa · ${total} ta savol tayyor</b></div>
          <div class="row"><label for="weekPick" style="margin:0">Hafta (dushanba):</label><input id="weekPick" type="date" value="${esc(T.weekPick)}" data-chg="weekPick" style="max-width:180px"><span class="sub small">${esc(weekLabel(T.weekPick))}</span></div>
          <div class="list">${pr.quests.map((q, i) => {
            const missing = q.pool && !d.pools.some((p) => p.name.toLowerCase() === q.pool.toLowerCase());
            const dd = q.kind === "hw" ? dueToDate(T.weekPick, q.due) : null;
            const kindTxt = q.kind === "cw" ? `<span class="pill cw">Sinf ishi · ${q.lesson}-dars</span>` : q.kind === "vl" ? `<span class="pill">Lug'at guruhi</span> <span class="sub small">faqat takrorlash, vazifa emas</span>` : `<span class="pill hw">Uy vazifasi</span> <span class="sub small">${q.after && !q.due ? `${q.after}-darsdan keyin ochiladi · muddat: keyingi kundagi dars boshigacha (har sinf o'z jadvali bo'yicha)` : q.due && q.due.lesson ? `${q.after ? q.after + "-darsdan keyin ochiladi · " : ""}muddat: har bir sinfning ${q.due.lesson}-darsi boshigacha (o'z jadvali bo'yicha)` : dd ? "muddat: " + esc(fmtDate(dd.toISOString())) : "muddatsiz"}</span>`;
            return `<div class="li" style="flex-wrap:wrap"><span class="grow" style="min-width:180px"><b style="font-weight:600">${esc(q.title)}</b><br>${kindTxt}<br><span class="sub small">${q.circles.length} doira · ${q.gradable} savol</span>${missing ? `<br><span class="err small">"${esc(q.pool)}" nomli pul topilmadi</span>` : ""}</span>
              <select data-chg="poolPick" data-v="${i}" aria-label="Pul" style="max-width:220px">${opts(d.pools, T.poolPick[i] ? Number(T.poolPick[i]) : null, "— pulni tanlang —")}</select></div>`;
          }).join("")}</div>
          <button class="btn" style="--accent:var(--rv)" data-act="saveQuests" ${T.saving ? "disabled" : ""}>${T.saving ? "Saqlanmoqda…" : "Hammasini saqlash"}</button>`;
      }
    }
    const probs = T.problems.length ? `<section class="card stack"><h3>O'quvchilar xabar bergan savollar · ${T.problems.length}</h3>
      ${T.problems.map((r) => `<div class="fb bad"><p><b style="display:inline">${esc(r.quest)}</b> · ${esc(r.student)} · ${esc(fmtDate(r.at))}</p><p>Savol: <i>${esc(r.text || r.step)}</i></p>${r.note ? `<p>Izoh: ${esc(r.note)}</p>` : ""}
        <div class="row" style="margin-top:6px"><button class="btn soft sm" data-act="preview" data-v="${r.quest_id}">Vazifani ko'rish</button><button class="btn sm" data-act="probDone" data-v="${r.id}">Ko'rib chiqildi</button></div></div>`).join("")}</section>` : "";
    const card = (q) => {
      const conf = T.confirm === "del-q:" + q.id, open = T.openStudents === q.id, indiv = q.students || [];
      return `<section class="card stack">
        <div class="row between"><h3>${esc(q.title)}</h3><div class="row">${q.problems ? `<span class="pill warn">${q.problems} xabar</span>` : ""}${q.hidden ? `<span class="pill">Yashirin</span>` : ""}<span class="pill rv">${q.finished} tugatdi</span></div></div>
        <div class="grid2"><div><label for="qp-${q.id}">Pul</label><select id="qp-${q.id}" data-chg="qPool" data-v="${q.id}">${opts(d.pools, q.pool_id, "— faqat alohida o'quvchilar —")}</select></div>
          ${q.kind === "cw" ? `<div><label>Qachon ochiladi</label><p style="margin:6px 0 0">${q.lesson ? `<b>${q.lesson}-dars</b>` : "Darsga bog'lanmagan"}${q.week_start ? ` · ${esc(weekLabel(q.week_start))}` : ""}</p><p class="sub small" style="margin:2px 0 0">Dars jadvaliga ko'ra ochiladi, tugatilmasa 3 kun ochiq turadi.</p></div>` : `<div><label for="qd-${q.id}">Muddat${q.due_lesson ? ` · har sinf: ${q.due_lesson}-dars boshi` : q.after_lesson && q.due_lesson == null ? ` · ${q.after_lesson}-darsdan keyin, keyingi kun darsigacha (har sinf)` : ""}</label><div class="row" style="flex-wrap:nowrap"><input id="qd-${q.id}" type="datetime-local" value="${esc(toLocalInput(q.deadline))}" data-chg="qDeadline" data-v="${q.id}">
            ${q.deadline ? `<button class="btn soft sm" data-act="qNoDeadline" data-v="${q.id}" aria-label="Muddatni olib tashlash">${I.x}</button>` : ""}</div></div>`}</div>
        <div class="row"><label class="row" style="margin:0;gap:8px;color:var(--ink);font-size:15px;font-weight:500"><input type="checkbox" data-chg="qHidden" data-v="${q.id}" ${q.hidden ? "checked" : ""}> O'quvchilardan yashirish</label>
          <span class="sub small">${q.gradable} savol · ${(q.circles || []).length} doira · ${esc(fmtDate(q.created_at))}</span></div>
        <div class="row"><button class="btn sm" style="--accent:var(--cw)" data-act="preview" data-v="${q.id}">Sinab ko'rish</button>
          <button class="btn soft sm" data-act="indiv" data-v="${q.id}">Alohida o'quvchilar · ${indiv.length}</button>
          <button class="btn ${conf ? "danger" : "soft"} sm" data-act="delQuest" data-v="${q.id}">${conf ? "Rostdan o'chirish" : "O'chirish"}</button></div>
        ${open ? `<div class="stack"><div class="checklist">${d.students.map((s) => `<label><input type="checkbox" class="indiv-box" value="${s.id}" ${indiv.includes(s.id) ? "checked" : ""}> ${esc(s.first_name + " " + s.last_name)} <span class="sub small">${esc(className(s.class_id))}</span></label>`).join("")}</div>
          <div class="row"><button class="btn sm" data-act="indivSave" data-v="${q.id}">Saqlash</button><button class="btn soft sm" data-act="indiv" data-v="${q.id}">Yopish</button></div></div>` : ""}
      </section>`;
    };
    const cws = d.quests.filter((q) => q.kind === "cw").sort((a, b) => (b.week_start || "").localeCompare(a.week_start || "") || (a.lesson || 0) - (b.lesson || 0));
    const hws = d.quests.filter((q) => q.kind === "hw" || !q.kind), vls = d.quests.filter((q) => q.kind === "vl");
    const list = d.quests.length ? `<h2>Uy vazifasi · ${hws.length}</h2>${hws.length ? hws.map(card).join("") : `<div class="card empty">Uy vazifasi yo'q.</div>`}
      <h2>Sinf ishi · ${cws.length}</h2>${cws.length ? cws.map(card).join("") : `<div class="card empty">Sinf ishi yo'q. Kodda <code>@classwork 1</code> deb yozilgan vazifalar shu yerda chiqadi.</div>`}${vls.length ? `<h2>Lug'at guruhlari · ${vls.length}</h2>${vls.map(card).join("")}` : ""}`
      : `<div class="card empty">Hali vazifa yo'q. Yuqoriga kod joylab qo'shing.</div>`;
    return `<h1>Topshiriqlar</h1>${probs}
      <button class="li card" style="flex-direction:row" data-act="cg" data-v="1"><span class="sub">${I.users}</span><span class="grow"><b style="font-weight:600">Sinf o'yini</b><br><span class="small sub">Darsda butun sinf bilan jonli so'z o'yini</span></span><span class="chev">${I.chev}</span></button>
      <button class="li card" style="flex-direction:row" data-act="wview" data-v="1"><span class="sub">${I.doc}</span><span class="grow"><b style="font-weight:600">Yozma ishlar</b><br><span class="small sub">Baholash, izoh yozish, AI bilan bir yo'la baholash</span></span><span class="chev">${I.chev}</span></button>
      <section class="card stack"><h3>Yangi vazifa qo'shish</h3><p class="sub small">Kodni joylang. Bir yo'la butun haftani joylash mumkin.</p>
        <textarea id="pasteBox" class="code" aria-label="Vazifa kodi" placeholder="@quest Unit 4 · Oila&#10;@circle Kimning?&#10;...">${esc(T.paste)}</textarea>
        <div class="row"><button class="btn" style="--accent:var(--cw)" data-act="parse">Tekshirish</button></div>
        <div id="pasteSummary" class="stack">${summary}</div></section>
      ${list}`;
  }

  /* settings */
  function vSettings() {
    if (T.sub === "people") return vPeople();
    if (T.sub === "pw") return vPassword();
    if (T.sub === "teachers") return vTeachers();
    if (T.sub === "tt") return vTimetable();
    const isAdmin = T.me && T.me.is_admin;
    return `<h1>Sozlamalar</h1>
      <div class="list">
        <button class="li" data-act="sub" data-v="people"><span class="sub">${I.users}</span><span class="grow">Sinflar, pullar, o'quvchilar<br><span class="sub small">Qo'shish, ko'chirish, parolni tiklash</span></span><span class="chev">${I.chev}</span></button>
        <button class="li" data-act="sub" data-v="tt"><span class="sub">${I.class}</span><span class="grow">Dars jadvali<br><span class="sub small">Sinf ishlari shu jadvalga ko'ra ochiladi</span></span><span class="chev">${I.chev}</span></button>
        <button class="li" data-act="sub" data-v="pw"><span class="sub">${I.key}</span><span class="grow">Parolni o'zgartirish</span><span class="chev">${I.chev}</span></button>
        <button class="li" data-act="logout"><span class="sub">${I.out}</span><span class="grow">Chiqish</span></button>
      </div>
      ${isAdmin ? `<button class="link" style="align-self:flex-start;color:var(--sub)" data-act="sub" data-v="teachers">O'qituvchilarni boshqarish</button>` : ""}`;
  }
  async function loadTT() {
    if (!T.cls) return;
    const c = T.cls; T.tt = null; render();
    api("admin_days_off").then((x) => { T.off = Array.isArray(x) ? x : []; render(); }).catch(() => {});
    try { const r = await api("admin_timetable", { p_class: c }); if (T.cls === c) { T.tt = r.map((x) => ({ dow: x.dow, start: x.start, end: x.end })); T.ttDirty = false; render(); } }
    catch (e) { quiet(e); }
  }
  function vTimetable() {
    const d = T.data;
    if (!d.classes.length) return `${backBtn()}<h1>Dars jadvali</h1><div class="card empty">Avval sinf yarating.</div>`;
    const segs = `<div class="seg" role="group" aria-label="Sinf">${d.classes.map((c) => `<button aria-pressed="${T.cls === c.id}" data-act="ttCls" data-v="${c.id}">${esc(c.name)}</button>`).join("")}</div>`;
    if (!T.tt) return `${backBtn()}<h1>Dars jadvali</h1>${segs}<div class="loading">Yuklanmoqda…</div>`;
    const sorted = T.tt.map((x, i) => Object.assign({ i }, x)).sort((a, b) => a.dow - b.dow || a.start - b.start);
    const rows = sorted.length ? `<div class="list">${sorted.map((x, n) => `<div class="li"><span class="pill cw" style="min-width:58px;justify-content:center">${n + 1}-dars</span>
        <span class="grow"><b style="font-weight:600">${DOWN[x.dow]}</b> <span class="num">${hm(x.start)}–${hm(x.end)}</span></span>
        <button class="btn soft sm" data-act="ttDel" data-v="${x.i}" aria-label="O'chirish">${I.x}</button></div>`).join("")}</div>` : `<div class="card empty">Bu sinf uchun hali dars qo'shilmagan.</div>`;
    return `${backBtn()}<h1>Dars jadvali</h1>${segs}
      <p class="sub">${esc(className(T.cls))} sinf · haftasiga ${sorted.length} ta dars. Sinf ishlari shu tartibda ochiladi: 1-sinf ishi 1-darsda, 2-sinf ishi 2-darsda va hokazo. Dars paytida uy vazifalari yopiq turadi.</p>
      ${rows}
      <section class="card stack"><h3>Dars qo'shish</h3>
        <div class="grid2"><div><label for="ttDow">Kun</label><select id="ttDow">${DOWN.slice(1).map((n, i) => `<option value="${i + 1}">${n}</option>`).join("")}</select></div>
        <div class="row" style="flex-wrap:nowrap"><div class="grow"><label for="ttS">Boshlanishi</label><input id="ttS" type="time" value="08:30"></div><div class="grow"><label for="ttE">Tugashi</label><input id="ttE" type="time" value="09:15"></div></div></div>
        <button class="btn soft" data-act="ttAdd">${I.plus} Qo'shish</button></section>
      <button class="btn" style="--accent:var(--rv)" data-act="ttSave" ${T.ttDirty ? "" : "disabled"}>${T.ttDirty ? "Jadvalni saqlash" : "Saqlangan"}</button>
      <section class="card stack"><div><h3>Dam olish kunlari</h3><p class="sub small">Bu kunlarda hech bir sinfda dars bo'lmaydi: sinf ishlari, muddatlar va dars qulfi shu kunlarni tashlab o'tadi.</p></div>
        ${(T.off || []).length ? `<div class="list">${T.off.map((d) => `<div class="li"><span class="grow"><b style="font-weight:600">${esc(fmtDay(d))}</b></span><button class="btn soft sm" data-act="offDel" data-v="${esc(d)}" aria-label="O'chirish">${I.x}</button></div>`).join("")}</div>` : `<p class="sub small" style="margin:0">Hozircha dam olish kuni yo'q.</p>`}
        <div class="row" style="flex-wrap:nowrap"><input id="offDay" type="date" aria-label="Sana" style="flex:1"><button class="btn soft" data-act="offAdd">${I.plus} Qo'shish</button></div></section>`;
  }
  const fmtDay = (s) => { const d = dayFromStr(s); return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}-${MONTHS[d.getMonth()]}`; };
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
      case "locked": toast(v); return;
      case "role": V = { screen: "login", role: v }; render(); return;
      case "back": V = { screen: "pick" }; render(); return;
      case "logout": signOut(); return;
      case "tab":
        if (S.role === "teacher") {
          if (T.tab === v) { T.sub = null; T.poolView = null; T.wview = false; T.stuView = null; }
          if (v !== "assign" && T.cg) { cgStop(); T.cg = null; }
          T.tab = v; T.editName = null; T.pwFor = null; render(); window.scrollTo(0, 0);
          if (v === "results" || v === "report") loadReport();
        } else {
          if (v === "vocab") { location.href = "vocab.html"; return; }
          ST.tab = v; ST.castleMsg = null; render(); window.scrollTo(0, 0);
          if (v === "board") loadBoard(); else if (v === "troph") loadTrophies(); else if (v === "castle") loadCastle(); else if (v === "home") loadStudent();
        }
        return;
      // student
      case "play": startQuest(v, false); return;
      case "practice": startPractice(); return;
      case "daily": startDaily(); return;
      case "quit": quitPlayer(); return;
      case "sel": if (P && !P.result) { P.sel = Number(v); render(); } return;
      case "pick": if (P && !P.result && !P.pick.includes(Number(v))) { P.pick.push(Number(v)); render(); } return;
      case "unpick": if (P && !P.result) { P.pick.splice(Number(v), 1); render(); } return;
      case "check": check(); return;
      case "cont": cont(); return;
      case "next": nextCard(); return;
      case "ians": { const k = v.indexOf("|"); P.ia[Number(v.slice(0, k))] = v.slice(k + 1); document.querySelectorAll(".ishort").forEach((el) => (P.ia[Number(el.dataset.i)] = el.value)); render(); return; }
      case "icheck": ieltsCheck(); return;
      case "wsend": writeSend(); return;
      case "wnext": ieltsNext(); return;
      case "ireveal": ieltsReveal(); return;
      case "irevNext": P.irev.k += 1; ieltsFocus(); return;
      case "inext": ieltsNext(); return;
      case "ihl": { const d = P.idet.find((y) => y.i === Number(v)); P.ihl = d ? d.ev : null; render(); const m = $("#hlMark"); if (m) m.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
      case "repToggle": P.reportOpen = !P.reportOpen; render(); { const el = $("#repNote"); if (el) el.focus(); } return;
      case "repSend": sendReport(); return;
      case "gsub": ST.gsub = v; if (v === "battle" && !ST.targets) { ST.targets = null; render(); loadCastle(); } else render(); return;
      case "gup": case "gtrain": case "guntrain": {
        b.disabled = true;
        const [k, n] = String(v).split("|");
        try {
          const r = a === "gup" ? await api("game_upgrade", { p_k: k }) : a === "gtrain" ? await api("game_train", { p_k: k, p_n: Number(n || 1) }) : await api("game_untrain", { p_k: k });
          if (r.error) toast({ GOLD: "Oltin yetmaydi", BUSY: "Quruvchi band", MAX: "Eng yuqori daraja", DAMAGED: "Avval qal'a ta'mirlansin", FULL: "Kazarmada joy yo'q", LOCKED: "Hali ochilmagan" }[r.error] || "Bo'lmadi");
          else { ST.g.me = r.me; if (a === "gup") toast(`${GB[k].n} qurilmoqda`); if (a === "guntrain") toast(`Yarim narx qaytarildi: +${Math.floor(GT[k].cost / 2)}`); }
        } catch (err) { quiet(err); }
        render(); return;
      }
      case "gretarget": ST.targets = null; render(); try { ST.targets = await api("game_targets"); } catch (err) { quiet(err); } render(); return;
      case "gattack": {
        b.disabled = true;
        let r;
        try { r = await api("game_attack", { p_target: Number(v) }); } catch (err) { quiet(err); render(); return; }
        if (r.error) { toast({ SHIELD: "Bu qal'ada qalqon bor", COOLDOWN: "Bu qal'aga 1 soatdan keyin", NO_ARMY: "Qo'shin yo'q", LEVEL: "Darajasi juda uzoq" }[r.error] || "Hujum qilib bo'lmadi"); ST.targets = null; loadCastle(); return; }
        ST.battle = { r, f: 0, done: false }; render(); window.scrollTo(0, 0);
        const step = () => {
          if (!ST.battle) return;
          ST.battle.f += 1; const box = $("#battleBox"); if (box) box.innerHTML = battleSvg();
          if (ST.battle.f < r.frames.length) setTimeout(step, 170); else setTimeout(() => { if (ST.battle) { ST.battle.done = true; render(); } }, 500);
        };
        setTimeout(step, 400); return;
      }
      case "gbattleEnd": ST.battle = null; ST.targets = null; ST.gsub = "battle"; loadCastle(); return;
      case "tsell": { b.disabled = true; try { const r = await api("trophy_sell", { p_kind: v }); toast(r.error ? "Bo'lmadi" : r.got ? `+${r.got} oltin` : "Ombor to'la"); } catch (err) { quiet(err); } loadTrophies(); return; }
      case "tbuy": { b.disabled = true; try { const r = await api("shop_buy", { p_item: v }); toast(r.error ? ({ TROPHIES: "Kubok yetmaydi", OWNED: "Allaqachon olingan", NOTHING: "Hozir hech narsa qurilmayapti" }[r.error] || "Bo'lmadi") : "Olindi!"); } catch (err) { quiet(err); } loadTrophies(); return; }
      // teacher
      case "cls": T.cls = Number(v); T.poolView = null; T.stuView = null; T.ov = null; render(); loadReport(); if (T.showMonthly) loadMonthly(); return;
      case "week": { const d = dayFromStr(T.week); d.setDate(d.getDate() + 7 * Number(v)); T.week = strFromDay(d); loadReport(); return; }
      case "setweek": T.week = v; loadReport(); return;
      case "monthly": T.showMonthly = true; render(); loadMonthly(); return;
      case "metric": T.metric = v; render(); return;
      case "hwMode": T.hwMode = v; render(); return;
      case "stu": T.stuView = v ? Number(v) : null; T.stuKind = "hw"; window.scrollTo(0, 0); if (T.stuView) loadStudentPage(T.stuView); else render(); return;
      case "stuR": T.tab = "results"; T.stuView = Number(v); T.stuKind = "hw"; window.scrollTo(0, 0); loadStudentPage(T.stuView); return;
      case "stuKind": T.stuKind = v; render(); return;
      case "poolView": T.poolView = v ? Number(v) : null; window.scrollTo(0, 0); if (T.poolView) loadPoolRes(); else render(); return;
      case "sub": T.sub = v || null; T.editName = null; T.pwFor = null; T.pwMsg = null; render(); window.scrollTo(0, 0); if (v === "teachers") loadTeachers(); if (v === "tt") loadTT(); return;
      case "ttCls": if (T.ttDirty) { toast("Avval jadvalni saqlang"); return; } T.cls = Number(v); loadTT(); return;
      case "ttDel": T.tt.splice(Number(v), 1); T.ttDirty = true; render(); return;
      case "ttAdd": {
        const dow = Number($("#ttDow").value), a = toMin($("#ttS").value), z = toMin($("#ttE").value);
        if (!(a >= 0) || !(z > a)) { toast("Tugash vaqti boshlanishidan keyin bo'lsin"); return; }
        if (T.tt.some((x) => x.dow === dow && a < x.end && z > x.start)) { toast("Bu vaqtda boshqa dars bor"); return; }
        T.tt.push({ dow, start: a, end: z }); T.ttDirty = true; render(); return;
      }
      case "offAdd": { const d = $("#offDay").value; if (!d) { toast("Sanani tanlang"); return; }
        try { T.off = await api("admin_day_off_set", { p_day: d, p_on: true }); toast("Dam olish kuni qo'shildi"); } catch (e) { quiet(e); } render(); return; }
      case "offDel": try { T.off = await api("admin_day_off_set", { p_day: v, p_on: false }); toast("O'chirildi"); } catch (e) { quiet(e); } render(); return;
      case "ttSave": {
        const r = await adminCall("admin_timetable_save", { p_class: T.cls, p_slots: T.tt }, "Jadval saqlandi", false);
        if (r) { T.ttDirty = false; render(); } return;
      }
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
        T.parsed = window.QuestParser.parse(T.paste); T.poolPick = {}; T.weekPick = T.parsed.week || defaultWeek();
        T.parsed.quests.forEach((q, i) => { const p = q.pool && T.data.pools.find((x) => x.name.toLowerCase() === q.pool.toLowerCase()); T.poolPick[i] = p ? String(p.id) : ""; });
        render(); return;
      }
      case "saveQuests": {
        const pr = T.parsed; if (!pr || pr.errors.length) return;
        const scripts = scriptsFor(T.paste, pr);
        const payload = pr.quests.map((q, i) => { const dd = q.kind === "hw" ? dueToDate(T.weekPick, q.due) : null;
          return { title: q.title, pool_id: T.poolPick[i] || "", script: scripts[i], steps: q.steps, circles: q.circles,
            kind: q.kind, lesson: q.lesson || "", week_start: T.weekPick, deadline: dd ? dd.toISOString() : "", due_lesson: q.kind === "hw" && q.due && q.due.lesson ? q.due.lesson : "", after_lesson: q.kind === "hw" && q.after ? q.after : "" }; });
        T.saving = true; render();
        const r = await adminCall("admin_quests_create", { p_quests: payload }, null);
        T.saving = false;
        if (r) { toast(`${payload.length} ta vazifa saqlandi.`); T.paste = ""; T.parsed = null; }
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
      case "cg": cgStop(); T.cg = v ? { cls: T.cls || (T.data.classes[0] && T.data.classes[0].id) } : null; render(); window.scrollTo(0, 0); return;
      case "cgcls": T.cg.cls = Number(v); render(); return;
      case "cgcreate": {
        b.disabled = true;
        try {
          const q = $("#cgq").value, n = Number($("#cgn").value);
          const r = await api("vg_class_create", { p_class: T.cg.cls, p_quest: q ? Number(q) : null, p_n: n });
          if (r.error) { toast(r.error === "FEW_WORDS" ? "So'zlar yetarli emas (kamida 4 ta kerak)" : "Bo'lmadi"); render(); return; }
          T.cg.id = r.id; T.cg.st = null; render(); cgPoll(); cgStop(); T.cgTimer = setInterval(cgPoll, 1000);
        } catch (err) { quiet(err); render(); }
        return;
      }
      case "cgnext": { b.disabled = true; try { T.cg.st = await api("vg_host_next", { p_id: T.cg.id }); } catch (err) { quiet(err); } render(); return; }
      case "cgnew": cgStop(); T.cg = { cls: T.cg.cls }; render(); return;
      case "wview": T.wview = !!v; T.wParsed = null; T.wCopyText = ""; window.scrollTo(0, 0); if (T.wview) { T.writ = null; render(); loadWritings(); } else render(); return;
      case "wcls": T.wCls = v ? Number(v) : null; render(); return;
      case "wall": T.wAll = v === "1"; T.writ = null; render(); loadWritings(); return;
      case "wcopy": {
        const list = (T.wCls ? T.writ.filter((w) => w.class_id === T.wCls) : T.writ).filter((w) => w.mark == null);
        const text = writingRequest(list); T.wCopyText = "";
        try { await navigator.clipboard.writeText(text); toast(`${list.length} ta ish nusxalandi. Endi Claude'ga yuboring.`); }
        catch (err) { T.wCopyText = text; render(); const box = $("#wCopyBox"); if (box) { box.focus(); box.select(); } }
        return;
      }
      case "aiParse": { const box = $("#aiBox"); T.aiText = box ? box.value : ""; T.wParsed = parseFeedback(T.aiText); render(); return; }
      case "aiSave": {
        const items = T.wParsed.items.filter((x) => T.writ.some((w) => w.id === x.id));
        const r = await adminCall("admin_writings_mark", { p_items: items }, null, false);
        if (r) { toast(`${r.saved} ta ish baholandi`); T.wParsed = null; T.aiText = ""; loadWritings(); } return;
      }
      case "wsave": {
        const id = Number(v), m = $("#wm-" + id).value, c = $("#wc-" + id).value.trim();
        if (m === "") { toast("Bahoni tanlang"); return; }
        const r = await adminCall("admin_writings_mark", { p_items: [{ id, mark: Number(m), comment: c }] }, null, false);
        if (r && r.saved) { toast("Saqlandi"); const w = T.writ.find((x) => x.id === id); if (w) { w.mark = Number(m); w.comment = c; } if (!T.wAll) T.writ = T.writ.filter((x) => x.id !== id); render(); }
        return;
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
      case "weekPick": if (el.value) { T.weekPick = strFromDay(mondayOf(dayFromStr(el.value))); render(); } break;
      case "qPool": updateQuest(id, { pool_id: val }); break;
      case "qHidden": updateQuest(id, { hidden: el.checked }, el.checked ? "Yashirildi" : "Ko'rinadigan qilindi"); break;
      case "msel": if (P && !P.result) P.msel[Number(el.dataset.v)] = el.value; break;
      case "isel": if (P) P.ia[Number(el.dataset.v)] = el.value; break;
      case "qDeadline": if (el.value) updateQuest(id, { deadline: new Date(el.value).toISOString() }, "Muddat saqlandi"); break;
    }
  });

  ["copy", "cut", "contextmenu"].forEach((ev) => document.addEventListener(ev, (e) => {
    if (e.target.closest && e.target.closest("[data-nocopy], .noselect")) e.preventDefault();
  }));

  if (window.GameArt && !document.getElementById("gameDefs")) document.body.insertAdjacentHTML("afterbegin", `<div id="gameDefs">${window.GameArt.DEFS}</div>`);
  function boot() {
    if (!S) { V = { screen: "pick" }; render(); return; }
    if (S.role === "teacher") { render(); loadAdmin(); }
    else { render(); loadStudent(); }
  }
  boot();
})();
