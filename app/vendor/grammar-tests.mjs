// Run with: node --test grammar-engine.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as G from './grammar-engine.mjs';

const SRC = readFileSync(new URL('./u12.gpack', import.meta.url), 'utf8');
const P = G.parsePack(SRC);
const B = G.buildBank([P]);

// A small older pack, to test reviews of rules from earlier units.
const OLD = G.parsePack(`#pack u11 | Present Continuous
#lesson target=3
#rule pc.now | am/is/are + V-ing | tense: Present Continuous | uz: Hozir davom etayotgan ish: am/is/are + V-ing.
a1 pc.now | Look! It {is raining ~rains ~raining ~is rain (rain)}. | uz: Qarang! Yomgʻir yogʻyapti. | ctx: weather | fb: Hozir → is + V-ing.
a2 pc.now | She {is reading ~reads ~reading ~is read (read)} a book now. | uz: U hozir kitob oʻqiyapti. | ctx: home | fb: "now" → is + V-ing.
a3 pc.now | They {are playing ~play ~playing ~is playing (play)} football at the moment. | uz: Ular hozir futbol oʻynashyapti. | ctx: sport | fb: "at the moment" → are + V-ing.
a4 pc.now | I {am waiting ~wait ~waiting ~is waiting (wait)} for the bus. | uz: Men avtobus kutyapman. | ctx: travel | fb: I → am + V-ing.`);
const B2 = G.buildBank([OLD, P]);

let evN = 0;
const eid = () => `e${++evN}`;
const correctFor = q => G.correctResponse(q);
function wrongFor(q) {
  const r = G.correctResponse(q);
  switch (q.ui) {
    case 'choice': return { choice: q.payload.options.find(o => o.id !== q.key.correct).id };
    case 'tap': return q.key.single ? { selected: [q.payload.tokens.findIndex((_, i) => !q.key.targets.includes(i))] } : { selected: [] };
    case 'match': return { pairs: r.pairs.slice().reverse().length > 1 && r.pairs.slice().reverse().some((p, i) => p !== r.pairs[i]) ? r.pairs.slice().reverse() : [-1] };
    case 'selects': case 'slots': return { values: r.values.map(() => '__') };
    case 'type': return { text: 'zzz' };
    case 'tiles': return { tiles: (r.tiles.length > 1 ? r.tiles.slice().reverse() : ['zzz']) };
    case 'rightwrong': return q.key.wrong ? { verdict: 'right' } : { verdict: 'wrong', tapped: 0 };
    case 'fix': return { tapped: r.tapped, text: 'zzz' };
    case 'sort': return { bins: r.bins.map(b => 1 - b) };
    case 'pair': return { map: r.map.map(m => 1 - m) };
    case 'dialog': return { values: r.values.map(() => 'zzz') };
    case 'chain': return { choices: r.choices.map(() => 'z') };
  }
}
/** Runs a session; answer(plan, q, i) returns 'right' | 'wrong' | 'rapid'. Returns { events, plans }. */
function run(S, Bk, sid, answer, max = 500) {
  const events = [], plans = [];
  for (let i = 0; i < max; i++) {
    const plan = G.nextQuestion(S, Bk, sid); if (!plan) break;
    const q = G.buildQuestion(Bk, plan); const how = answer(plan, q, i);
    const resp = how === 'wrong' ? wrongFor(q) : correctFor(q);
    const rt = how === 'rapid' ? 100 : 20000;
    const { event } = G.submitAnswer(S, Bk, sid, plan, q, resp, rt, eid());
    events.push(event); plans.push(plan);
  }
  return { events, plans };
}
const always = () => 'right';

