/* =====================================================================
   THE SPECIAL CODE (one format for the whole site)
   The parts were designed separately and some symbols meant different things:
     ?  choice (book/assign)            vs  misspellings (word arcade)
     =  match row "= a => b" (book)     vs  synonym (arcade) vs "word = translation" (assign/plans)
     >  open question (book)            vs  example sentence (arcade)
     !  solved example "!_" (book)      vs  opposite (arcade)
     ~  "also accepted" (book choice)   vs  look-alikes (arcade) vs distractor inside {…} (grammar)
     |  plain line (book)               vs  field separator (arcade word line, grammar item)
     #  heading inside a TEXT (book)    vs  #rule / #confuse (grammar pack)
     TEXT: one line (assign)            vs  TEXT: title + """ block (book)
   Rule that removes every clash: a line's meaning depends on the SECTION it is in.
     [words]                → word cards (arcade syntax) and short "word = translation" lines
     [vocabulary] [warmup] [review] of homework → short "word = translation" lines are word cards
     a section with #rule lines → grammar-engine pack (adaptive grammar)
     every other line inside a section → book exercise syntax (##, ?, _, =, >, |, SORT …)
     TEXT: is a block when the next line is """, otherwise the line itself is the passage.
   ===================================================================== */
const Code = (() => {
  const PARTS = {
    // homework (7 parts, fixed order on the wallet)
    warmup: { uz: "Takrorlash so'zlari", en: 'Warm-up words', c: '#12B39A', t: '#0C2340' },
    grammar: { uz: 'Grammatika darsi', en: 'Grammar lesson', c: '#2E46E8', t: '#fff' },
    reading: { uz: "O'qish", en: 'Reading', c: '#0B8F84', t: '#fff' },
    vocabulary: { uz: "Dars so'zlari", en: 'Lesson words', c: '#8B5CF6', t: '#fff' },
    writing: { uz: 'Yozish', en: 'Writing', c: '#FF6B57', t: '#2B1300' },
    practice: { uz: 'Grammatika mashqi', en: 'Grammar practice', c: '#E8337E', t: '#fff' },
    review: { uz: 'Yakuniy takrorlash', en: 'Review mix', c: '#FF9F1C', t: '#2B1700' },
    // classwork / tests (book sections)
    listening: { uz: "Tinglash o'rniga o'qish", en: 'Listening (as reading)', c: '#1769D4', t: '#fff' },
    speaking: { uz: "Gapirish o'rniga yozish", en: 'Speaking (as writing)', c: '#C81E68', t: '#fff' },
    lifeskills: { uz: "Hayotiy ko'nikmalar", en: 'Life skills', c: '#12B39A', t: '#0C2340' },
    exam: { uz: 'Imtihonga tayyorlov', en: 'Exam practice', c: '#5B2BD9', t: '#fff' },
    words: { uz: "So'zlar", en: 'Words (for So‘zlarim and games)', c: '#1E74E8', t: '#fff' },
  };
  const HW_ORDER = ['warmup', 'grammar', 'reading', 'vocabulary', 'writing', 'practice', 'review'];
  const CW_KINDS = ['vocabulary', 'reading', 'grammar', 'listening', 'speaking', 'writing', 'lifeskills', 'review', 'exam', 'warmup', 'practice'];
  const FROM = {
    listening: { uz: "Kitobda bu tinglash mashqi. Audio yo'q, shuning uchun o'sha suhbat yoki matnni o'qiysiz.", tag: "Tinglash → o'qish" },
    speaking: { uz: "Kitobda bu gapirish mashqi. Bu yerda javobingizni inglizcha yozasiz, o'qituvchi o'qiydi.", tag: 'Gapirish → yozish' },
    photo: { uz: "Kitobdagi rasmlar o'rniga qisqa ta'rif berilgan. Ta'rifni diqqat bilan o'qing.", tag: "Rasm → ta'rif" },
    pronunciation: { uz: "Kitobda bu talaffuz mashqi. Bu yerda so'zlarning bo'g'inini o'qib tanlaysiz.", tag: "Talaffuz → o'qish" },
  };
  const TYPES = ['homework', 'classwork', 'test', 'weekly', 'task'];
  const META = ['TYPE', 'LEVEL', 'BOOK', 'UNIT', 'PAGE', 'LESSON', 'TITLE', 'OPEN', 'DUE', 'TIME'];
  const EXD = ['FROM', 'HELP', 'BOX', 'CHOOSE', 'TEXT', 'SEE', 'CHART', 'COLUMNS', 'WORDS', 'MIN', 'MAX', 'KIND', 'PROMPT', 'ANSWER', 'EXAMPLE', 'EXTRA'];
  const splitBar = s => s.split('|').map(x => x.trim()).filter(x => x !== '');
  const GLINE = /^[A-Za-z0-9]+\s+[a-z][\w.-]*(\s+(text|dialog|chain))?\s+\|\s/;
  const SHORTWORD = /^([^=|>!~?+*@#_\[\]][^=|]*?)\s+=\s+([^=>].*)$/;

  function splitWorks(txt) { return String(txt).split(/^\s*={5,}\s*$/m).map(s => s.trim()).filter(Boolean); }

  function newEx(num, instr, line) { return { num, instr, items: [], texts: [], line, answer: 'one', box: null, choose: null, from: null, help: '', see: null, chart: null, columns: null, words: null, sort: null, write: null, example: '', extra: [] }; }

  function parse(src) {
    const R = { meta: {}, sections: [], errors: [], warnings: [], src: String(src) };
    const lines = String(src).replace(/\r/g, '').split('\n');
    let sec = null, ex = null;
    const err = (i, m) => R.errors.push({ line: i + 1, msg: m });
    const warn = (i, m) => R.warnings.push({ line: i + 1, msg: m });
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i], l = raw.trim();
      if (!l || l.startsWith('//')) continue;
      let m;
      if ((m = l.match(/^\[([A-Za-z]+)(?:\s+(\d+))?\]\s*(.*)$/))) {
        const k = m[1].toLowerCase();
        if (!PARTS[k]) { err(i, `Unknown section [${m[1]}]. Use one of: ${Object.keys(PARTS).join(', ')}`); sec = null; ex = null; continue; }
        sec = { kind: k, min: m[2] ? +m[2] : null, title: m[3] || '', help: '', ex: [], line: i + 1, wordSrc: [], short: [], gsrc: [] };
        R.sections.push(sec); ex = null; continue;
      }
      if (!sec) {
        if ((m = l.match(/^([A-Z]+):\s*(.*)$/)) && META.includes(m[1])) { R.meta[m[1].toLowerCase()] = m[2].trim(); continue; }
        err(i, 'This line is before the first [section]. Only TYPE, LEVEL, BOOK, UNIT, PAGE, LESSON, TITLE, OPEN, DUE and TIME go here.'); continue;
      }
      /* ---- [words]: word cards ---- */
      if (sec.kind === 'words') {
        if ((m = l.match(SHORTWORD)) && !l.includes('|')) { sec.short.push({ w: m[1].trim(), uz: m[2].trim(), line: i + 1 }); sec.wordSrc.push({ line: i + 1, text: `${m[1].trim()} | prep | ${m[2].trim()} | ${m[2].trim()}`, short: true }); continue; }
        sec.wordSrc.push({ line: i + 1, text: raw }); continue;
      }
      /* ---- grammar pack lines ---- */
      if (/^#(rule|confuse|tl|lesson|pack)\b/.test(l) || (GLINE.test(l) && l.includes('{'))) {
        if (!['grammar', 'practice', 'review', 'exam'].includes(sec.kind)) { err(i, `Grammar-engine lines (#rule, items with {…}) go in a [grammar] or [practice] section, not [${sec.kind}].`); continue; }
        sec.gsrc.push({ line: i + 1, text: l }); continue;
      }
      /* ---- short word lines in vocabulary parts ---- */
      if ((m = l.match(SHORTWORD)) && !ex && !l.includes('|') && ['vocabulary', 'warmup', 'review'].includes(sec.kind)) {
        sec.short.push({ w: m[1].trim(), uz: m[2].trim(), line: i + 1 }); continue;
      }
      /* ---- book exercises ---- */
      if ((m = l.match(/^##\s*(.*)$/))) {
        const t = m[1].trim(), nm = t.match(/^(\d+[a-z]?)[.)]?\s+(.*)$/);
        ex = newEx(nm ? nm[1] : '', nm ? nm[2] : t, i + 1); sec.ex.push(ex); continue;
      }
      if ((m = l.match(/^HELP:\s*(.*)$/)) && !ex) { sec.help = m[1].trim(); continue; }
      if (!ex) { ex = newEx('', '', i + 1); ex.implicit = true; sec.ex.push(ex); }
      if ((m = l.match(/^SORT\s+(.+?):\s*(.*)$/))) { ex.sort = ex.sort || []; ex.sort.push({ col: m[1].trim(), words: splitBar(m[2]) }); continue; }
      if ((m = l.match(/^([A-Z]+):\s*(.*)$/)) && EXD.includes(m[1])) {
        const k = m[1], v = m[2].trim();
        if (k === 'TEXT') {
          let j = i + 1; while (j < lines.length && !lines[j].trim()) j++;
          if (j < lines.length && lines[j].trim() === '"""') {
            const body = []; let k2 = j + 1, closed = false;
            for (; k2 < lines.length; k2++) { if (lines[k2].trim() === '"""') { closed = true; break; } body.push(lines[k2]); }
            if (!closed) { err(j, 'This passage is never closed. Add a line with """ after the text'); i = lines.length; continue; }
            ex.texts.push({ title: v, body: body.join('\n').trim() }); i = k2; continue;
          }
          if (!v) { err(i, 'TEXT: needs the passage on the same line, or a title followed by a """ block'); continue; }
          ex.texts.push({ title: '', body: v }); continue;
        }
        if (k === 'FROM') { const f = v.toLowerCase().split(/[\s,+]+/).filter(Boolean); f.forEach(x => { if (!FROM[x]) err(i, `FROM: ${x} is unknown. Use listening, speaking, photo or pronunciation`); }); ex.from = f.filter(x => FROM[x]); continue; }
        if (k === 'HELP') { ex.help = v; continue; }
        if (k === 'BOX') { ex.box = splitBar(v); continue; }
        if (k === 'CHOOSE') { ex.choose = splitBar(v); continue; }
        if (k === 'SEE') { ex.see = v; continue; }
        if (k === 'CHART') { ex.chart = splitBar(v).map(s => { const q = s.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*(#[0-9a-f]{3,8})?$/i); if (!q) { err(i, `CHART part "${s}" needs: label number #colour`); return null; } return { label: q[1], v: +q[2], c: q[3] || null }; }).filter(Boolean); continue; }
        if (k === 'COLUMNS') { ex.columns = splitBar(v); continue; }
        if (k === 'WORDS') { ex.words = splitBar(v); continue; }
        if (k === 'MIN' || k === 'MAX') { if (!/^\d+$/.test(v)) { err(i, `${k}: needs a number of words`); continue; } ex.write = ex.write || {}; ex.write[k.toLowerCase()] = +v; continue; }
        if (k === 'KIND') { ex.write = ex.write || {}; ex.write.kind = v; continue; }
        if (k === 'PROMPT') { ex.write = ex.write || {}; ex.write.prompt = v; continue; }
        if (k === 'ANSWER') { const a = v.toLowerCase().replace(/\s+/g, ' '); if (!['one', 'many', 'free', 'free many'].includes(a)) err(i, 'ANSWER: use one, many, free or free many'); ex.answer = a; continue; }
        if (k === 'EXAMPLE') { ex.example = v; continue; }
        if (k === 'EXTRA') { ex.extra.push(v); continue; }
      }
      let s = l, isEx = false;
      if (s.startsWith('!') && /^![?_=>]/.test(s)) { isEx = true; s = s.slice(1); }
      const c = s[0], body = s.slice(1).trim();
      if (c === '?') {
        const p = splitBar(body); const stem = p[0] || '', raw2 = p.slice(1);
        const opts = raw2.map(o => { const ok = o.endsWith('*') ? 2 : o.endsWith('~') ? 1 : 0; return { t: ok ? o.slice(0, -1).trim() : o, ok }; });
        if (opts.length < 2) { err(i, 'A ? question needs at least two options separated by |'); continue; }
        ex.items.push({ type: 'choice', stem, opts, example: isEx, line: i + 1 }); continue;
      }
      if (c === '_') {
        const segs = []; let last = 0, mm; const re = /\[([^\]]+)\]/g;
        while ((mm = re.exec(body))) { if (mm.index > last) segs.push({ t: body.slice(last, mm.index) }); segs.push({ gap: mm[1].split('/').map(x => x.trim()).filter(Boolean) }); last = re.lastIndex; }
        if (last < body.length) segs.push({ t: body.slice(last) });
        if (!segs.some(x => x.gap)) { err(i, 'A _ line needs the answer in [square brackets]'); continue; }
        ex.items.push({ type: 'gap', segs, example: isEx, line: i + 1 }); continue;
      }
      if (c === '=') {
        const q = body.split('=>'); if (q.length !== 2 || !q[0].trim() || !q[1].trim()) { err(i, 'A match line looks like: = left side => right side'); continue; }
        ex.items.push({ type: 'match', left: q[0].trim(), right: q[1].trim(), example: isEx, line: i + 1 }); continue;
      }
      if (c === '>') { if (!body) { err(i, 'A > line needs a question'); continue; } ex.items.push({ type: 'open', q: body, line: i + 1 }); continue; }
      if (c === '|') { ex.items.push({ type: 'line', t: body, line: i + 1 }); continue; }
      if (SHORTWORD.test(l)) { err(i, `"word = translation" lines go in [vocabulary], [warmup], [review] of homework or in a [words] section.`); continue; }
      err(i, `I don't understand this line. Lines start with ##, ?, _, =, >, | or a word like HELP: — "${l.slice(0, 40)}"`);
    }
    finish(R);
    return R;
  }

  /* words, grammar packs, then the checks */
  function finish(R) {
    const t = (R.meta.type || '').toLowerCase(); R.type = t;
    const level = (R.meta.level || 'A2').toUpperCase();
    R.words = []; R.blocks = { groups: [], scales: [], sorts: [], stories: [], parts: { parts: {}, words: [] } }; R.confuse = [];
    R.sections.forEach((sec, si) => {
      sec.cards = [];
      // short lines in vocabulary parts
      if (sec.kind !== 'words') sec.short.forEach(s => sec.cards.push(simpleCard(s.w, s.uz, s.line)));
      if (sec.kind === 'words' && sec.wordSrc.length) {
        const head = `## words\nlevel ${['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level) ? level : 'A2'}\n`;
        const off = sec.wordSrc[0].line - 3;
        // keep line numbers: rebuild the text with blank lines so WC's line n maps back
        const arr = []; sec.wordSrc.forEach(w => { arr[w.line - 1 - off] = w.text; });
        const text = head + Array.from(arr, x => x == null ? '' : x).slice(2).join('\n');
        const h = WC.parse(text);
        const lineOf = ln => ln > 0 ? ln + off : sec.line;
        h.errors.forEach(e => { if (/needs at least 4 words|Add a title|Add a level/.test(e.m)) return; R.errors.push({ line: lineOf(e.ln), msg: e.m }); });
        h.warnings.forEach(e => { if (/has no sentence/.test(e.m)) return; R.warnings.push({ line: lineOf(e.ln), msg: e.m }); });
        const shortSet = new Set(sec.wordSrc.filter(w => w.short).map(w => w.text.split('|')[0].trim().toLowerCase()));
        h.cards.forEach(c => { if (shortSet.has(c.w.toLowerCase())) { c.p = 'other'; c.en = ''; } c.uz = N.uzFix(c.uz); c.ln = lineOf(c.ln); sec.cards.push(c); });
        ['groups', 'scales', 'sorts', 'stories'].forEach(k => R.blocks[k].push(...h.blocks[k].filter(x => !x.auto)));
        Object.assign(R.blocks.parts.parts, h.blocks.parts.parts); R.blocks.parts.words.push(...h.blocks.parts.words);
        R.confuse.push(...h.confuse);
      }
      // a word may be written in [words] (full card for So'zlarim and games) AND in a vocabulary part (which words the engine practises):
      // that is one word, so the two are merged into the richer card. Twice in the same kind of section is a mistake.
      sec.cards = sec.cards.map(c => {
        c.sec = si; const i = R.words.findIndex(x => x.id === c.id); if (i < 0) { R.words.push(c); return c; }
        const o = R.words[i], oKind = R.sections[o.sec].kind;
        if ((oKind === 'words') === (sec.kind === 'words')) { R.errors.push({ line: c.ln, msg: `"${c.w}" is already in this work (line ${o.ln}).` }); return c; }
        const rich = oKind === 'words' ? o : c, plain = rich === o ? c : o;
        if (!rich.uz && plain.uz) rich.uz = plain.uz;
        R.words[i] = rich; if (rich === c) R.sections[o.sec].cards = R.sections[o.sec].cards.map(x => x === o ? c : x);
        return rich;
      });
      // grammar pack
      sec.gpack = null;
      if (sec.gsrc.length) {
        const P = G.parsePack('#pack ' + (R.meta.title ? idOf(R.meta.title) : 'pack') + '-' + si + ' | ' + (R.meta.title || '') + '\n' + sec.gsrc.map(x => x.text).join('\n'));
        P.errors.forEach(e => R.errors.push({ line: e.line > 1 ? sec.gsrc[e.line - 2].line : sec.line, msg: e.msg }));
        sec.gpack = P; sec.gpackSrc = sec.gsrc.map(x => x.text).join('\n');
      }
    });
    validate(R);
    R.errors.sort((a, b) => a.line - b.line);
    R.ok = !R.errors.length;
    return R;
  }
  const idOf = w => String(w).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function simpleCard(w, uz, ln) { return { id: idOf(w), w, p: 'other', en: '', uz: N.uzFix(uz), d: N.uzFix(uz), sentences: [], ant: '', syn: '', confuse: [], sp: [], alt: [], diff: w.replace(/[^a-z]/gi, '').length <= 5 ? 1 : w.length <= 8 ? 2 : 3, ln, s: '', f: w }; }

  function validate(R) {
    const E = (line, msg) => R.errors.push({ line, msg }), W = (line, msg) => R.warnings.push({ line, msg });
    const t = R.type;
    if (!TYPES.includes(t)) E(1, 'TYPE must be homework, classwork, test, weekly or task');
    if (!R.meta.title) W(1, 'TITLE: is missing');
    if (!/^(A1|A2|B1|B2|C1|C2)$/i.test(R.meta.level || '')) E(1, 'LEVEL must be A1, A2, B1, B2, C1 or C2');
    if ((t === 'homework' || t === 'classwork') && !/^\d+$/.test(R.meta.lesson || '')) E(1, 'LESSON must be the lesson number of the week, e.g. LESSON: 3');
    if (t === 'weekly' && !/^\d+$/.test(R.meta.time || '')) E(1, 'A weekly test needs TIME: minutes for its timer, e.g. TIME: 30');
    if (t === 'test' && !/^\d+$/.test(R.meta.open || '')) E(1, 'A test needs OPEN: how many minutes it stays open, e.g. OPEN: 40');
    if (t === 'test' && R.meta.time && !/^\d+$/.test(R.meta.time)) E(1, 'TIME: must be a number of minutes');
    if (t === 'task' && !/^\d+$/.test(R.meta.due || '')) E(1, 'A task needs DUE: how many days it stays open, e.g. DUE: 3');
    const work = R.sections.filter(s => s.kind !== 'words');
    if (!work.length) E(1, 'No sections found. Start one with a line like [grammar 15]');
    if (t === 'homework') {
      const seen = {};
      work.forEach(s => { if (!HW_ORDER.includes(s.kind)) E(s.line, `Homework parts are ${HW_ORDER.map(k => '[' + k + ']').join(' ')}. [${s.kind}] is not one of them.`); if (seen[s.kind]) E(s.line, `[${s.kind}] appears twice. Each homework part comes once.`); seen[s.kind] = 1; });
      const miss = HW_ORDER.filter(k => !seen[k]); if (miss.length) W(1, `Missing homework parts: ${miss.join(', ')}. Students see only the parts you write.`);
    }
    if (t === 'classwork') {
      work.forEach(s => { if (!CW_KINDS.includes(s.kind)) E(s.line, `[${s.kind}] can't be a classwork section.`); if (!s.min) E(s.line, `[${s.kind}] in classwork needs its minutes, e.g. [${s.kind} 15]`); });
      const tot = sum(work.map(s => s.min || 0)); if (tot > 45) W(work[0] ? work[0].line : 1, `Sections add up to ${tot} minutes. They must fit the lesson length (checked when you assign).`);
    }
    if (t === 'task') {
      work.forEach(s => { if (!['reading', 'writing'].includes(s.kind)) E(s.line, `A task can only have [reading] and [writing] sections, not [${s.kind}]`); });
      work.filter(s => s.kind === 'reading').forEach(s => { if (!s.ex.some(e => e.texts.length)) E(s.line, '[reading] in a task needs a TEXT:'); });
    }
    if (t === 'weekly' || t === 'test') work.forEach(s => { if (s.ex.some(e => e.write || e.items.some(i => i.type === 'open'))) W(s.line, 'Writing in a test is sent to the Writing page and is not part of the test score.'); });
    R.sections.forEach(p => {
      const nums = {};
      if (p.kind !== 'words' && !p.ex.length && !p.gpack && !p.cards.length && !(t === 'homework' && ['warmup', 'review'].includes(p.kind))) E(p.line, `[${p.kind}] has nothing in it.`);
      if (p.gpack && t === 'weekly') E(p.line, 'The weekly test is one attempt, so it cannot use the adaptive grammar engine. Write ? and _ items instead.');
      if (p.cards.length && ['test', 'weekly'].includes(t) && p.kind !== 'words') E(p.line, 'Tests cannot use "word = translation" lines. Write the questions with ? or _.');
      p.ex.forEach(ex => {
        if (ex.num) { if (nums[ex.num]) W(ex.line, `Exercise ${ex.num} appears twice`); nums[ex.num] = 1; }
        const graded = ex.items.filter(x => x.type !== 'line');
        const has = ex.texts.length || ex.chart || (ex.write && ex.write.prompt) || ex.sort || ex.columns;
        if (!graded.length && !has) E(ex.line, `Exercise ${ex.num || ex.instr.slice(0, 30) || '(no number)'} has nothing to do or read`);
        const free = ex.answer.startsWith('free');
        ex.items.forEach(it => {
          if (it.type === 'choice') { const n = it.opts.filter(o => o.ok === 2).length; if (!free && !n) E(it.line, 'No correct answer: mark it with * after the option (or add ANSWER: free for opinion questions)'); if (free && n) W(it.line, 'This exercise is ANSWER: free, so the * is ignored'); }
          if (it.type === 'gap' && ex.choose) { const set = ex.choose.map(N.key); it.segs.filter(s => s.gap).forEach(s => { if (!s.gap.some(a => set.includes(N.key(a)))) E(it.line, `"${s.gap[0]}" is not in the CHOOSE: list`); }); }
          if (N.hasCyr(JSON.stringify(it))) E(it.line, 'Cyrillic letters found. Switch the keyboard to Latin and retype this line.');
        });
        if (ex.items.some(x => x.type === 'match') && ex.items.filter(x => x.type === 'match').length < 2) E(ex.line, 'A matching exercise needs at least two = lines');
        if (ex.columns && !ex.words) E(ex.line, 'COLUMNS: needs a WORDS: line with the words to sort');
        if (ex.sort && ex.sort.length < 2) E(ex.line, 'A graded sort needs at least two SORT lines');
        if (ex.write) { if (!ex.write.prompt) E(ex.line, 'Writing needs PROMPT:'); if (ex.write.min == null || ex.write.max == null) E(ex.line, 'Writing needs MIN: and MAX: word counts'); else if (ex.write.min > ex.write.max) E(ex.line, 'MIN is bigger than MAX'); }
        if (ex.see && !R.sections.some(pp => pp.ex.some(e => e.num === ex.see && e.texts.length))) E(ex.line, `SEE: ${ex.see} — there is no exercise ${ex.see} with a TEXT in this work`);
      });
      if (p.gpack) { const res = G.validatePack(p.gpack, null); res.filter(r => r.level === 'fail').forEach(r => E(p.line, 'Grammar: ' + r.msg)); }
    });
  }

  /* grading of one book item. resp: choice → [indexes]; gap → [strings]; match → right text. ok: true | false | null (no answer) */
  function isMulti(it, ex) { if (ex && ex.answer.endsWith('many')) return true; return it.opts.filter(o => o.ok === 2).length > 1 || it.opts.some(o => o.ok === 1); }
  function prevOf(segs, k) { let g = -1; for (let i = 0; i < segs.length; i++) { if (segs[i].gap) { g++; if (g === k) { const p = segs[i - 1]; if (!p || !/\s$/.test(p.t)) return null; return p.t.trim().split(/\s+/).slice(-3).join(' '); } } } return null; }
  function gradeItem(it, resp, ex) {
    if (it.type === 'choice') {
      const sel = resp || []; if (!sel.length) return { ok: null };
      const need = it.opts.map((o, i) => o.ok === 2 ? i : -1).filter(i => i >= 0), may = it.opts.map((o, i) => o.ok ? i : -1).filter(i => i >= 0);
      if (!isMulti(it, ex)) return { ok: need.includes(sel[0]) };
      return { ok: need.every(i => sel.includes(i)) && sel.every(i => may.includes(i)) };
    }
    if (it.type === 'gap') {
      const gaps = it.segs.filter(s => s.gap), r = resp || [];
      const each = gaps.map((g, k) => !r[k] || !String(r[k]).trim() ? null : N.check(r[k], g.gap, { prev: ex && ex.choose ? null : prevOf(it.segs, k) }).ok);
      return { ok: each.every(x => x === true) ? true : each.every(x => x === null) ? null : false, each };
    }
    if (it.type === 'match') { if (resp == null || resp === '') return { ok: null }; return { ok: resp === it.right }; }
    return { ok: null };
  }
  function points(ex) {
    if (ex.answer.startsWith('free')) return 0;
    let n = 0; ex.items.forEach(it => { if (it.example) return; if (it.type === 'choice' || it.type === 'match') n++; if (it.type === 'gap') n += it.segs.filter(s => s.gap).length; });
    if (ex.sort) n += sum(ex.sort.map(c => c.words.length));
    return n;
  }
  function autoHelp(ex) {
    const t = new Set(ex.items.map(i => i.type)), out = [];
    if (ex.texts.length) out.push("Matnni diqqat bilan o'qing.");
    if (t.has('choice')) out.push(ex.answer.startsWith('free') ? "Bu yerda to'g'ri yoki noto'g'ri javob yo'q. O'zingizga mosini tanlang." : ex.items.some(i => i.type === 'choice' && isMulti(i, ex)) ? "Bir nechta javob to'g'ri bo'lishi mumkin. Hammasini tanlang." : "Har bir savolga to'g'ri javobni tanlang.");
    if (t.has('gap')) out.push(ex.choose ? "Har bir bo'sh joy uchun ro'yxatdan mos javobni tanlang." : ex.box ? "Bo'sh joyga inglizcha yozing. Qutidagi so'zni bossangiz, u tanlangan bo'sh joyga tushadi." : "Bo'sh joyga inglizcha yozing. Chiziqchali so'zlarda chiziqcha o'zi qo'yilgan.");
    if (t.has('match')) out.push("Har bir qator uchun ro'yxatdan mos javobni tanlang." + (ex.extra.length ? ' Bittasi ortiqcha.' : ''));
    if (ex.sort || ex.columns) out.push("Har bir so'z uchun mos ustunni tanlang.");
    if (t.has('open') || ex.write) out.push("Javobingizni inglizcha yozing va o'qituvchiga yuboring.");
    return out.join(' ') || "Matnni o'qing.";
  }

  /* ---------------- lesson plans ---------------- */
  function parsePlans(txt, maxN) {
    const out = [], errors = []; let cur = null, sec = null;
    String(txt).replace(/\r/g, '').split('\n').forEach((raw, i) => {
      const l = raw.trim(); if (!l || l.startsWith('//')) return;
      let m = l.match(/^LESSON:\s*(\d+)$/i);
      if (m) { const n = +m[1]; if (n < 1 || n > maxN) errors.push(`Line ${i + 1}: this class has ${maxN} lessons a week, so there is no lesson ${n}`); if (out.some(p => p.n === n)) errors.push(`Line ${i + 1}: lesson ${n} appears twice`); cur = { n, title: '', goal: '', steps: [], words: [] }; out.push(cur); sec = null; return; }
      if (!cur) { errors.push(`Line ${i + 1}: start with LESSON: number`); return; }
      m = l.match(/^(TITLE|GOAL):\s*(.+)$/i); if (m) { cur[m[1].toLowerCase()] = m[2]; return; }
      m = l.match(/^\[(\w+)\]$/); if (m) { sec = m[1].toLowerCase(); if (!['steps', 'words'].includes(sec)) { errors.push(`Line ${i + 1}: unknown section [${m[1]}], use [steps] or [words]`); sec = null; } return; }
      if (sec === 'steps') { cur.steps.push(l.replace(/^(-|\d+[.)])\s*/, '')); return; }
      if (sec === 'words') { const w = l.split(/\s+=\s+/).map(x => x.trim()); if (w.length !== 2 || !w[0] || !w[1]) errors.push(`Line ${i + 1}: write words as word = translation`); else cur.words.push([w[0], N.uzFix(w[1])]); return; }
      errors.push(`Line ${i + 1}: this line is outside [steps] or [words]`);
    });
    out.forEach(p => { if (!p.title) errors.push(`Lesson ${p.n}: missing TITLE`); });
    if (!out.length && !errors.length) errors.push('No lessons found. Start each plan with LESSON: number');
    return { plans: out, errors };
  }

  return { PARTS, HW_ORDER, CW_KINDS, FROM, TYPES, parse, splitWorks, gradeItem, isMulti, points, autoHelp, parsePlans, idOf, prevOf };
})();
