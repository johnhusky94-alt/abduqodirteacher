/* Quest script reader: turns pasted quest code into question steps.
   Works in the browser (window.QuestParser) and in Node (module.exports). */
(function (root) {
  "use strict";

  // Must match public._norm() in the database.
  function norm(t) {
    return String(t == null ? "" : t)
      .replace(/[’‘`ʻʼ]/g, "'")
      .replace(/\s+/g, " ")
      .replace(/[\s.!?,;:]+$/, "")
      .trim()
      .toLowerCase();
  }

  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // "text ! explanation" -> [text, explanation]
  function splitWhy(s) {
    const m = s.match(/^(.*?)\s+!\s+(.*)$/);
    return m ? [m[1].trim(), m[2].trim()] : [s.trim(), ""];
  }

  // "text ~ evidence" -> [text, evidence]
  function splitEv(s) {
    const m = s.match(/^(.*?)\s+~\s+(.*)$/);
    return m ? [m[1].trim(), m[2].trim()] : [s.trim(), ""];
  }
  const TFNG = { "true": "true", "t": "true", "to'g'ri": "true", "false": "false", "f": "false", "noto'g'ri": "false",
    "not given": "not given", "ng": "not given", "notgiven": "not given", "berilmagan": "not given" };

  const TRUE_WORDS = ["to'g'ri", "togri", "true", "ha", "yes", "+"];
  const FALSE_WORDS = ["noto'g'ri", "notogri", "false", "yo'q", "yoq", "no", "-"];

  function parse(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n");
    const quests = [];
    const errors = [];
    let q = null, circle = null, choice = null, body = null, passage = null, week = "", ielts = null, match = null;
    const DAYS = { mon: 1, monday: 1, du: 1, dushanba: 1, tue: 2, tuesday: 2, se: 2, seshanba: 2, wed: 3, wednesday: 3, chorshanba: 3,
      thu: 4, thursday: 4, pa: 4, payshanba: 4, fri: 5, friday: 5, juma: 5, sat: 6, saturday: 6, sh: 6, shanba: 6, sun: 7, sunday: 7, yakshanba: 7 };

    const err = (ln, msg) => errors.push({ line: ln, msg });
    const newQuest = (title, ln) => {
      q = { title: title || "Nomsiz vazifa", pool: "", circles: [], words: [], line: ln, kind: "hw", lesson: null, due: null };
      quests.push(q);
      circle = null; choice = null; body = null; passage = null;
    };
    const needCircle = (ln) => {
      if (!q) newQuest("Nomsiz vazifa", ln);
      if (!circle) { circle = { name: "Mashq", items: [] }; q.circles.push(circle); }
    };
    const closeChoice = () => {
      if (choice) {
        if (!choice.opts.some((o) => o.ok)) err(choice.line, "Savolda to'g'ri javob (*) yo'q");
        if (choice.opts.length < 2) err(choice.line, "Savolda kamida 2 ta variant bo'lishi kerak");
      }
      choice = null;
    };

    // finish a @match block: inside @ielts it becomes one sub-question per pair, elsewhere one step
    function closeMatch() {
      const m = match; match = null; if (!m) return;
      if (m.pairs.length < 2) { err(m.line, "@match da kamida 2 juftlik bo'lsin: chap = o'ng"); return; }
      const rights = m.pairs.map((x) => x.r);
      const opts = Array.from(new Set(rights.concat(m.extras)));
      if (m.ielts) m.ielts.qs.push(...m.pairs.map((x) => ({ type: "sel", q: x.l, opts, ans: [x.r], why: x.why, ev: x.ev, line: x.line, title: m.title })));
      else m.circle.items.push({ k: "match", title: m.title, pairs: m.pairs, opts, why: m.why || "", line: m.line });
    }
    lines.forEach((raw, idx) => {
      const ln = idx + 1;
      const line = raw.trim();
      if (!line) { if (body) body.text.push(""); return; }
      if (line.startsWith("#")) return;

      if (line.startsWith("@")) {
        closeChoice();
        body = null;
        const m = line.match(/^@(\w+)\s*(.*)$/);
        if (!m) return err(ln, "Noto'g'ri buyruq");
        const cmd = m[1].toLowerCase(), rest = m[2].trim();
        if (match && cmd !== "endmatch") closeMatch();
        if (ielts && !["tfng", "short", "endielts", "match", "endmatch"].includes(cmd)) ielts = null;
        switch (cmd) {
          case "settings": return; // accepted, unused here
          case "week": case "hafta":
            if (!/^\d{4}-\d{2}-\d{2}$/.test(rest)) return err(ln, "@week sanasi shunday yozilsin: 2026-11-02");
            week = rest; return;
          case "classwork": case "sinf": {
            if (!q) newQuest("Nomsiz vazifa", ln);
            const n = parseInt(rest, 10);
            if (!(n >= 1 && n <= 30)) return err(ln, "@classwork dan keyin dars raqami yozilsin: @classwork 3");
            q.kind = "cw"; q.lesson = n; return;
          }
          case "homework": case "uy": if (!q) newQuest("Nomsiz vazifa", ln); q.kind = "hw"; return;
          case "vocab": case "lugat": if (!q) newQuest("Lug'at", ln); q.kind = "vl"; q.noReview = true; return;
          case "noreview": if (!q) newQuest("Nomsiz vazifa", ln); q.noReview = true; return;
          case "due": case "muddat": case "deadline": {
            if (!q) newQuest("Nomsiz vazifa", ln);
            const m2 = rest.toLowerCase().match(/^(\S+)(?:\s+(\d{1,2}):(\d{2}))?$/);
            if (!m2) return err(ln, "Muddat shunday yozilsin: @due tue 08:00");
            const hh = m2[2] ? Number(m2[2]) : 8, mm = m2[3] ? Number(m2[3]) : 0;
            if (hh > 23 || mm > 59) return err(ln, "Vaqt noto'g'ri: " + rest);
            if (/^\d{4}-\d{2}-\d{2}$/.test(m2[1])) { q.due = { date: m2[1], h: hh, m: mm }; return; }
            if (!DAYS[m2[1]]) return err(ln, "Kun nomi tushunilmadi: " + m2[1] + " (mon, tue, wed, thu, fri, sat, sun)");
            q.due = { dow: DAYS[m2[1]], h: hh, m: mm }; return;
          }
          case "quest": return newQuest(rest, ln);
          case "pool": if (!q) newQuest("Nomsiz vazifa", ln); q.pool = rest; return;
          case "circle":
            if (!q) newQuest("Nomsiz vazifa", ln);
            circle = { name: rest || "Mashq", items: [] }; q.circles.push(circle); passage = null; return;
          case "rule": {
            needCircle(ln);
            body = { k: "rule", title: rest || "Qoida", text: [], line: ln };
            circle.items.push(body); return;
          }
          case "reading": {
            needCircle(ln);
            body = { k: "reading", title: rest || "O'qish", text: [], line: ln };
            circle.items.push(body); passage = body; return;
          }
          case "endreading": passage = null; return;
          case "ielts": {
            needCircle(ln);
            ielts = { k: "ielts", title: rest || "Reading", text: [], qs: [], line: ln };
            circle.items.push(ielts); body = ielts; return;
          }
          case "endielts": ielts = null; return;
          case "match": {
            if (!ielts) needCircle(ln);
            match = { title: rest || "Mosini toping", pairs: [], extras: [], line: ln, ielts, circle };
            return;
          }
          case "endmatch": closeMatch(); return;
          case "writing": case "yozish": {
            needCircle(ln);
            const [title, lim] = rest.split("|").map((x) => (x || "").trim());
            let min = 40, max = 150;
            if (lim) {
              const mm = lim.match(/^(\d+)\s*-\s*(\d+)$/);
              if (!mm) return err(ln, "So'z chegarasi shunday yozilsin: @writing Mavzu | 60-150");
              min = Number(mm[1]); max = Number(mm[2]);
              if (min < 1 || max > 300 || min >= max) return err(ln, "So'z chegarasi noto'g'ri (masalan 60-150, ko'pi bilan 300)");
            }
            body = { k: "write", title: title || "Yozma ish", text: [], min, max, line: ln };
            circle.items.push(body); return;
          }
          case "tfng": case "short": {
            if (!ielts) return err(ln, "@" + cmd + " faqat @ielts matnidan keyin yoziladi");
            const [m0, ev] = splitEv(rest);
            const [main, why] = splitWhy(m0);
            const eq = main.lastIndexOf("=");
            if (eq < 0) return err(ln, cmd === "tfng" ? "@tfng gap = true / false / not given" : "@short savol = javob");
            const qtext = main.slice(0, eq).trim(), raw = main.slice(eq + 1).trim();
            if (!qtext) return err(ln, "Savol matni bo'sh");
            if (cmd === "tfng") {
              const v = TFNG[norm(raw)];
              if (!v) return err(ln, "@tfng javobi: true, false yoki not given");
              ielts.qs.push({ type: "tfng", q: qtext, ans: [v], why, ev, line: ln });
            } else {
              const a = raw.split("/").map((x) => x.trim()).filter(Boolean);
              if (!a.length) return err(ln, "@short javobi bo'sh");
              if (a.some((x) => x.split(/\s+/).length > 3)) return err(ln, "@short javobi 3 so'zdan oshmasin");
              ielts.qs.push({ type: "short", q: qtext, ans: a, why, ev, line: ln });
            }
            return;
          }
          case "review": {
            if (!q) newQuest("Nomsiz vazifa", ln);
            const n = Math.max(1, Math.min(20, parseInt(rest, 10) || 6));
            circle = { name: "Takrorlash", items: [{ k: "review", n, line: ln }] };
            q.circles.push(circle); q.hasReview = true; passage = null; return;
          }
          case "word": {
            needCircle(ln);
            const [left, ex] = rest.split("|").map((s) => (s || "").trim());
            const eq = left.indexOf("=");
            if (eq < 0) return err(ln, "So'z qatori: @word english = o'zbekcha | misol gap");
            const w = { k: "word", en: left.slice(0, eq).trim(), uz: left.slice(eq + 1).trim(), ex: ex || "", line: ln };
            if (!w.en || !w.uz) return err(ln, "So'z yoki tarjimasi bo'sh");
            circle.items.push(w); q.words.push(w); return;
          }
          case "tf": {
            needCircle(ln);
            const [main, why] = splitWhy(rest);
            const eq = main.lastIndexOf("=");
            if (eq < 0) return err(ln, "@tf gap = to'g'ri yoki noto'g'ri");
            const ans = norm(main.slice(eq + 1));
            let val = null;
            if (TRUE_WORDS.includes(ans)) val = true; else if (FALSE_WORDS.includes(ans)) val = false;
            if (val === null) return err(ln, "@tf javobi to'g'ri yoki noto'g'ri bo'lishi kerak");
            circle.items.push({ k: "tf", s: main.slice(0, eq).trim(), val, why, p: passage, line: ln }); return;
          }
          case "gap": {
            needCircle(ln);
            const [main, why] = splitWhy(rest);
            const eq = main.lastIndexOf("=");
            if (eq < 0) return err(ln, "@gap gap ___ davomi = javob");
            const sent = main.slice(0, eq).trim();
            const parts = sent.split(/_{2,}/);
            if (parts.length !== 2) return err(ln, "@gap gapida bitta ___ bo'lishi kerak");
            const a = main.slice(eq + 1).split("/").map((s) => s.trim()).filter(Boolean);
            if (!a.length) return err(ln, "@gap javobi bo'sh");
            if (a.some((x) => /\s/.test(x))) return err(ln, "@gap javobi bitta so'z bo'lishi kerak");
            circle.items.push({ k: "gap", before: parts[0].trim(), after: parts[1].trim(), a, why, p: passage, line: ln }); return;
          }
          case "order": {
            needCircle(ln);
            const [main, why] = splitWhy(rest);
            const eq = main.lastIndexOf("=");
            const wordsPart = eq < 0 ? main : main.slice(0, eq);
            const uz = eq < 0 ? "" : main.slice(eq + 1).trim();
            const words = wordsPart.split("|").map((s) => s.trim()).filter(Boolean);
            if (words.length < 2) return err(ln, "@order kamida 2 bo'lak: She | is | reading");
            circle.items.push({ k: "order", words, uz, why, line: ln }); return;
          }
          default: return err(ln, "Noma'lum buyruq: @" + cmd);
        }
      }

      if (match) {
        if (line.startsWith("-")) { const t = line.slice(1).trim(); if (t) match.extras.push(t); return; }
        if (line.startsWith("!")) { const t = line.slice(1).trim(); if (match.pairs.length) match.pairs[match.pairs.length - 1].why = t; else match.why = t; return; }
        const [m0, ev] = splitEv(line);
        const [main, why] = splitWhy(m0);
        const eq = main.indexOf("=");
        if (eq < 0) return err(ln, "@match qatori: chap tomon = o'ng tomon");
        const l = main.slice(0, eq).trim(), r = main.slice(eq + 1).trim();
        if (!l || !r) return err(ln, "@match qatorida ikki tomon ham bo'lsin");
        if (r.includes("|")) return err(ln, "@match javobida | belgisi bo'lmasin");
        match.pairs.push({ l, r, why, ev, line: ln });
        return;
      }
      if (line.startsWith("?") && ielts) {
        closeChoice(); body = null;
        choice = { k: "choice", type: "mcq", q: line.slice(1).trim(), opts: [], why: "", ev: "", line: ln };
        ielts.qs.push(choice);
        return;
      }
      if (line.startsWith("~")) {
        const t = line.slice(1).trim();
        if (choice) { choice.ev = t; return; }
        if (ielts && ielts.qs.length) { ielts.qs[ielts.qs.length - 1].ev = t; return; }
        return err(ln, "Dalil (~) savoldan keyin kelishi kerak");
      }
      if (line.startsWith("?")) {
        closeChoice(); body = null;
        needCircle(ln);
        choice = { k: "choice", q: line.slice(1).trim(), opts: [], why: "", p: passage, line: ln };
        circle.items.push(choice);
        return;
      }
      if (line.startsWith("*") || line.startsWith("-")) {
        if (!choice && body) { body.text.push(line); return; }
        if (!choice) return err(ln, "Variantdan oldin ? savol bo'lishi kerak");
        const [t, why] = splitWhy(line.slice(1).trim());
        if (!t) return err(ln, "Variant bo'sh");
        choice.opts.push({ t, ok: line[0] === "*", why });
        return;
      }
      if (line.startsWith("!")) {
        const t = line.slice(1).trim();
        if (choice) { choice.why = t; return; }
        const last = circle && circle.items[circle.items.length - 1];
        if (last && ["tf", "gap", "order"].includes(last.k)) { last.why = t; return; }
        if (ielts && ielts.qs.length) { ielts.qs[ielts.qs.length - 1].why = t; return; }
        return err(ln, "Izoh (!) savoldan keyin kelishi kerak");
      }
      if (body) { body.text.push(line); return; }
      err(ln, "Tushunarsiz qator");
    });
    closeChoice();
    closeMatch();

    quests.forEach((qq) => {
      if (qq.hasReview || qq.noReview || !qq.circles.length) return;
      const rc = { name: "Takrorlash", items: [{ k: "review", n: 6 }] };
      const ri = qq.circles.findIndex((c) => c.items.some((it) => it.k === "reading" || it.k === "ielts"));
      if (ri >= 0) qq.circles.splice(ri, 0, rc); else qq.circles.push(rc);
    });
    const built = quests.map((qq) => build(qq, errors));
    return { quests: built, errors, week };
  }

  function build(q, errors) {
    const steps = [];
    let n = 0;
    const id = () => "s" + (++n);
    const allWords = q.words;
    const passageIds = new Map();

    const others = (w, key, k) => shuffle(allWords.filter((x) => norm(x[key]) !== norm(w[key])).map((x) => x[key])).slice(0, k);
    const wordChoice = (c, w, dir) => {
      const right = dir === "en" ? w.uz : w.en;
      const pool = others(w, dir === "en" ? "uz" : "en", 3);
      if (pool.length < 1) return null;
      return {
        id: id(), c, t: "choice",
        q: dir === "en" ? `"${w.en}" so'zining ma'nosi qaysi?` : `"${w.uz}" inglizcha qanday?`,
        opts: shuffle([right].concat(pool)), a: [right], show: right,
        why: `${w.en} = ${w.uz}` + (w.ex ? `. Misol: ${w.ex}` : ""), w: w.en,
      };
    };
    const singleToken = (s) => /^[A-Za-z'-]{2,14}$/.test(s);

    q.circles.forEach((circle, c) => {
      const seen = [];
      let mixTurn = 0;
      circle.items.forEach((it) => {
        if (it.k === "review") {
          for (let i = 0; i < it.n; i++) steps.push({ id: id(), c, t: "review", a: [] });
        } else if (it.k === "rule") {
          steps.push({ id: id(), c, t: "card", title: it.title, body: it.text.join("\n").trim() });
        } else if (it.k === "reading") {
          const sid = id();
          passageIds.set(it, sid);
          steps.push({ id: sid, c, t: "read", title: it.title, text: it.text.join("\n").trim() });
        } else if (it.k === "match") {
          const rights = it.pairs.map((x) => x.r);
          const why = it.pairs.filter((x) => x.why).map((x) => `${x.l} → ${x.r}: ${x.why}`).join(" ") || it.why;
          steps.push({ id: id(), c, t: "match", q: it.title, left: it.pairs.map((x) => x.l), opts: shuffle(it.opts),
            a: [rights.join(" | ")], show: it.pairs.map((x) => `${x.l} → ${x.r}`).join("; "), why });
        } else if (it.k === "write") {
          const prompt = it.text.join("\n").trim();
          if (!prompt) errors.push({ line: it.line, msg: "@writing topshirig'i (matni) bo'sh" });
          steps.push({ id: id(), c, t: "write", title: it.title, prompt, min: it.min, max: it.max, a: [] });
        } else if (it.k === "ielts") {
          const text = it.text.join("\n").trim(), low = text.toLowerCase();
          if (!text) errors.push({ line: it.line, msg: "@ielts matni bo'sh" });
          if (!it.qs.length) errors.push({ line: it.line, msg: "@ielts matnidan keyin savollar yo'q" });
          it.qs.forEach((x) => {
            if (x.type === "mcq" && !x.opts.some((o) => o.ok)) errors.push({ line: x.line, msg: "Savolda to'g'ri javob (*) yo'q" });
            if (x.ev && !low.includes(x.ev.toLowerCase())) errors.push({ line: x.line, msg: `Dalil matnda topilmadi: "${x.ev}"` });
          });
          steps.push({ id: id(), c, t: "ielts", title: it.title, text,
            qs: it.qs.map((x) => x.type === "mcq" ? { type: "mcq", q: x.q, opts: x.opts.map((o) => o.t) }
              : x.type === "sel" ? { type: "sel", q: x.q, opts: x.opts, title: x.title } : { type: x.type, q: x.q }),
            a: it.qs.map((x) => ({ ans: x.type === "mcq" ? x.opts.filter((o) => o.ok).map((o) => o.t) : x.ans, why: x.why || "", ev: x.ev || "" })) });
        } else if (it.k === "choice") {
          const right = it.opts.filter((o) => o.ok).map((o) => o.t);
          const whys = {};
          it.opts.forEach((o) => { if (!o.ok && o.why) whys[norm(o.t)] = o.why; });
          const s = { id: id(), c, t: "choice", q: it.q, opts: it.opts.map((o) => o.t), a: right, show: right[0], why: it.why };
          if (Object.keys(whys).length) s.whys = whys;
          if (it.p) s.p = passageIds.get(it.p);
          steps.push(s);
        } else if (it.k === "tf") {
          const right = it.val ? "To'g'ri" : "Noto'g'ri";
          const s = { id: id(), c, t: "tf", q: it.s, opts: ["To'g'ri", "Noto'g'ri"], a: [right], show: right, why: it.why };
          if (it.p) s.p = passageIds.get(it.p);
          steps.push(s);
        } else if (it.k === "gap") {
          const s = { id: id(), c, t: "gap", before: it.before, after: it.after, a: it.a, show: it.a[0], why: it.why };
          if (it.p) s.p = passageIds.get(it.p);
          steps.push(s);
        } else if (it.k === "order") {
          let w = shuffle(it.words);
          if (w.join("|") === it.words.join("|") && w.length > 1) w = w.slice(1).concat(w[0]);
          steps.push({ id: id(), c, t: "order", uz: it.uz, words: w, a: [it.words.join(" ")], show: it.words.join(" "), why: it.why });
        } else if (it.k === "word") {
          const w = it;
          // 1) introduce, 2) practise alone, 3) mix with an earlier word
          steps.push({ id: id(), c, t: "word", en: w.en, uz: w.uz, ex: w.ex });
          const a = wordChoice(c, w, "en"); if (a) steps.push(a);
          const b = wordChoice(c, w, "uz"); if (b) steps.push(b);
          if (singleToken(w.en)) {
            let L = shuffle(w.en.split(""));
            if (L.join("") === w.en && L.length > 1) L = L.slice(1).concat(L[0]);
            steps.push({ id: id(), c, t: "letters", uz: w.uz, L, a: [w.en], show: w.en, why: `"${w.uz}" = ${w.en}`, w: w.en });
          }
          if (w.ex && singleToken(w.en)) {
            const re = new RegExp("\\b(" + w.en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\w*)\\b", "i");
            const m = w.ex.match(re);
            if (m && m[1].toLowerCase() === w.en.toLowerCase()) {
              const i = m.index;
              steps.push({ id: id(), c, t: "gap", before: w.ex.slice(0, i).trim(), after: w.ex.slice(i + m[1].length).trim(),
                hint: w.uz, a: [m[1]], show: m[1], why: `${w.en} = ${w.uz}`, w: w.en });
            }
          }
          if (seen.length) {
            const pw = seen[mixTurn++ % seen.length];
            if (singleToken(pw.en)) {
              steps.push({ id: id(), c, t: "spell", uz: pw.uz, hint: pw.en[0], a: [pw.en], show: pw.en, why: `"${pw.uz}" = ${pw.en}`, w: pw.en });
            } else {
              const s = wordChoice(c, pw, "uz"); if (s) steps.push(s);
            }
          }
          seen.push(w);
        }
      });
    });

    const gradable = steps.filter((s) => s.a).length;
    if (!gradable) errors.push({ line: q.line, msg: `"${q.title}" vazifasida birorta savol yo'q` });
    return {
      title: q.title, pool: q.pool, line: q.line, kind: q.kind, lesson: q.lesson, due: q.kind === "hw" ? q.due : null,
      circles: q.circles.map((c, i) => ({ name: c.name, n: steps.filter((s) => s.c === i && s.a).length })),
      steps, gradable,
    };
  }

  const api = { parse, norm };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QuestParser = api;
})(typeof window !== "undefined" ? window : this);