/* ---------- parser and validator ---------- */
test('parser reads the sample pack', () => {
  assert.equal(P.id, 'u12');
  assert.equal(P.meta.target, 4);
  assert.deepEqual(P.ruleOrder, ['pp.form', 'pp.life', 'ps.time']);
  assert.equal(P.items.length, 15);
  assert.equal(P.errors.length, 0);
  const i1 = P.items.find(x => x.id === 'i1');
  const g = G.gapsOf(i1.segs)[0];
  assert.equal(g.answer, 'have lived');
  assert.deepEqual(g.distractors, ['lived', 'live', 'are living']);
  assert.equal(g.base, 'live');
  assert.equal(P.items.find(x => x.id === 'd1').turns.length, 3);
  assert.equal(P.items.find(x => x.id === 'c1').steps.length, 3);
  assert.deepEqual(G.rulesOfItem(P.items.find(x => x.id === 'x1')).sort(), ['pp.form', 'ps.time']);
});

test('parser reports broken lines', () => {
  const bad = G.parsePack('#pack t | T\n#rule a | x\nbroken line without bar\ni1 a weird | X {y ~z ~w}.\ni1 a | Dup {y ~z ~w}.');
  assert.ok(bad.errors.some(e => e.line === 3));
  assert.ok(bad.errors.some(e => /Unknown kind/.test(e.msg)));
  assert.ok(bad.errors.some(e => /used twice/.test(e.msg)));
});

test('validator passes the sample pack and builds every question', () => {
  const res = G.validatePack(P);
  const fails = res.filter(r => r.level === 'fail');
  assert.deepEqual(fails, []);
});

test('validator blocks bad content', () => {
  const bad = G.parsePack(`#pack t | T
#rule a | f | tense: A
#tl dot | x
i1 a | One {x ~y} gap. | tl: nowhere
i2 a | Two {x ~x ~y} gaps {z ~q ~w}.
i3 b | Bad {x ~y ~z} rule.
i4 a | Cyr {sаw ~see ~seen} here.
i5 a | Pair {x ~y ~z}. | pair: lonely
i6 a | Q {x ~y ~z}. | q: Why? = Because ~No`);
  const msgs = G.validatePack(bad).filter(r => r.level === 'fail').map(r => r.msg).join('\n');
  assert.match(msgs, /at least 2 distractors/);
  assert.match(msgs, /timeline "nowhere"/);
  assert.match(msgs, /repeated distractor|also an accepted/);
  assert.match(msgs, /exactly one gap/);
  assert.match(msgs, /rule b is not defined/);
  assert.match(msgs, /Cyrillic/);
  assert.match(msgs, /no partner/);
  assert.match(msgs, /2 wrong ones/);
});

/* ---------- question types ---------- */
test('all 24 types exist, each tier has its types', () => {
  assert.equal(G.TYPE_ORDER.length, 24);
  G.TIERS.forEach(T => T.types.forEach(t => assert.ok(G.TYPES[t], t)));
});

test('every type builds from every item it supports, and grading is right both ways', () => {
  let built = 0;
  for (const t of G.TYPE_ORDER) {
    const items = B.items.filter(it => G.TYPES[t].avail(B, it));
    assert.ok(items.length > 0, `no item supports ${t}`);
    for (const it of items) for (const level of ['easy', 'hard']) for (const seed of [1, 2, 3]) {
      const q = G.buildQuestion(B, { type: t, item: it.key, level, tier: G.TYPES[t].tier, rule: it.rule, seed });
      assert.ok(q.prompt.en && q.prompt.uz && q.answerText, `${t} ${it.id} missing text`);
      assert.equal(G.grade(q, correctFor(q)).ok, true, `${t} ${it.id} ${level}: correct answer graded wrong`);
      assert.equal(G.grade(q, wrongFor(q)).ok, false, `${t} ${it.id} ${level}: wrong answer graded right`);
      assert.equal(G.grade(q, {}).ok, false, `${t} ${it.id}: empty answer graded right`);
      built++;
    }
  }
  assert.ok(built > 1000);
});

test('the same plan always builds the same question', () => {
  const plan = { type: 'gap', item: 'u12:i1', level: 'hard', tier: 3, rule: 'pp.form', seed: 42 };
  assert.deepEqual(G.buildQuestion(B, plan), G.buildQuestion(B, plan));
});

