/* =====================================================================
   SAMPLE DATA (first start only): accounts, classes, timetable, works,
   lesson plans, and a short history for the sample students so every
   teacher page has something to show. Admin can reset it in Settings → Data.
   ===================================================================== */
const Seed = (() => {
  const HW_A2_FOOD = `TYPE: homework
LEVEL: A2
LESSON: 4
TITLE: Food: some, any, a lot of

[words]
low-fat | adj | with very little fat in it | kam yogʻli
> I always buy [low-fat] milk. | sweet, hungry, empty
>> She drinks [low-fat] milk every day.
? low-fet, lowfat
! full-fat
sugar-free | adj | with no sugar in it | shakarsiz
> This cola is [sugar-free]. | delicious, salty, hot
? suger-free
home-made | adj | made at home, not in a shop | uyda tayyorlangan
> My grandmother's [home-made] bread is the best. | frozen, fast, tired
? home-maid
snack | n | a small amount of food between meals | yengil tamaddi
> An apple is a healthy [snack]. | dinner, plate, menu
>> Nuts are a good [snack].
? snak
~ snake
vegetable | n | a plant you eat, for example a carrot | sabzavot
> Carrots are my favourite [vegetable]. | drink, fruit juice, dessert
? vegetabel, vegtable
healthy | adj | good for your body | sogʻlom
> Fish is [healthy] food. | lazy, noisy, empty
! unhealthy
= good for you
? helthy

[warmup]
HELP: Oldingi darslardagi soʻzlarni takrorlang. Tizim aynan siz unutayotgan soʻzlarni tanlaydi.

[grammar]
HELP: Qoidani oʻqing va gaplarni toʻldiring. Xato qilsangiz, tizim shu qoidani yana soʻraydi.
#rule some.pos | some + plural / uncountable | tense: some/any | uz: Darak gapda "some": There is some milk. I've got some apples.
#rule any.neg | any in negatives and questions | tense: some/any | uz: Inkor va soʻroq gapda "any": There isn't any milk. Are there any apples?
#rule a.an | a / an + one countable thing | tense: a/an | uz: Bitta sanaladigan narsa: a banana, an egg (unli tovush oldidan "an").
#confuse some.pos any.neg
s1 some.pos | There is {some ~any ~a ~an} milk in the fridge. | uz: Muzlatgichda biroz sut bor. | fb: Darak gap va "milk" sanalmaydi → some.
s2 some.pos | I've got {some ~any ~a ~an} apples in my bag. | uz: Sumkamda bir nechta olma bor. | fb: Darak gap, koʻplik → some.
s3 some.pos | We need {some ~any ~a ~an} bread for breakfast. | uz: Nonushta uchun bizga non kerak. | fb: Darak gap, "bread" sanalmaydi → some.
s4 some.pos | She bought {some ~any ~a ~an} grapes at the market. | uz: U bozordan uzum sotib oldi. | fb: Darak gap → some.
n1 any.neg | There isn't {any ~some ~a ~an} sugar in my tea. | uz: Choyimda shakar yoʻq. | fb: Inkor gap → any.
n2 any.neg | Are there {any ~some ~a ~an} eggs in the fridge? | uz: Muzlatgichda tuxum bormi? | fb: Soʻroq gap → any.
n3 any.neg | We haven't got {any ~some ~a ~an} juice. | uz: Bizda sharbat yoʻq. | fb: Inkor gap → any.
n4 any.neg | Is there {any ~some ~a ~an} cheese on the pizza? | uz: Pitsada pishloq bormi? | fb: Soʻroq gap → any.
a1 a.an | I eat {an ~a ~some ~any} egg every morning. | uz: Men har kuni ertalab bitta tuxum yeyman. | fb: "egg" unli tovush bilan boshlanadi → an.
a2 a.an | Can I have {a ~an ~some ~any} banana, please? | uz: Bitta banan olsam boʻladimi? | fb: Bitta banan, undosh tovush → a.
a3 a.an | There is {an ~a ~some ~any} orange on the table. | uz: Stolda bitta apelsin bor. | fb: "orange" unli tovush bilan boshlanadi → an.
a4 a.an | He wants {a ~an ~some ~any} sandwich for lunch. | uz: U tushlikka bitta sendvich xohlaydi. | fb: Bitta sendvich → a.

[reading]
## 1 Read Malika's blog and answer the questions.
HELP: Matnni oʻqing. Keyin savollarga javob bering. Matnda javob bor.
TEXT: My healthy week
"""
Hi! I'm Malika and I'm 13. This week I am trying to eat healthy food.
For breakfast I have low-fat yoghurt with some fruit. My mum makes home-made bread, so I don't buy bread at the shop.
At school I don't eat chips any more. My snack is an apple or some nuts.
My brother-in-law, Bobur, is a cook. He says sugar-free drinks are better than fizzy drinks, but water is the best!
"""
? What does Malika have for breakfast? | Chips and cola | Low-fat yoghurt with fruit* | Home-made pizza
? Where does her bread come from? | The shop | Her mum makes it* | Bobur's café
? What is Malika's snack at school? | Chips | Cake | An apple or nuts*
_ Bobur is Malika's [brother-in-law]. He is a cook.
_ Bobur thinks [sugar-free] drinks are better than fizzy drinks.

[vocabulary]
HELP: Yangi soʻzlarni oʻrganing: avval tanishing, keyin mashq qiling.
low-fat = kam yogʻli
sugar-free = shakarsiz
home-made = uyda tayyorlangan
snack = yengil tamaddi
vegetable = sabzavot
healthy = sogʻlom

[writing]
## 2 Write about what you eat in a healthy day.
HELP: Bir kunlik sogʻlom ovqatlanishingiz haqida yozing: nonushta, tushlik, kechki ovqat va tamaddi. Yangi soʻzlardan foydalaning.
PROMPT: Write about a healthy day: what do you eat for breakfast, lunch, dinner and as a snack? Use some of the new words.
MIN: 40
MAX: 80
KIND: paragraph

[practice]
## 3 Complete with some, any, a or an.
HELP: Har bir boʻsh joyga some, any, a yoki an yozing.
EXAMPLE: There's some water in the bottle.
_ There aren't [any] biscuits in the box.
_ I'd like [an] apple, please.
_ We've got [some] rice for dinner.
_ Is there [any] milk in the fridge?
## 4 Choose the correct word.
? I always eat ___ breakfast. | a | an | – (nothing)*
? Do you want ___ sugar-free cola? | a* | an | any
? She has got ___ home-made cake. | an | some* | any

[review]
HELP: Bugungi va oldingi soʻzlar aralash. Oxirida "boss soʻz" chiqadi.
`;

  const HW_A2_FAMILY = Tea.EXAMPLE.replace('LESSON: 1', 'LESSON: 5');

  const HW_B1_PP = (gp) => `TYPE: homework
LEVEL: B1
LESSON: 4
TITLE: Present Perfect or Past Simple?

[words]
experience | n | something that happens to you | tajriba
> Travelling alone was a great [experience]. | weather, holiday, journey
recently | adv | not long ago | yaqinda
> I have [recently] started a new course. | tomorrow, always, never
abroad | adv | in or to another country | chet elda
> Have you ever been [abroad]? | inside, home, near
achievement | n | something good you did with effort | yutuq
> Passing the exam was a big [achievement]. | mistake, problem, accident
well-known | adj | known by many people | mashhur
> Samarkand is a [well-known] city. | unknown, quiet, empty
? wellknown, well-knowen
up-to-date | adj | modern, with the newest information | zamonaviy
> This map is not [up-to-date]. | old-fashioned, broken, wrong

[warmup]

[grammar]
HELP: Qoidani oʻqing va gaplarni toʻldiring. Tizim qiyinlikni sizga moslaydi.
${gp}

[vocabulary]
experience = tajriba
recently = yaqinda
abroad = chet elda
achievement = yutuq
well-known = mashhur
up-to-date = zamonaviy

[writing]
## 1 Write about an experience.
HELP: Hayotingizdagi esda qolgan tajriba haqida yozing. Present Perfect va Past Simple dan foydalaning.
PROMPT: Write about a great experience in your life. Have you ever been somewhere special? When did you go and what did you do?
MIN: 70
MAX: 120
KIND: paragraph

[practice]
## 2 Complete the sentences with the correct form.
_ I [have lived/'ve lived] here since 2019.
_ She [went] to Bukhara last summer.
_ They [have never eaten/'ve never eaten] sushi.
_ This is a [well-known] restaurant.

[review]
`;

  const WEEKLY_A2 = `TYPE: weekly
LEVEL: A2
TIME: 20
TITLE: Weekly test: food and family

[vocabulary]
## 1 Choose the correct word.
? An apple is a healthy ___ . | snack* | dinner | menu
? This cola has no sugar. It's ___ . | low-fat | sugar-free* | home-made
? My sister's husband is my ___ . | cousin | uncle | brother-in-law*
? Carrots and beans are ___ . | fruit | vegetables* | drinks

## 2 Write the missing word.
_ My mum makes [home-made] bread every Sunday.
_ I buy [low-fat] yoghurt because it's healthy.
_ My aunt's son is my [cousin].

[grammar]
## 3 Complete with some, any, a or an.
_ There isn't [any] juice in the bottle.
_ I'd like [an] egg, please.
_ We've got [some] bread.
? Are there ___ bananas? | some | any* | an
`;

  const TEST_A2 = `TYPE: test
LEVEL: A2
OPEN: 10080
TIME: 15
TITLE: Quick test: new words

[vocabulary]
## 1 Write the word. The hyphens are already there.
_ The husband of your sister is your [brother-in-law].
_ With no sugar in it: [sugar-free]
_ With very little fat: [low-fat]
_ Made at home, not in a shop: [home-made]
## 2 Choose.
? Fish is ___ food. | healthy* | lazy | noisy
? A small amount of food between meals is a ___ . | snack* | menu | plate
`;

  const TASK = `TYPE: task
LEVEL: A2
DUE: 5
TITLE: A letter from Samarkand

[reading]
## 1 Read the letter and answer.
HELP: Xatni oʻqing va savollarga javob bering.
TEXT: Dear Aziz
"""
Dear Aziz,
I'm in Samarkand with my family. We've visited the Registan and we've eaten a lot of plov!
Yesterday my uncle took us to a big market. I bought some dried fruit and a home-made cake.
See you soon,
Jasur
"""
? Where is Jasur? | In Bukhara | In Samarkand* | In Tashkent
? What did he buy at the market? | Dried fruit and a cake* | Plov | A map
_ Jasur's [uncle] took them to the market.

[writing]
## 2 Write a reply to Jasur.
HELP: Jasurga javob xati yozing: oʻzingiz haqingizda va dam olish kunlaringiz haqida.
PROMPT: Write a short letter to Jasur. Tell him about your weekend.
MIN: 40
MAX: 90
KIND: letter
`;

  /* a short homework used for the earlier weeks (no word engine, so the sample history is exact) */
  const HW_OLD = (n, title, items) => `TYPE: homework
LEVEL: A2
LESSON: ${n}
TITLE: ${title}

[grammar]
## 1 Complete the sentences.
HELP: Gaplarni toʻldiring.
${items.map(x => '_ ' + x).join('\n')}

[reading]
## 2 Read and choose.
TEXT: Tom eats breakfast at seven. He has some bread, an egg and a glass of milk. He doesn't drink coffee.
? When does Tom eat breakfast? | At six | At seven* | At eight
? What doesn't Tom drink? | Milk | Coffee* | Water
? What does he eat? | Bread and an egg* | Chips | Rice

[practice]
## 3 Match.
= breakfast => the first meal of the day
= lunch => the meal in the middle of the day
= dinner => the meal in the evening
`;
  const OLD_ITEMS = [
    ['There is [some] milk.', 'I have got [an] orange.', 'Are there [any] eggs?', 'We need [some] rice.'],
    ['She [likes] bananas.', 'They [don\'t like/do not like] fish.', 'He [eats] a lot of fruit.', 'I [drink] tea every day.'],
    ['How [much] sugar do you want?', 'How [many] apples are there?', 'There are [a lot of/lots of] grapes.', 'There isn\'t [much] bread.'],
    ['You [should] eat vegetables.', 'You [shouldn\'t/should not] drink cola every day.', 'We [should] drink water.', 'He [shouldn\'t/should not] eat chips.'],
    ['My [brother-in-law] is a cook.', 'This yoghurt is [low-fat].', 'I like [home-made] cakes.', 'This drink is [sugar-free].'],
  ];
  const WEEKLY_OLD = `TYPE: weekly
LEVEL: A2
TIME: 20
TITLE: Weekly test: food

[vocabulary]
## 1 Choose.
? Milk comes from ___ . | cows* | trees | fish
? A long yellow fruit: | a lemon | a banana* | a grape
? We eat soup with a ___ . | spoon* | knife | cup
## 2 Write.
_ How [much] water do you drink?
_ There aren't [any] biscuits.
_ I'd like [an] apple.
`;

  const PLAN_WORDS = [
    [['apple', 'olma'], ['banana', 'banan'], ['bread', 'non'], ['cheese', 'pishloq'], ['egg', 'tuxum'], ['milk', 'sut']],
    [['ingredient', 'masalliq'], ['fat', "yog'"], ['sugar', 'shakar'], ['salt', 'tuz']],
    [['countable', 'sanaladigan'], ['uncountable', 'sanalmaydigan'], ['some', 'biroz'], ['any', 'hech qanday']],
    [['bottle', 'shisha'], ['packet', 'paket'], ['tin', 'konserva qutisi'], ['bowl', 'kosa'], ['diet', 'parhez']],
    [['brother-in-law', 'pochcha'], ['cousin', 'amakivachcha'], ['aunt', 'xola'], ['uncle', 'amaki']],
  ];
  const PLAN_TITLES = ['Food and drink', "What's in your food?", 'Countable and uncountable', 'Containers · a balanced diet', 'Family words'];

  function build() {
    const W0 = T.weekStart(), Wm1 = T.addWeeks(W0, -1), Wm2 = T.addWeeks(W0, -2), now = T.now();
    const db = { v: 1, settings: { nextW: 100, clock: 0, created: now }, teachers: [], classes: [], groups: ['A1', 'A2', 'B1', 'B2'], students: [], works: [], plans: {}, writings: [], overrides: {}, reports: [], accept: {}, events: [] };
    db.teachers.push({ id: 't1', name: 'Abduqodir', login: 'admin', pass: 'admin2026', admin: true }, { id: 't2', name: 'Dilnoza Karimova', login: 'dilnoza', pass: 'teach123', admin: false });
    const L45 = (h, m) => { const a = h * 60 + m, b = a + 45, f = x => String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); return [f(a), f(b)]; };
    db.classes.push({ id: 'c1', name: '7-A', teacher: 't1', taught: 'B1', sched: { Mon: [L45(8, 30), L45(9, 25)], Tue: [], Wed: [L45(10, 20)], Thu: [], Fri: [L45(11, 15)], Sat: [L45(13, 0)] } });
    db.classes.push({ id: 'c2', name: '8-B', teacher: 't2', taught: 'B2', sched: { Mon: [], Tue: [L45(9, 25)], Wed: [], Thu: [L45(10, 20), L45(11, 15)], Fri: [], Sat: [] } });
    const ST = [['Aziz Karimov', 'aziz', 'c1', 'A2'], ['Malika Rahimova', 'malika', 'c1', 'A2'], ['Javohir Toshev', 'javohir', 'c1', 'A2'], ['Sevara Aliyeva', 'sevara', 'c1', 'A2'], ['Bekzod Nazarov', 'bekzod', 'c1', 'A2'], ['Dilnoza Qodirova', 'dilnozaq', 'c1', 'A2'],
      ['Nodira Saidova', 'nodira', 'c1', 'B1'], ['Aziza Mirzayeva', 'aziza', 'c1', 'B1'], ['Sardor Usmonov', 'sardor', 'c1', 'B1'],
      ['Kamola Ergasheva', 'kamola', 'c2', 'A2'], ['Jasur Xolmatov', 'jasur', 'c2', 'A2'], ['Laylo Rustamova', 'laylo', 'c2', 'A2'], ['Otabek Yusupov', 'otabek', 'c2', 'B2'], ['Madina Ahmedova', 'madina', 'c2', 'B2']];
    ST.forEach(([name, login, cls, group], i) => db.students.push({ id: 's' + (i + 1), name, login, pass: '1234', cls, group }));
    let k = 0; const add = (type, code, groups, week, lesson, sentAt) => { const w = { id: 'w' + (++k), type, code, groups, sentAt: sentAt || (week ? week - 2 * T.DAY : now), by: 't1', title: '' }; if (week) w.week = week; if (lesson) w.lesson = lesson; db.works.push(w); return w; };
    // unit 6 classwork: lessons 1–5 last week, 6–9 and a revision this week
    const u6 = Code.splitWorks(window.__UNIT6 || '');
    u6.slice(0, 5).forEach((c, i) => add('classwork', c.replace(/^LESSON:\s*\d+/m, 'LESSON: ' + (i + 1)), ['A2'], Wm1, i + 1));
    u6.slice(5, 9).forEach((c, i) => add('classwork', c.replace(/^LESSON:\s*\d+/m, 'LESSON: ' + (i + 1)), ['A2'], W0, i + 1));
    if (u6[0]) add('classwork', u6[0].replace(/^LESSON:\s*\d+/m, 'LESSON: 5').replace(/^TITLE:.*$/m, 'TITLE: Revision: food and drink'), ['A2'], W0, 5);
    // homework: two earlier weeks (short) and this week (full, with the engines)
    [Wm2, Wm1].forEach((wk, j) => OLD_ITEMS.forEach((it, i) => add('homework', HW_OLD(i + 1, ['Food grammar', 'Likes and dislikes', 'How much, how many', 'Should', 'New words'][i] + (j ? '' : ' (1)'), it), ['A2', 'B1', 'B2'], wk, i + 1)));
    OLD_ITEMS.slice(0, 3).forEach((it, i) => add('homework', HW_OLD(i + 1, ['Food grammar', 'Likes and dislikes', 'How much, how many'][i], it), ['A2', 'B1', 'B2'], W0, i + 1));
    add('homework', HW_OLD(5, 'New words', OLD_ITEMS[4]).replace('LEVEL: A2', 'LEVEL: B1'), ['B1', 'B2'], W0, 5);
    add('homework', HW_A2_FOOD, ['A2'], W0, 4); add('homework', HW_A2_FAMILY, ['A2'], W0, 5);
    const gp = (window.__U12 || '').split('\n').filter(l => !/^#pack|^#lesson/.test(l.trim())).join('\n');
    add('homework', HW_B1_PP(gp), ['B1'], W0, 4);
    add('weekly', WEEKLY_OLD, ['A2', 'B1', 'B2'], Wm2); add('weekly', WEEKLY_OLD.replace('Weekly test: food', 'Weekly test: food (2)'), ['A2', 'B1', 'B2'], Wm1); add('weekly', WEEKLY_A2, ['A2', 'B1', 'B2'], W0);
    add('test', TEST_A2, ['A2'], null, null, now - 3600e3); add('task', TASK, ['A2', 'B1'], null, null, now - 5 * 3600e3);
    // lesson plans for 7-A (this week and last week)
    [Wm1, W0].forEach(wk => PLAN_WORDS.forEach((ws, i) => db.plans[`c1|${wk}|${i + 1}`] = { title: PLAN_TITLES[i], goal: i === 2 ? 'Use some / any / a / an with food words.' : 'Learn and use the lesson words.', steps: ['Warm-up: 3 questions about breakfast', 'Book exercises with the taught group', 'Pair work: ask and answer', 'Exit question'], words: ws.map(w => [w[0], N.uzFix(w[1])]) }));
    return db;
  }

  /* a short, believable history for the sample students (not for the demo student's current week) */
  function history() {
    const db = Store.db, now = T.now(), W0 = T.weekStart();
    const ability = { s1: .78, s2: .93, s3: .66, s4: .88, s5: .55, s6: .72, s7: .9, s8: .8, s9: .62, s10: .84, s11: .58, s12: .76, s13: .9, s14: .7 };
    db.students.forEach(s => {
      const r = rng(hash('hist' + s.id)), ab = ability[s.id] || .7;
      School.instances(s, now).forEach(inst => {
        if (inst.type === 'test' || inst.type === 'task') return;
        if (s.id === 's1' && (inst.w.week === W0 || inst.type === 'weekly' && inst.w.week === W0)) return;   // the demo student does this week himself
        const end = Math.min(now - 60e3, inst.type === 'classwork' ? inst.close : inst.close + T.DAY);
        if (inst.open >= end || r() > (inst.type === 'classwork' ? .95 : .88)) return;
        const P = inst.P;
        let ts = inst.open + Math.floor(r() * Math.max(1, (end - inst.open) * .6));
        const ev = (kind, d) => { ts += 20e3 + Math.floor(r() * 40e3); db.events.push(Object.assign({ id: uid('e'), sid: s.id, kind, ts }, d)); };
        ev('att', { work: inst.id, att: 1, endsAt: inst.timer ? ts + inst.timer * 6e4 : null });
        School.workSections(P).forEach(({ s: sec, si }) => {
          sec.ex.forEach((ex, ei) => {
            if (ex.answer.startsWith('free')) return;
            const items = [], inputs = {}; let right = 0, wrong = 0, total = 0;
            ex.items.forEach((it, i) => {
              if (it.example) return;
              if (it.type === 'choice') { const ok = r() < ab; const j = ok ? it.opts.findIndex(o => o.ok === 2) : it.opts.findIndex(o => !o.ok); inputs['c' + i] = [j]; total++; ok ? right++ : wrong++; items.push({ i: String(i), ok, input: it.opts[j] ? it.opts[j].t : '' }); }
              if (it.type === 'gap') it.segs.filter(x => x.gap).forEach((g, gi) => { const ok = r() < ab; const val = ok ? g.gap[0] : g.gap[0].slice(0, -1) + (g.gap[0].endsWith('e') ? 'a' : 'e'); inputs[`g${i}_${gi}`] = val; total++; ok ? right++ : wrong++; items.push({ i: i + ':' + gi, ok, input: val }); });
              if (it.type === 'match') { const ok = r() < ab; inputs['m' + i] = ok ? it.right : '—'; total++; ok ? right++ : wrong++; items.push({ i: String(i), ok, input: ok ? it.right : '—' }); }
            });
            if (ex.write && ex.write.prompt) { const text = SAMPLE_TEXT[Math.floor(r() * SAMPLE_TEXT.length)]; const id = 'W-' + (db.settings.nextW = (db.settings.nextW || 100) + 1);
              db.writings.push({ id, sid: s.id, key: si + '.' + ei, att: 1, task: { work: inst.id, type: inst.type, title: P.meta.title || '', lesson: P.meta.lesson || '', ex: ex.num || '', kind: ex.write.kind || 'writing', task: ex.write.prompt, min: ex.write.min, max: ex.write.max, words: P.words.map(c => c.w) }, text, ts, status: r() < (inst.w.week === W0 ? .35 : .92) ? 'checked' : 'new', fb: null });
              const W = db.writings[db.writings.length - 1]; if (W.status === 'checked') W.fb = { score: 5 + Math.floor(r() * 5), good: "Fikrlaringiz tushunarli, gaplar tartibli.", fix: [['I very like', 'I really like']], next: "Keyingi safar ko'proq yangi so'zlardan foydalaning.", words: [] };
              ev('write', { work: inst.id, att: 1, key: si + '.' + ei, wid: id, inputs: { w: text }, graded: false, ach: false }); return; }
            if (!total) { ev('ans', { work: inst.id, att: 1, key: si + '.' + ei, right: 0, wrong: 0, total: 0, graded: false, inputs, detail: [], ach: false }); return; }
            ev('ans', { work: inst.id, att: 1, key: si + '.' + ei, right, wrong, total, graded: true, inputs, detail: items, ach: inst.type !== 'weekly' });
          });
          // the word engine and the grammar engine parts: answers like a real session
          if (sec.gpack) for (let q = 0; q < 10; q++) ev('g', { gev: null, ok: r() < ab, rapid: false, work: inst.id, att: 1, part: si, ach: true });
          else if (School.HAS_VOCAB_ENGINE(P, sec) && sec.cards.length) sec.cards.forEach(c => { if (sec.kind === 'vocabulary') ev('meet', { wid: c.id, day: T.dayNum(ts), work: inst.id, att: 1, part: si });
            ['mc_meaning', 'mc_word'].forEach(fmt => ev('vocab', { wid: c.id, fmt, ok: r() < ab, rapid: false, day: T.dayNum(ts), input: '', work: inst.id, att: 1, part: si, ach: true })); });
          ev('part', { work: inst.id, att: 1, part: si });
        });
        ev('fin', { work: inst.id, att: 1 });
      });
      // earlier words were practised: meet them, then some answers on different days (so So'zlarim shows real stages)
      const wk1 = T.addWeeks(W0, -1); const cards = (School.wordWeeks(s).find(w => w.week === wk1) || { lessons: [] }).lessons.flatMap(l => l.cards);
      cards.forEach((c, ci) => { const d0 = T.dayNum(wk1) + Math.min(5, ci % 6); db.events.push({ id: uid('e'), sid: s.id, kind: 'meet', ts: wk1 + (ci % 6) * T.DAY + 15 * 3600e3, wid: c.id, day: d0 });
        const n = 1 + Math.floor(r() * 5); for (let j = 0; j < n; j++) { const day = Math.min(T.dayNum(now) - 1, d0 + j * 2); const fmt = ['mc_meaning', 'mc_word', 'mc_ctx', 'type_def', 'type_def'][Math.min(4, j)]; db.events.push({ id: uid('e'), sid: s.id, kind: 'vocab', ts: wk1 + (day - T.dayNum(wk1)) * T.DAY + 16 * 3600e3 + j, wid: c.id, fmt, ok: r() < ab, rapid: false, day, input: '', ach: true, sent: fmt === 'mc_ctx' ? 'seed' + j : null }); } });
      // a little Erkin mashq this week, so the leaderboard is alive
      const n = Math.floor(r() * 14); for (let i = 0; i < n; i++) db.events.push({ id: uid('e'), sid: s.id, kind: 'prac', ts: Math.max(W0, now - Math.floor(r() * 5 * T.DAY)), ref: 'sample', ok: r() < ab, ach: true });
    });
    db.events.sort((a, b) => a.ts - b.ts);
    // gold that the history earned goes into each castle wallet
    db.students.forEach(s => { const g = sum(db.events.filter(e => e.sid === s.id && e.kind === 'ans' && e.ach).map(e => e.right * 5)) + 120 * db.events.filter(e => e.sid === s.id && e.kind === 'fin' && ['homework', 'classwork'].includes((School.work(e.work) || {}).type)).length;
      const c = School.castleFresh(); c.gold = Math.min(g, 600); if (!Store.castleGet(s.id)) Store.castleSet(s.id, c); });
    Store._cache = {};
  }
  const SAMPLE_TEXT = [
    "For breakfast I eat bread and cheese and I drink tea. At school my snack is an apple. For lunch my mum makes plov or soup. In the evening we eat vegetables and some rice. I don't drink fizzy drinks because they aren't healthy. I very like home-made food.",
    "My healthy day starts with low-fat yoghurt and some fruit. I drink water at school. My favourite snack is nuts. For dinner I eat fish and salad with my family. My brother-in-law is a cook and he says vegetables are very important.",
    "I usually eat eggs for breakfast. For lunch I have a sandwich and some juice. After school I eat a snack, for example a banana. We have dinner at seven. I should eat more vegetables and less sugar.",
  ];
  return { build, history };
})();
