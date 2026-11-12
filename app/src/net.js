/* =====================================================================
   NET: the live database (Supabase). The site keeps the same one-object
   database in memory; this file loads it after login and sends every change
   back: new events, changed documents (works, classes, plans, writings...),
   accounts, castles. Unsent changes wait in the browser and go when the
   internet is back. Logins are the school's existing accounts.
   ===================================================================== */
const Net = (() => {
  const SB_URL = 'https://meiokexdxhyjcyfpvjvx.supabase.co';
  const SB_KEY = 'sb_publishable_YXhY13kbBK3sv89Y9c1uwg_83HfRqME';
  const TOK = 'ingliz-token', QK = 'ingliz-queue';
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };

  let token = ls.get(TOK);
  if (!token) { try { const old = JSON.parse(ls.get('at_session') || 'null'); if (old && old.token) token = old.token; } catch (e) {} }   // still logged in on the old site
  let me = null, since = null, timer = null, busy = false, backoff = 0, offline = false;

  async function rpc(fn, args) {
    let r;
    try { r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) }); }
    catch (e) { const err = new Error('NET'); err.net = true; throw err; }
    const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    if (!r.ok) { const err = new Error((data && data.message) || 'HTTP ' + r.status); err.status = r.status; throw err; }
    return data;
  }

  /* ---------- what is synced, and how each collection is cut into documents ---------- */
  const TEACHER_COLLS = ['classes', 'works', 'plans', 'overrides', 'accept', 'groups', 'settings', 'writings', 'reports', 'students', 'teachers'];
  const STUDENT_COLLS = ['writings', 'reports'];
  const KIND = { classes: 'arr', works: 'arr', writings: 'arr', reports: 'arr', students: 'arr', teachers: 'arr', plans: 'obj', overrides: 'obj', accept: 'obj', groups: 'one', settings: 'one' };
  const ONE_ID = { groups: 'list', settings: 'main' };
  function docs(db, coll) {
    const v = db[coll], k = KIND[coll], out = {};
    if (k === 'arr') (v || []).forEach(x => { if (x && x.id != null && x.id !== 'preview') out[x.id] = x; });
    else if (k === 'obj') Object.entries(v || {}).forEach(([id, x]) => { out[id] = x; });
    else if (coll === 'settings') { const s = Object.assign({}, v || {}); delete s.clock; out[ONE_ID[coll]] = s; }
    else out[ONE_ID[coll]] = v || [];
    return out;
  }
  const colls = () => (me && me.role === 'teacher') ? TEACHER_COLLS : STUDENT_COLLS;
  let snap = {}, known = new Set();
  function takeSnap(db) {
    snap = {}; colls().forEach(c => { const d = docs(db, c); snap[c] = {}; Object.entries(d).forEach(([id, x]) => { snap[c][id] = JSON.stringify(x); }); });
    known = new Set((db.events || []).map(e => e.id));
  }

  /* ---------- the waiting queue (kept in the browser so nothing is lost offline) ---------- */
  let Q = { ev: [], ops: [], castles: {} };
  try { const q = JSON.parse(ls.get(QK) || 'null'); if (q && Array.isArray(q.ev)) Q = Object.assign({ ev: [], ops: [], castles: {} }, q); } catch (e) {}
  const saveQ = () => ls.set(QK, JSON.stringify(Q));
  const pendingCount = () => Q.ev.length + Q.ops.length + Object.keys(Q.castles).length;

  /* compare the database with what the server has, queue the differences */
  function collect() {
    const db = Store.db; if (!db || !me || Store.sandbox) return;
    (db.events || []).forEach(e => { if (!known.has(e.id)) { known.add(e.id); Q.ev.push(e); } });
    colls().forEach(c => {
      const now = docs(db, c), before = snap[c] || (snap[c] = {});
      Object.entries(now).forEach(([id, x]) => {
        const j = JSON.stringify(x); if (before[id] === j) return;
        Q.ops = Q.ops.filter(o => !(o.coll === c && o.id === id)); Q.ops.push({ coll: c, id, data: JSON.parse(j) });
        before[id] = j;
        // a new password goes once to the server and is never kept in the page
        if ((c === 'students' || c === 'teachers') && x.pass) { x.pass = ''; before[id] = JSON.stringify(x); }
      });
      Object.keys(before).forEach(id => { if (!(id in now)) { Q.ops = Q.ops.filter(o => !(o.coll === c && o.id === id)); Q.ops.push({ coll: c, id, data: null }); delete before[id]; } });
    });
    saveQ();
  }

  function changed() { collect(); schedule(800); }
  function castle(sid, st) { if (!me) return; Q.castles[sid] = st; saveQ(); schedule(1500); }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(flush, ms); }

  const ERR = { LOGIN_TAKEN: 'This login is already used', LOGIN_FORMAT: 'A login is 3–30 small letters, digits, dots or _', PASSWORD: 'A new account needs a password', NAME: 'A name is needed', SELF: 'You cannot remove your own account', FORBIDDEN: 'Not allowed' };
  async function flush() {
    if (busy || !token || !me) return; if (!pendingCount()) { setOffline(false); return; }
    busy = true;
    const ev = Q.ev.slice(0, 400), ops = Q.ops.slice(0, 200), castles = Object.assign({}, Q.castles);
    try {
      const r = await rpc('v2_sync', { p_token: token, p_events: ev, p_ops: ops, p_castles: castles });
      const evIds = new Set(ev.map(e => e.id)); Q.ev = Q.ev.filter(e => !evIds.has(e.id)); ev.forEach(e => { if (!rawIds.has(e.id)) sent.set(e.id, e); });
      Q.ops = Q.ops.filter(o => !ops.includes(o));
      Object.keys(castles).forEach(k => { if (Q.castles[k] === castles[k]) delete Q.castles[k]; });
      saveQ(); backoff = 0; setOffline(false);
      if (r && r.errors && r.errors.length) {
        const m = r.errors.map(e => ERR[e.error] || e.error).filter((x, i, a) => a.indexOf(x) === i).join(' · ');
        toast(m); busy = false;
        if (await refresh(true) && typeof App !== 'undefined' && !Run.R) App.render();   // show what the server really has
        return;
      }
    } catch (e) {
      if (e.message === 'AUTH' || e.message === 'REMOVED') { busy = false; return expired(); }
      backoff = Math.min(60000, (backoff || 2500) * 2); setOffline(true);
      busy = false; return schedule(backoff);
    }
    busy = false;
    if (pendingCount()) schedule(300);
  }
  function setOffline(v) { if (offline === v) return; offline = v; const b = document.getElementById('netbar'); if (b) b.hidden = !v; }

  /* ---------- login, boot, refresh ---------- */
  async function login(l, p) {
    const r = await rpc('login', { p_login: l, p_password: p });
    if (!r || r.error) return { error: r ? r.error : 'BAD_LOGIN' };
    token = r.token; ls.set(TOK, token); return { ok: true };
  }
  /* answers come in pages (net: v2_events_page); "raw" keeps them between refreshes, "cursor" is the last one loaded */
  let raw = [], rawIds = new Set(), cursor = 0;
  const sent = new Map();   // sent by this browser but not loaded back yet
  const isAuth = e => e && (e.message === 'AUTH' || e.message === 'REMOVED');
  function addRaw(evs) { evs.forEach(e => { if (!rawIds.has(e.id)) { rawIds.add(e.id); raw.push(e); known.add(e.id); sent.delete(e.id); } }); }
  async function pages(progress) {
    for (let more = true; more;) {
      const p = await rpc('v2_events_page', { p_token: token, p_after: cursor, p_limit: 5000 });
      addRaw(p.events || []); cursor = p.last || cursor; more = !!p.more;
      if (progress) progress(raw.length);
    }
  }
  function apply(r) {
    me = r.me; since = r.since;
    const db = r.db;
    db.settings = db.settings || {}; db.plans = db.plans || {}; db.overrides = db.overrides || {}; db.accept = db.accept || {};
    db.reports = db.reports || []; db.writings = db.writings || [];
    if (!r.paged) addRaw(db.events || []);
    // loaded answers + daily totals + what this browser made but has not got back from the server yet
    const evs = raw.concat(r.achsums || []), have = new Set(evs.map(e => e.id));
    sent.forEach((e, id) => { if (!have.has(id)) { evs.push(e); have.add(id); } });
    Q.ev.forEach(e => { if (!have.has(e.id)) { evs.push(e); have.add(e.id); } });
    db.events = evs.sort((a, b) => a.ts - b.ts);
    const castles = r.castles || {}; Object.entries(Q.castles).forEach(([k, v]) => { castles[k] = v; });
    Q.ops.forEach(o => { const c = o.coll, k = KIND[c];
      if (k === 'arr') { const a = db[c] || (db[c] = []); const i = a.findIndex(x => x.id === o.id); if (o.data === null) { if (i >= 0) a.splice(i, 1); } else { const x = JSON.parse(JSON.stringify(o.data)); if ('pass' in x) x.pass = ''; if (i >= 0) a[i] = x; else a.push(x); } }
      else if (k === 'obj') { if (o.data === null) delete db[c][o.id]; else db[c][o.id] = JSON.parse(JSON.stringify(o.data)); }
      else if (o.data !== null) { if (c === 'settings') Object.assign(db.settings, o.data); else db[c] = o.data; } });
    const clock = Store.db && Store.db.settings ? Store.db.settings.clock : 0; if (clock) db.settings.clock = clock;
    Store.db = db; Store.castles = castles; Store._cache = {};
    takeSnap(db);
    return me;
  }
  /* null = not logged in (bad token or closed account); a thrown error = internet or server trouble (stay logged in) */
  async function boot(progress) {
    if (!token) return null;
    raw = []; rawIds = new Set(); cursor = 0;
    try {
      const r = await rpc('v2_boot', { p_token: token });
      if (!r || r.error) { forget(); return null; }
      if (r.paged) await pages(progress);
      apply(r); if (pendingCount()) schedule(500); return me;
    } catch (e) { if (isAuth(e)) { forget(); return null; } throw e; }
  }
  let lastRefresh = 0;
  async function refresh(force) {
    if (!me || !token || Store.sandbox || busy) return false;
    if (!force && Date.now() - lastRefresh < 60000) return false;
    lastRefresh = Date.now();
    collect();
    try {
      const r = await rpc('v2_boot', { p_token: token }); if (!r || r.error) { expired(); return false; }
      if (r.paged) await pages();
      if (Store.sandbox) return false; apply(r); return true;
    } catch (e) { if (isAuth(e)) expired(); return false; }   // a slow server just waits for the next refresh
  }
  function forget() { token = null; me = null; ls.del(TOK); ls.del('at_session'); }
  function expired() { forget(); if (typeof App !== 'undefined') { App.ctx.err = 'Iltimos, qaytadan kiring · please log in again'; App.toLogin(); } }
  async function logout() { const t = token; forget(); Q = { ev: [], ops: [], castles: {} }; saveQ(); if (t) rpc('logout', { p_token: t }).catch(() => {}); }

  // send before the page closes; check for new work when the student comes back to the tab
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { collect(); flush(); } });
  addEventListener('online', () => schedule(200));

  return { login, boot, refresh, logout, changed, castle, flush, pending: pendingCount, me: () => me, hasToken: () => !!token, get since() { return since; } };
})();
