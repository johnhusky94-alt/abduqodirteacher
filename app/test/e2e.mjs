import { launch } from './cdp.mjs';
const B = await launch(); const out = [];
const ok = (c, m) => { out.push((c ? 'PASS ' : 'FAIL ') + m); };
try {
  // 1. student logs in with the old site's account
  let p = await B.page(); await p.go('http://localhost:8787/');
  await p.ev(`document.querySelector('#lg-login').value='ali'; document.querySelector('#lg-pass').value='1111'; document.querySelector('[data-act=login]').click()`);
  await p.until(`App.ctx.mode === 'student'`);
  ok(await p.ev(`App.ctx.sid === 'u2'`), 'student logs in with old login, id u2');
  ok(await p.ev(`Store.db.works.length === 1`), 'student sees the assigned homework');
  ok(await p.ev(`School.gold('u2') === 605`), 'gold carried over (605)');
  const st = await p.ev(`JSON.stringify(Object.values(School.vstate(School.stu('u2')).words).map(w => [w.wid, w.stage]))`);
  ok(st.includes('["hospital",5]') && st.includes('["brother-in-law",3]'), 'old words on the right level: ' + st);
  await p.shot('/tmp/pgtest/student-home.png');
  // an answer event and a castle change go to the server
  await p.ev(`Store.ev('u2', 'prac', { ok: true, ach: true }); School.addGold('u2', 5, 'prac'); true`);
  await p.sleep(2500);
  ok(await p.ev(`Net.pending() === 0`), 'changes sent (queue empty)');
  // reload: still logged in, data from server
  await p.go('http://localhost:8787/'); await p.until(`App.ctx.mode === 'student'`);
  ok(await p.ev(`Store.db.events.some(e => e.kind === 'prac') && School.gold('u2') === 610`), 'after reload: answer and gold (610) came back from the server');
  // try to cheat: write another student's event
  await p.ev(`Store.db.events.push({ id: 'cheat1', sid: 'u3', kind: 'ans', ts: Date.now() }); Store.save(); true`); await p.sleep(1500);
  p.close();

  // 2. teacher: change a password, add a student, assign-free check
  p = await B.page(); await p.go('http://localhost:8787/'); await p.ev(`localStorage.clear(); true`); await p.go('http://localhost:8787/');
  await p.ev(`document.querySelector('[data-k=teacher]').click()`); await p.sleep(200);
  await p.ev(`document.querySelector('#lg-login').value='abduqodir'; document.querySelector('#lg-pass').value='tpass'; document.querySelector('[data-act=login]').click()`);
  await p.until(`App.ctx.mode === 'teacher'`);
  ok(await p.ev(`Store.db.students.length === 3 && Store.db.teachers.length === 1`), 'teacher sees 3 students and 1 teacher');
  ok(await p.ev(`!Store.db.events.some(e => e.id === 'cheat1')`), "student could not write another student's answer");
  await p.ev(`Store.db.students.find(s => s.id === 'u3').pass = 'newpass9'; Store.db.students.push({ id: 'snew1', name: 'Nodir Test', login: 'nodir.t', pass: 'abc123', cls: 'c1', group: 'B1' }); Store.save(); true`);
  await p.sleep(2500);
  ok(await p.ev(`Net.pending() === 0 && Store.db.students.every(s => !s.pass)`), 'account changes sent, no password kept in the page');
  await p.ev(`Tea.V.tab = 'settings'; App.render(); true`); await p.sleep(300); await p.shot('/tmp/pgtest/teacher.png');
  await p.ev(`Store.db.students.find(s => s.id === 'snew1').login = 'abduqodir'; Store.save(); true`); await p.sleep(2500);
  ok(await p.ev(`Store.db.students.find(s => s.id === 'snew1').login === 'nodir.t'`), 'taken login refused and the page shows the server value again');
  p.close();

  // 3. the new student and the changed password work
  for (const [l, pw, want] of [['zarina', 'newpass9', 'u3'], ['nodir.t', 'abc123', 'snew1']]) {
    p = await B.page(); await p.go('http://localhost:8787/'); await p.ev(`localStorage.clear(); true`); await p.go('http://localhost:8787/');
    await p.ev(`document.querySelector('#lg-login').value='${l}'; document.querySelector('#lg-pass').value='${pw}'; document.querySelector('[data-act=login]').click()`);
    await p.until(`App.ctx.mode === 'student'`); ok(await p.ev(`App.ctx.sid === '${want}'`), `${l} logs in with the new password`);
    await p.ev(`App.ctx && Net.logout(); true`); p.close();
  }
  p = await B.page(); await p.go('http://localhost:8787/'); await p.ev(`localStorage.clear(); true`); await p.go('http://localhost:8787/');
  await p.ev(`document.querySelector('#lg-login').value='zarina'; document.querySelector('#lg-pass').value='2222'; document.querySelector('[data-act=login]').click()`);
  await p.sleep(1500); ok(await p.ev(`App.ctx.mode === 'login'`), 'old password no longer works after the change');
  const errs = p.logs.filter(l => /EXC|error/i.test(l)); ok(!errs.length, 'no page errors ' + errs.join(' | '));
} catch (e) { out.push('CRASH ' + e.message); }
console.log(out.join('\n')); B.kill(); process.exit(0);