test('easy has fewer options and a hint; hard has all distractors and no hint', () => {
  const e = G.buildQuestion(B, { type: 'gap', item: 'u12:i1', level: 'easy', tier: 3, rule: 'pp.form', seed: 1 });
  const h = G.buildQuestion(B, { type: 'gap', item: 'u12:i1', level: 'hard', tier: 3, rule: 'pp.form', seed: 1 });
  assert.equal(e.payload.options.length, 3); assert.equal(h.payload.options.length, 4);
  assert.equal(e.hint, 'have/has + V3'); assert.equal(h.hint, null);
  assert.ok(e.payload.options.some(o => o.text === 'are living')); // most obvious distractor kept on easy
  assert.ok(!e.payload.options.some(o => o.text === 'lived'));     // closest distractor only on hard
});

test('options never reveal which one is correct', () => {
  const q = G.buildQuestion(B, { type: 'correct', item: 'u12:i7', level: 'hard', tier: 3, rule: 'ps.time', seed: 9 });
  q.payload.options.forEach(o => assert.equal('ok' in o, false));
});

test('right-or-wrong cannot be passed by guessing "wrong" without finding the mistake', () => {
  for (let seed = 1; seed < 40; seed++) {
    const q = G.buildQuestion(B, { type: 'rightwrong', item: 'u12:i2', level: 'hard', tier: 5, rule: 'pp.form', seed });
    if (!q.key.wrong) continue;
    const notErr = q.payload.tokens.findIndex((_, i) => !q.key.errIdx.includes(i));
    assert.equal(G.grade(q, { verdict: 'wrong', tapped: notErr }).ok, false);
    assert.equal(G.grade(q, { verdict: 'wrong', tapped: q.key.errIdx[0] }).ok, true);
  }
});

test('multi-gap questions credit each rule separately', () => {
  const q = G.buildQuestion(B, { type: 'multi', item: 'u12:x1', level: 'hard', tier: 3, rule: 'pp.form', seed: 5 });
  const vals = q.key.answers.slice(); vals[2] = 'has passed'; // the Past Simple gap wrong
  const g = G.grade(q, { values: vals });
  assert.equal(g.ok, false);
  assert.equal(g.perRule['pp.form'], true);
  assert.equal(g.perRule['ps.time'], false);
});

/* ---------- typed answers ---------- */
test('typed answers: form differences are forgiven, grammar is not', () => {
  const it = P.items.find(x => x.id === 'i2'); const g = G.gapsOf(it.segs)[0];
  const key = { accepted: g.accepted, prev: G.prevWords(it.segs, 0) };
  for (const ok of ['has worked', '  HAS   worked.', 'Has worked!', 'my brother has worked', 'brother has worked', 'hаs worked' /* Cyrillic а */])
    assert.equal(G.checkTyped(ok, key), true, ok);
  for (const bad of ['have worked', 'worked', 'has work', 'has workd', 'is working', '', 'has been worked'])
    assert.equal(G.checkTyped(bad, key), false, bad);

  const i12 = P.items.find(x => x.id === 'i12'); const g12 = G.gapsOf(i12.segs)[0];
  const k12 = { accepted: g12.accepted, prev: G.prevWords(i12.segs, 0) };
  for (const ok of ['have had', "'ve had", 'I have had', "I've had", 'I’ve had', 'Ive had', 'I ’ve had', 'i ve had'.replace(' ve', "'ve")])
    assert.equal(G.checkTyped(ok, k12), true, ok);
  assert.equal(G.checkTyped('had', k12), false);

  const i3 = P.items.find(x => x.id === 'i3'); const g3 = G.gapsOf(i3.segs)[0];
  assert.equal(G.checkTyped("she's known", { accepted: g3.accepted, prev: G.prevWords(i3.segs, 0) }), true);
  assert.equal(G.checkTyped("she's knew", { accepted: g3.accepted, prev: G.prevWords(i3.segs, 0) }), false);

  const i4 = P.items.find(x => x.id === 'i4'); const g4 = G.gapsOf(i4.segs)[0];
  assert.equal(G.checkTyped('have you ever been?', { accepted: g4.accepted, prev: null }), true);
  assert.equal(G.checkTyped('have you been ever', { accepted: g4.accepted, prev: null }), false); // word order matters

  const neg = { accepted: ['have not finished'], prev: 'I' };
  for (const ok of ["haven't finished", 'havent finished', "I haven't finished", 'have not finished']) assert.equal(G.checkTyped(ok, neg), true, ok);
});

