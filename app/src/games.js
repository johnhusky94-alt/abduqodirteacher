/* =====================================================================
   GAMES AND CASTLE BRIDGE
   Word Arcade games run in an iframe (their own page); what they report back
   becomes vocab evidence, achko and gold. The castle runs the same way and
   its wallet IS the student's gold.
   ===================================================================== */
const Play = (() => {
  const B = () => window.__ARCADE;                       // bundle injected by the build
  const MIN = { gameshow: 8, whack: 6, pairs: 6, spelling: 6, castle: 8, mark: 6, connect: 4, sort: 4, rank: 4, parts: 4, story: 4, detective: 6, clash: 6, ghost: 6, balloons: 6, scramble: 6, crossword: 8, falling: 6, escape: 6, boss: 6, fix: 6, unjumble: 4, duel: 8, tug: 8, royale: 10, heist: 9, classcastle: 8 };
  const single = c => /^[a-z]+$/i.test(c.w);
  const FITS = { spelling: c => c.sp.length > 0, mark: c => !!c.s, boss: c => !!c.s, fix: c => !!c.s, detective: c => !!c.s && !!c.ant, clash: c => !!c.ant && !!c.syn,
    unjumble: c => c.sentences.some(s => s.safe && s.words <= 12), balloons: single, crossword: single, escape: single, scramble: c => single(c) && c.w.length >= 4 };
  const BLOCK_GAMES = new Set(['connect', 'sort', 'rank', 'parts', 'story']);
  const UZ = { gameshow: "Sovrin zinapoyasi: har savolda bir pog'ona", whack: "So'zni ushlagan ko'rsichqonni uring", pairs: "So'zlarni ma'nolari bilan juftlang", spelling: "Haqiqiy so'zmi yoki soxta? Vaqt bilan poyga",
    castle: "Javob bering va qo'shinga o'q uzing", mark: "Har harf ichida yashiringan so'zni toping", connect: "12 ta so'z, 3 ta yashirin guruh", sort: "Har so'zni to'g'ri qopga soling", rank: "So'zlarni kuchsizdan kuchliga tartiblang",
    parts: "So'zlarni qismlaridan yasang", story: "Kulgili hikoyadagi bo'sh joylarni to'ldiring", detective: "Ishga mos so'zni toping", clash: "Qarama-qarshi ma'nolar jangi", ghost: "O'z rekordingiz bilan poyga",
    balloons: "Sharlar yorilmasidan harflarni toping", scramble: "Harflarni joyiga qo'ying", crossword: "So'zlaringizdan yangi krossvord", falling: "So'z tushmasidan yozing", escape: "Kodlarni yozib, xonadan chiqing",
    boss: "Uch boss eng qiyin so'zlaringizni qo'riqlaydi", fix: "Xato so'zni toping, to'g'risini yozing", unjumble: "Gapni vagonma-vagon tiklang", duel: "Bitta raqib, bir xil savol", tug: "Har javob bilan jamoangiz tortadi",
    royale: "Doira torayganda oxirgi qolgan g'olib", heist: "Jamoa bilan seyfni oching", classcastle: "Butun sinf bitta qal'ani himoya qiladi" };
  const EVN = { none: 0, weak: 1, medium: 2, strong: 3 };
  const needStage = tier => Math.max(1, tier - 1);      // our stages: 1 Tanish … 5 O'zlashtirilgan (arcade tiers 1–4)

  /* the arcade's "homework" object, built from every word this student has */
  function hub(s, cardsOverride, weeks) {
    const cards = (cardsOverride || School.allCards(s)).map(norm);
    const { blocks, confuse } = School.allBlocks(s, weeks);
    if (!blocks.sorts.length) { // the arcade's own rule: sort the words by part of speech when no @sort was written
      const NM = { noun: 'Otlar', verb: "Fe'llar", adj: 'Sifatlar', adv: 'Ravishlar', phrase: 'Iboralar' }, byP = {}; cards.forEach(c => { if (NM[c.p]) (byP[c.p] = byP[c.p] || []).push(c); });
      const ks = Object.keys(byP).filter(k => byP[k].length >= 3).slice(0, 3);
      if (ks.length >= 2) blocks.sorts.push({ q: "Qaysi so'z turkumi?", bins: ks.map(k => NM[k]), items: ks.flatMap((k, bi) => byP[k].slice(0, 5).map(c => [c.w, bi, c.d])), auto: true });
    }
    return { id: 'stu-' + s.id, title: "So'zlarim", level: 'A2', text: 'uz', uses: [], games: { mode: 'all', only: [], minus: [] }, cards, blocks, confuse, errors: [], warnings: [], notes: [], ok: true };
  }
  function norm(c) {
    const sentences = (c.sentences || []).map(x => Object.assign({ s: '', f: c.w, full: '', dis: [], safe: false, words: 99 }, x));
    const first = sentences[0];
    return Object.assign({}, c, { p: c.p || 'other', d: c.d || c.uz || c.en || '', en: c.en || '', uz: c.uz || '', sentences, sp: c.sp || [], alt: c.alt || [], ant: c.ant || '', syn: c.syn || '', diff: c.diff || 2, confuse: c.confuse || [], s: first ? first.s : '', f: first ? first.f : c.w });
  }
  const stageOf = (vs, id) => (vs.words[id] || {}).stage || 0;
  function playsSince(s) { const E = Store.events(s.id); let n = 0; for (let i = E.length - 1; i >= 0; i--) { const e = E[i]; if (e.kind === 'game') { if (e.rare) break; n++; } } return n; }

  /* the list the student sees */
  function list(s) {
    const H = hub(s), vs = School.vstate(s), av = WC.availability(H), rareOK = playsSince(s) >= 3;
    let rareGiven = false;
    return av.map(g => {
      const f = FITS[g.key], fit = H.cards.filter(c => !f || f(c)), need = needStage(g.tier), ready = BLOCK_GAMES.has(g.key) ? fit.filter(c => stageOf(vs, c.id) >= 1) : fit.filter(c => stageOf(vs, c.id) >= need);
      const o = { key: g.key, title: g.title, tier: g.tier, play: g.play, uz: UZ[g.key] || '', open: false, why: '', short: '' };
      if (g.play === 'class') { o.why = "Bu o'yinni o'qituvchi darsda butun sinf bilan ochadi"; o.short = 'Darsda'; return o; }
      if (!g.ok) { o.why = "Hozirgi so'zlaringizda bu o'yin uchun kerakli ma'lumot yo'q (gaplar, qarama-qarshi ma'nolar yoki guruhlar)"; o.short = "Ma'lumot yo'q"; return o; }
      if (BLOCK_GAMES.has(g.key) ? fit.length >= 1 : fit.length >= MIN[g.key]) { o.open = true; return o; } /* games open without waiting for word stages */
      if (rareOK && !rareGiven && g.play === 'solo' && fit.length >= MIN[g.key]) { rareGiven = true; o.open = true; o.rare = true; return o; }
      const left = MIN[g.key] - ready.length;
      o.why = `Yana ${left} ta so'zni “${Vocab.STAGES[need].uz}” bosqichiga yetkazing`; o.short = `Yana ${left} so'z`;
      return o;
    });
  }

  /* building the game page (same as the arcade hub) */
  const json = o => JSON.stringify(o).replace(/</g, '\\u003c');
  const HEAD = '<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">';
  function kitDoc(key, wg) {
    const g = B().kit[key]; const css = (g.include || []).map(i => B().inc[i]).join('') + g.css;
    const parts = { TITLE: g.title, BASE_CSS: B().baseCss, GAME_CSS: css, HUD: g.hud, MAIN: g.main, START_EXTRA: g.start, BASE_JS: B().baseJs, GAME_JS: g.js };
    let h = B().template; for (const k in parts) h = h.split('{{' + k + '}}').join(parts[k]);
    return HEAD + `<script>window.__WG=${json(wg)}<\/script></head><body>` + h;
  }
  function legacyDoc(key, wg) {
    const shim = `<script>window.__WG=${json(wg)};
document.addEventListener('DOMContentLoaded',function(){var el=document.getElementById('resultJson');if(!el)return;
new MutationObserver(function(){try{var d=JSON.parse(el.textContent);parent.postMessage({wg:1,game:${json(key)},type:'result',data:d},'*')}catch(e){}}).observe(el,{childList:true,characterData:true,subtree:true})});
<\/script><style>#levelSeg,#segLevel,.seglabel,p.lbl:has(+#segLevel){display:none!important}</style>`;
    return HEAD + shim + '</head><body>' + B().legacy[key];
  }
  function pack(H, key, ids, seed) {
    const wg = WC.forGame(H, key, seed);
    if (!BLOCK_GAMES.has(key) && ids) {
      wg.cards = wg.cards.filter(c => ids.has(c.id));
      if (wg.legacy) wg.legacy = wg.legacy.filter(c => ids.has(c.id));
      if (wg.lists) { const L = wg.lists.a2; if (L.items) L.items = L.items.filter(i => ids.has(i.wid)); if (Array.isArray(L.words)) L.words = L.words.filter(w => ids.has(w.id)); }
    }
    wg.text = 'uz'; return wg;
  }

  /* ---------------- running a game ---------------- */
  let RUN = null;
  function launch(s, key, opts = {}) {
    const g = WC.GAMES.find(x => x.key === key); if (!g) return;
    const H = opts.cards ? hub(s, opts.cards) : hub(s), vs = School.vstate(s), f = FITS[key];
    const fit = H.cards.filter(c => !f || f(c)); let ids;
    if (opts.preview) ids = null;
    else if (opts.rare) ids = new Set(fit.slice().sort((a, b) => stageOf(vs, b.id) - stageOf(vs, a.id)).slice(0, Math.max(MIN[key], 10)).map(c => c.id));
    else { const need = needStage(g.tier); let r = fit.filter(c => stageOf(vs, c.id) >= need); if (r.length < MIN[key]) r = fit.filter(c => stageOf(vs, c.id) >= 1); if (r.length < MIN[key]) r = fit; ids = new Set(r.map(c => c.id)); }
    const wg = pack(H, key, ids, (Date.now() % 100000) | 0); wg.mode = opts.preview ? 'preview' : 'student';
    RUN = { s, key, g, preview: !!opts.preview, rare: !!opts.rare, src: opts.src || 'games', last: '', got: 0, coins: 0, right: 0, wrong: 0, ach: 0, up: 0 };
    overlay(g.title + (opts.rare ? ' · noyob raund' : opts.preview ? ' · preview' : ''), g.legacy ? legacyDoc(key, wg) : kitDoc(key, wg), opts.preview ? 'Close' : 'Yopish');
    if (!opts.preview) Store.ev(s.id, 'game', { key, rare: !!opts.rare, src: RUN.src });
  }
  function overlay(title, doc, closeTxt) {
    const ov = $('#ov'); ov.hidden = false; ov.innerHTML = `<div class="ovbar"><b>${esc(title)}</b><button data-act="ovclose">${esc(closeTxt)}</button></div><iframe title="${esc(title)}" allow="autoplay"></iframe>`;
    $('iframe', ov).srcdoc = doc; document.documentElement.style.overflow = 'hidden';
  }
  function closeOv() {
    const ov = $('#ov'); if (ov.hidden) return; ov.hidden = true; ov.innerHTML = ''; document.documentElement.style.overflow = '';
    if (RUN && RUN.got && !RUN.preview) toast(`+${RUN.coins} oltin · ${RUN.right} to'g'ri, ${RUN.wrong} xato · ${RUN.ach >= 0 ? '+' : ''}${RUN.ach} achko${RUN.up ? ` · ${RUN.up} so'z yuqori bosqichga chiqdi` : ''}`);
    if (CRUN) castleClosed();
    RUN = null; App.render();
  }
  function apply(data) {
    const r = RUN, s = r.s, day = T.dayNum(), vs0 = School.vstate(s), before = {};
    Object.values(vs0.words).forEach(w => before[w.wid] = w.stage);
    (data.results || []).forEach(x => {
      if (!x || !x.wid || x.ok == null) return; const ok = !!x.ok;
      let ev = EVN[x.evidence] != null ? EVN[x.evidence] : (ok ? EVN[r.g.ev] : 0); if (!ok) ev = Math.max(ev, 1);
      if (r.rare) ev = Math.min(ev, Math.min(3, (before[x.wid] || 0) + 1));
      Store.ev(s.id, 'vocab', { wid: x.wid, fmt: 'game:' + r.key, ev, ok, rapid: false, day, ach: true, game: r.key, input: '' });
      if (ok) r.right++; else r.wrong++; r.ach += ok ? 1 : -1;
    });
    const want = Math.min(25, Math.max(0, Math.round(+data.coins || 0))), room = Math.max(0, 150 - School.goldToday(s.id, 'game')), give = Math.min(want, room);
    if (give) r.coins += School.addGold(s.id, give, 'game');
    const vs1 = School.vstate(s); r.up += Object.values(vs1.words).filter(w => w.stage > (before[w.wid] || 0)).length;
  }
  addEventListener('message', e => {
    const m = e.data, fr = $('#ov iframe'); if (!m || !fr || e.source !== fr.contentWindow) return;
    if (m.wg && m.type === 'result' && RUN) { const sig = JSON.stringify(m.data); if (sig === RUN.last) return; RUN.last = sig; RUN.got++; if (!RUN.preview) apply(m.data || {}); }
    if (m.castle && CRUN) castleMsg(m);
  });

  /* classwork: a random open game on last week's words (falls back to all words) */
  function classGame(s, want) {
    const prev = T.addWeeks(T.weekStart(), -1), W = School.wordWeeks(s).find(w => w.week === prev);
    let cards = W ? W.lessons.flatMap(l => l.cards) : null; if (!cards || cards.length < 6) cards = null;
    if (want) { const g = list(s).find(x => x.key === want); if (g && (g.open || cards)) return launch(s, want, { cards, src: 'classwork' }); }
    const L = list(s).filter(g => g.open && g.play === 'solo' && !g.rare);
    if (!L.length) return toast("Hali o'yin ochilmagan: so'zlarni uy vazifasida o'rganing");
    const pick = L[Math.floor(Math.random() * L.length)]; launch(s, pick.key, { cards, src: 'classwork' });
  }

  /* ---------------- castle ---------------- */
  let CRUN = null;
  function classmates(s) {
    return Store.db.students.filter(x => x.cls === s.cls && x.id !== s.id).map((x, i) => { const c = School.castle(x.id); const tl = Object.values(c.tr || {}).reduce((a, t) => a + (t.lv || 1), 0) || 5;
      return { id: i + 1, sid: x.id, name: x.name.split(' ')[0] + ' ' + (x.name.split(' ')[1] || '').slice(0, 1) + '.', b: Object.assign({ castle: 1, wall: 1, tower: 1, barracks: 1, storage: 1 }, c.b), builders: c.builders || 1, tl }; });
  }
  function castleDoc(s, key) {
    let h = window.__CASTLE_SRC;
    const mates = classmates(s); CRUN = { s, key, mates };
    const sub = (a, b) => { if (typeof a === 'string' ? !h.includes(a) : !a.test(h)) console.warn('castle patch missing', a); h = h.replace(a, b); };
    sub('const KEY = "qala-v2-demo-1";', 'const KEY = window.__CASTLE.key;');
    sub(/const CLASSMATES = \[[\s\S]*?\n\];/, 'const CLASSMATES = window.__CASTLE.classmates;');
    sub('gold: 850, cr: 6, b: { castle: 2, wall: 1, tower: 2, barracks: 2, storage: 1 }', 'gold: 0, cr: 0, b: { castle: 1, wall: 1, tower: 1, barracks: 1, storage: 1 }');
    sub('if (!S || !S.b) S = fresh();', 'if (!S || !S.b) S = fresh(); S.speed = 1; if (S.tab === "show") S.tab = "village";');
    sub('if (pct(B2) >= 100) S.rec[B2.e.id] = Date.now() + RECOVER_MS;', 'if (pct(B2) >= 100) { S.rec[B2.e.id] = Date.now() + RECOVER_MS; try { parent.postMessage({ castle: 1, type: "raid", id: B2.e.id, stars: st }, "*"); } catch (e) {} }');
    sub('const save = () => store.set(KEY, JSON.stringify(S));', 'const save = () => { store.set(KEY, JSON.stringify(S)); try { parent.postMessage({ castle: 1, type: "save" }, "*"); } catch (e) {} };');
    const boot = `<script>window.__CASTLE=${json({ key, classmates: mates.map(m => ({ id: m.id, name: m.name, b: m.b, builders: m.builders, tl: m.tl })) })}<\/script><style>#demo,[data-tab="show"]{display:none!important}</style>`;
    return h.replace('<head>', '<head>' + boot);
  }
  function openCastle(s) {
    // the castle page keeps its state in this browser while it is open; every save is copied to the server
    let key = 'qala-v2-' + s.id;
    const st = School.castle(s.id);
    if (Store.sandbox) key = 'qala-v2-sandbox-' + s.id;
    else if (!Store.castleGet(s.id)) Store.castleSet(s.id, st);
    try { localStorage.setItem(key, JSON.stringify(st)); } catch (e) {}
    overlay("Qal'a", castleDoc(s, key), 'Yopish');
  }
  function castlePull() { if (!CRUN || Store.sandbox) return; try { const st = JSON.parse(localStorage.getItem(CRUN.key) || 'null'); if (st && st.b) Store.castleSet(CRUN.s.id, st); } catch (e) {} }
  function castleMsg(m) {
    if (m.type === 'save') return castlePull();
    if (m.type === 'raid') { const v = CRUN.mates.find(x => x.id === m.id); if (!v || Store.sandbox) return; const c = School.castle(v.sid); c.lock = Date.now() + 5 * 60 * 1000; Store.castleSet(v.sid, c); Store.ev(CRUN.s.id, 'raid', { victim: v.sid, stars: m.stars }); }
  }
  function castleClosed() {
    if (Store.sandbox) { try { const k = CRUN.key; const st = JSON.parse(localStorage.getItem(k) || 'null'); if (st) Store._castleSandbox[CRUN.s.id] = st; localStorage.removeItem(k); } catch (e) {} }
    else if (CRUN) { castlePull(); try { localStorage.removeItem(CRUN.key); } catch (e) {} }
    CRUN = null; Store._cache = {};
  }
  function castleSvg(lv) {
    lv = clamp(lv || 1, 1, 10); const h = 70 + lv * 6, flags = Math.min(4, 1 + Math.floor(lv / 3));
    return `<svg width="220" height="${h + 40}" viewBox="0 0 220 ${h + 40}" aria-label="Qal'a ${lv}-daraja"><ellipse cx="110" cy="${h + 30}" rx="100" ry="10" fill="rgba(0,0,0,.35)"/>
      <rect x="30" y="${h - 50}" width="160" height="80" rx="6" fill="#B99BFF"/><rect x="30" y="${h - 62}" width="20" height="14" fill="#B99BFF"/>${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${32 + i * 27}" y="${h - 62}" width="16" height="14" fill="#B99BFF"/>`).join('')}
      <rect x="80" y="${h - 90}" width="60" height="120" rx="6" fill="#8B6CF0"/>${[0, 1, 2].map(i => `<rect x="${82 + i * 20}" y="${h - 102}" width="14" height="14" fill="#8B6CF0"/>`).join('')}
      <path d="M96 ${h + 30} v-34 a14 14 0 0 1 28 0 v34z" fill="#140D33"/>${[...Array(flags)].map((_, i) => `<path d="M${60 + i * 34} ${h - 64} v-26" stroke="#FFC93C" stroke-width="3"/><path d="M${60 + i * 34} ${h - 90} l18 6 -18 6z" fill="#FFC93C"/>`).join('')}</svg>`;
  }
  return { list, launch, closeOv, classGame, openCastle, castleSvg, hub, MIN, UZ, overlay };
})();
