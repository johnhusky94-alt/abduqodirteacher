import { launch } from './cdp.mjs';
const B = await launch(); const out = []; const ok = (c, m) => out.push((c ? 'PASS ' : 'FAIL ') + m);
try {
  let p = await B.page(); await p.go('http://localhost:8787/'); await p.ev(`localStorage.clear(); true`); await p.go('http://localhost:8787/');
  await p.ev(`document.querySelector('#lg-login').value='ali'; document.querySelector('#lg-pass').value='1111'; document.querySelector('[data-act=login]').click()`);
  await p.until(`App.ctx.mode === 'student'`, 20000);
  ok(await p.ev(`Store.events('u2').filter(e => e.id.startsWith('bulk')).length === 12000`), 'all 12,000 own answers loaded in pages');
  ok(await p.ev(`!Store.db.events.some(e => e.sid === 'u3' && e.kind === 'vocab')`), "classmate's raw practice answers are not sent to the student");
  ok(await p.ev(`School.weekAchko('u3', T.weekStart()) === 4`), "classmate's points still show on the leaderboard (4): " + await p.ev(`School.weekAchko('u3', T.weekStart())`));
  // refresh brings in only new answers
  await p.ev(`Store.ev('u2', 'prac', { ok: true, ach: true }); true`); await p.sleep(2500);
  await p.ev(`Net.refresh(true)`); await p.sleep(500);
  ok(await p.ev(`Store.events('u2').filter(e => e.kind === 'prac').length === 1 && Store.events('u2').filter(e => e.id.startsWith('bulk')).length === 12000`), 'refresh adds the new answer once, nothing duplicated');
  // the server failing to load does not log out
  await p.ev(`window._f = window.fetch; window.fetch = (u, o) => String(u).includes('v2_boot') ? Promise.resolve(new Response(JSON.stringify({ message: 'canceling statement due to statement timeout' }), { status: 500 })) : window._f(u, o); true`);
  await p.ev(`App.start(); true`); await p.sleep(800);
  ok(await p.ev(`!!document.querySelector('[data-act=retryboot]') && Net.hasToken()`), 'server timeout shows "Qayta urinish" and keeps the login');
  await p.ev(`window.fetch = window._f; document.querySelector('[data-act=retryboot]').click(); true`);
  await p.until(`App.ctx.mode === 'student' && !document.querySelector('[data-act=retryboot]')`, 20000); ok(true, 'retry loads the site');
  const errs = p.logs.filter(l => /EXC/.test(l)); ok(!errs.length, 'no page errors ' + errs.join(' | '));
} catch (e) { out.push('CRASH ' + e.message); }
console.log(out.join('\n')); B.kill(); process.exit(0);