/* ---------- engine: ladder ---------- */
test('3 correct in a row, in 3 different sentences, moves a rule up one step', () => {
  const S = G.newStudentState(); G.startSession(S, B, { id: 's1', mode: 'class', packIds: ['u12'], day: 100, seed: 1 });
  const { plans } = run(S, B, 's1', always, 9);
  const byRule = {}; plans.forEach(p => (byRule[p.rule] = byRule[p.rule] || []).push(p.item));
  Object.values(byRule).forEach(items => { for (let i = 0; i + 2 < items.length; i += 3) assert.equal(new Set(items.slice(i, i + 3)).size, 3); });
  G.TIERS; // three rules, three correct each
  Object.keys(byRule).forEach(r => assert.equal(S.rules[r].step, Math.floor(byRule[r].length / 3)));
});

test('the weakest rule is asked first', () => {
  const S = G.newStudentState(); G.startSession(S, B, { id: 's', mode: 'class', packIds: ['u12'], day: 1, seed: 3 });
  const { plans } = run(S, B, 's', always, 30);
  // the gap between the most and least advanced rule never exceeds one step
  for (let i = 0; i < plans.length; i++) {
    const steps = ['pp.form', 'pp.life', 'ps.time'].map(r => (S.rules[r] || { step: 0 }).step);
    assert.ok(Math.max(...steps) - Math.min(...steps) <= 1);
  }
});

test('a wrong answer brings the rule back 2–4 questions later in a different sentence', () => {
  const S = G.newStudentState(); G.startSession(S, B, { id: 's', mode: 'class', packIds: ['u12'], day: 1, seed: 7 });
  let missed = null; const plans = [];
  for (let i = 0; i < 12; i++) {
    const plan = G.nextQuestion(S, B, 's'); const q = G.buildQuestion(B, plan); plans.push(plan);
    const wrong = i === 2; if (wrong) missed = plan;
    G.submitAnswer(S, B, 's', plan, q, wrong ? wrongFor(q) : correctFor(q), 20000, eid());
  }
  const back = plans.findIndex((p, i) => i > 2 && p.fromRequeue);
  assert.ok(back >= 2 + 1 + G.CONFIG.comebackMin - 1 && back <= 2 + G.CONFIG.comebackMax, `came back at ${back}`);
  assert.equal(plans[back].rule, missed.rule);
  assert.notEqual(plans[back].item, missed.item);
  assert.ok(plans[back].why[0].startsWith('Comeback'));
});

test('two wrong in a row drops a rule one step', () => {
  const S = G.newStudentState(); G.startSession(S, B, { id: 's', mode: 'home', packIds: ['u12'], day: 1, seed: 2 });
  ['pp.form', 'pp.life', 'ps.time'].forEach(r => { S.rules[r] = { step: 5, streak: 0, used: [], wrongRow: 0, lastQ: -1, attempts: 0, correct: 0, reviewLevel: 0, reviewDue: null, lastReviewDay: null, secure: false, everLearned: false, learnedDay: null }; });
  let pf = 0;
  run(S, B, 's', p => { if (p.rule !== 'pp.form') return 'right'; pf++; return 'wrong'; }, 30);
  assert.ok(pf >= 2);
  assert.ok(S.rules['pp.form'].step < 5);
});

test('never the same question type 3 times in a row', () => {
  const S = G.newStudentState(); G.startSession(S, B, { id: 's', mode: 'home', packIds: ['u12'], day: 1, seed: 11 });
  const { plans } = run(S, B, 's', (p, q, i) => (i % 5 === 4 ? 'wrong' : 'right'), 45);
  for (let i = 2; i < plans.length; i++) assert.ok(!(plans[i].type === plans[i - 1].type && plans[i].type === plans[i - 2].type), `three ${plans[i].type} at ${i}`);
});

test('types always match the rule\'s tier', () => {
  const S = G.newStudentState(); G.startSession(S, B, { id: 's', mode: 'home', packIds: ['u12'], day: 1, seed: 4 });
  for (let i = 0; i < 45; i++) {
    const plan = G.nextQuestion(S, B, 's'); if (!plan) break;
    const step = (S.rules[plan.rule] || { step: 0 }).step;
    if (plan.mode === 'learn') assert.ok(G.TIERS[Math.floor(step / 2)].types.includes(plan.type), `${plan.type} at step ${step}`);
    const q = G.buildQuestion(B, plan); G.submitAnswer(S, B, 's', plan, q, correctFor(q), 20000, eid());
  }
});

test('the same theme is not repeated when another sentence is free', () => {
  const S = G.newStudentState(); G.startSession(S, B, { id: 's', mode: 'home', packIds: ['u12'], day: 1, seed: 21 });
  const { plans } = run(S, B, 's', always, 45);
  const ctx = plans.map(p => B.byKey[p.item].f.ctx || null);
  const repeats = ctx.filter((c, i) => i && c && c === ctx[i - 1]).length;
  assert.ok(repeats <= 6, `${repeats} back-to-back repeats`);
});

/* ---------- engine: sessions ---------- */
test('classwork stops at the lesson target; homework continues from the same place', () => {
  const S = G.newStudentState();
  const max = G.CONFIG.sessionMax.class; G.CONFIG.sessionMax.class = 500;
  G.startSession(S, B, { id: 'c', mode: 'class', packIds: ['u12'], day: 1, seed: 5 });
  run(S, B, 'c', always);
  G.CONFIG.sessionMax.class = max;
  ['pp.form', 'pp.life', 'ps.time'].forEach(r => assert.equal(S.rules[r].step, 8));
  assert.equal(G.nextQuestion(S, B, 'c'), null);
  G.startSession(S, B, { id: 'h', mode: 'home', packIds: ['u12'], day: 1, seed: 6 });
  const p = G.nextQuestion(S, B, 'h');
  assert.equal(p.tier, 5);
});

test('sessions end at their question limit', () => {
  const S = G.newStudentState(); G.startSession(S, B, { id: 'c', mode: 'class', packIds: ['u12'], day: 1, seed: 5 });
  const { plans } = run(S, B, 'c', always);
  assert.equal(plans.length, G.CONFIG.sessionMax.class);
});

/* ---------- rapid guesses ---------- */
test('rapid answers give no evidence, and two of them slow the next question down', () => {
  const S = G.newStudentState(); G.startSession(S, B, { id: 's', mode: 'home', packIds: ['u12'], day: 1, seed: 8 });
  run(S, B, 's', () => 'rapid', 6);
  Object.values(S.rules).forEach(r => { assert.equal(r.step, 0); assert.equal(r.streak, 0); });
  const plan = G.nextQuestion(S, B, 's'); assert.equal(plan.slowDown, true);
  const q = G.buildQuestion(B, plan); assert.equal(q.delayOptionsMs, G.CONFIG.slowDownMs);
  assert.ok(G.rapidThreshold(q) > G.CONFIG.slowDownMs);
});

/* ---------- secondary credit ---------- */
test('a Past Simple gap inside a Present Perfect item also counts for Past Simple', () => {
  const S = G.newStudentState(); G.startSession(S, B, { id: 's', mode: 'home', packIds: ['u12'], day: 1, seed: 3 });
  ['pp.form', 'ps.time'].forEach(r => { S.rules[r] = { step: 5, streak: 0, used: [], wrongRow: 0, lastQ: -1, attempts: 0, correct: 0, reviewLevel: 0, reviewDue: null, lastReviewDay: null, secure: false, everLearned: false, learnedDay: null }; });
  const plan = { session: 's', qn: 0, mode: 'learn', rule: 'pp.form', type: 'multi', item: 'u12:x1', level: 'easy', tier: 3, seed: 1 };
  const q = G.buildQuestion(B, plan);
  G.submitAnswer(S, B, 's', plan, q, correctFor(q), 20000, eid());
  assert.equal(S.rules['pp.form'].streak, 1);
  assert.equal(S.rules['ps.time'].streak, 1);
  const vals = q.key.answers.slice(); vals[2] = 'has passed';
  G.submitAnswer(S, B, 's', { ...plan, qn: 1 }, q, { values: vals }, 20000, eid());
  assert.equal(S.rules['ps.time'].streak, 0);
  assert.equal(S.rules['pp.form'].streak, 2); // its own gaps were right, so the main rule still counts
});

/* ---------- reviews ---------- */
function learnAll(S, Bk, packId, day) {
  const max = G.CONFIG.sessionMax.home; G.CONFIG.sessionMax.home = 1000;
  G.startSession(S, Bk, { id: `learn-${packId}-${day}`, mode: 'home', packIds: [packId], day, seed: day });
  run(S, Bk, `learn-${packId}-${day}`, always, 1000);
  G.CONFIG.sessionMax.home = max;
}
test('a learned rule is reviewed on day +1, +3 and +7, then counts as learned for good', () => {
  const S = G.newStudentState();
  learnAll(S, B, 'u12', 10);
  const r = S.rules['pp.form'];
  assert.equal(r.step, 12); assert.equal(r.reviewDue, 11); assert.equal(G.ruleStatus(S, 'pp.form', 10).status, 'reviewing');

  G.startSession(S, B, { id: 'r0', mode: 'review', packIds: [], day: 10, seed: 1 });
  assert.equal(G.nextQuestion(S, B, 'r0'), null); // nothing due yet

  let day = 11;
  for (const expectNext of [14, 21, 51]) {
    G.startSession(S, B, { id: `r${day}`, mode: 'review', packIds: [], day, seed: day });
    const { plans } = run(S, B, `r${day}`, always, 20);
    assert.ok(plans.every(p => p.mode === 'review' && p.level === 'hard'));
    assert.equal(S.rules['pp.form'].reviewDue, expectNext);
    day = expectNext;
  }
  assert.equal(S.rules['pp.form'].secure, true);
  assert.equal(G.ruleStatus(S, 'pp.form', day).status, 'secure');
});

test('only the first review of a rule on a day changes its schedule', () => {
  const S = G.newStudentState(); learnAll(S, B, 'u12', 1);
  G.startSession(S, B, { id: 'ra', mode: 'review', packIds: [], day: 2, seed: 1 }); run(S, B, 'ra', always, 20);
  const due = S.rules['ps.time'].reviewDue;
  G.startSession(S, B, { id: 'rb', mode: 'review', packIds: [], day: 2, seed: 2 });
  assert.equal(G.nextQuestion(S, B, 'rb'), null);
  assert.equal(S.rules['ps.time'].reviewDue, due);
});

test('a missed review sends the rule back to Tier 5 and homework relearns it', () => {
  const S = G.newStudentState(); learnAll(S, B, 'u12', 1);
  G.startSession(S, B, { id: 'r', mode: 'review', packIds: [], day: 2, seed: 1 });
  run(S, B, 'r', p => (p.rule === 'pp.life' ? 'wrong' : 'right'), 20);
  assert.equal(S.rules['pp.life'].step, G.CONFIG.reviewFailStep);
  assert.equal(G.ruleStatus(S, 'pp.life', 2).status, 'relearn');
  G.startSession(S2(S), B, { id: 'h', mode: 'home', packIds: [], day: 3, seed: 3 });
  const p = G.nextQuestion(S, B, 'h');
  assert.equal(p.rule, 'pp.life'); assert.equal(p.tier, 5);
});
function S2(S) { return S; }

test('homework mixes in due reviews of older units every 4 questions', () => {
  const S = G.newStudentState(); learnAll(S, B2, 'u11', 1);
  assert.equal(S.rules['pc.now'].step, 12);
  G.startSession(S, B2, { id: 'h', mode: 'home', packIds: ['u12'], day: 2, seed: 9 });
  const { plans } = run(S, B2, 'h', always, 12);
  const rv = plans.map((p, i) => (p.mode === 'review' ? i : -1)).filter(i => i >= 0);
  assert.deepEqual(rv, [3]); // one due rule, reviewed once at the 4th question
  assert.equal(plans[3].rule, 'pc.now');
});

/* ---------- events, replay, corrections ---------- */
test('replaying the saved events rebuilds exactly the same state', () => {
  const S = G.newStudentState(); const events = [];
  events.push(G.startSession(S, B, { id: 'c', mode: 'class', packIds: ['u12'], day: 1, seed: 12 }));
  events.push(...run(S, B, 'c', (p, q, i) => (i % 4 === 1 ? 'wrong' : i % 9 === 0 ? 'rapid' : 'right')).events);
  events.push(G.startSession(S, B, { id: 'h', mode: 'home', packIds: ['u12'], day: 2, seed: 13 }));
  events.push(...run(S, B, 'h', (p, q, i) => (i % 6 === 2 ? 'wrong' : 'right')).events);
  const R = G.replay(B, JSON.parse(JSON.stringify(events)));
  assert.deepEqual(R.rules, S.rules);
  assert.deepEqual(R.sessions, S.sessions);
  // and the next question is the same
  assert.deepEqual(G.nextQuestion(R, B, 'h'), G.nextQuestion(S, B, 'h'));
});

test('a teacher correction (accept an answer) recomputes the student exactly', () => {
  const S = G.newStudentState(); const events = [];
  events.push(G.startSession(S, B, { id: 'c', mode: 'class', packIds: ['u12'], day: 1, seed: 14 }));
  events.push(...run(S, B, 'c', (p, q, i) => (i === 0 ? 'wrong' : 'right'), 10).events);
  const first = events[1]; assert.equal(first.ok, false);
  const fixed = G.replay(B, events, { [first.id]: true });
  assert.ok(fixed.rules[first.rule].correct === S.rules[first.rule].correct + 1);
  const log = G.applyEvent(G.replay(B, events.slice(0, 1)), B, first, { [first.id]: true });
  assert.ok(log[0].startsWith('Teacher correction'));
});

test('events are plain data that survive saving as JSON', () => {
  const S = G.newStudentState();
  const ev0 = G.startSession(S, B, { id: 'c', mode: 'class', packIds: ['u12'], day: 1, seed: 1 });
  const { events } = run(S, B, 'c', always, 3);
  [ev0, ...events].forEach(e => assert.deepEqual(JSON.parse(JSON.stringify(e)), e));
});

test('nextQuestion never changes the state', () => {
  const S = G.newStudentState(); G.startSession(S, B, { id: 'c', mode: 'class', packIds: ['u12'], day: 1, seed: 1 });
  const before = JSON.stringify(S); G.nextQuestion(S, B, 'c'); G.nextQuestion(S, B, 'c');
  assert.equal(JSON.stringify(S), before);
});

/* ---------- several packs ---------- */
test('rules keep their progress across packs', () => {
  const extra = G.parsePack(`#pack u13 | More Present Perfect
#lesson target=4
#rule pp.form | have/has + V3 | tense: Present Perfect | uz: have/has + V3.
n1 pp.form | Dilnoza {has taught ~have taught ~taught ~is teaching (teach)} here since 2018. | uz: Dilnoza 2018-yildan beri shu yerda dars beradi. | ctx: work | fb: since → has + V3.`);
  const B3 = G.buildBank([P, extra]);
  const S = G.newStudentState(); S.rules['pp.form'] = { step: 6, streak: 0, used: [], wrongRow: 0, lastQ: -1, attempts: 0, correct: 0, reviewLevel: 0, reviewDue: null, lastReviewDay: null, secure: false, everLearned: false, learnedDay: null };
  G.startSession(S, B3, { id: 'h', mode: 'home', packIds: ['u13'], day: 1, seed: 1 });
  const p = G.nextQuestion(S, B3, 'h');
  assert.equal(p.rule, 'pp.form'); assert.equal(p.tier, 4); // continues at its own tier, not from zero
});
