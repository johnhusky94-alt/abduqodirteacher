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

  const TRUE_WORDS = ["to'g'ri", "togri", "true", "ha", "yes", "+"];
  const FALSE_WORDS = ["noto'g'ri", "notogri", "false", "yo'q", "yoq", "no", "-"];

  function parse(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n");
    const quests = [];
    const errors = [];
    let q = null, circle = null, choice = null, body = null, passage = null;

    const err = (ln, msg) => errors.push({ line: ln, msg });
    const newQuest = (title, ln) => {
      q = { title: title || "Nomsiz vazifa", pool: "", circles: [], words: [], line: ln };
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
        switch (cmd) {
          case "week": case "settings": case "deadline": return; // accepted, unused here
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

      if (line.startsWith("?")) {
        closeChoice(); body = null;
        needCircle(ln);
        choice = { k: "choice", q: line.slice(1).trim(), opts: [], why: "", p: passage, line: ln };
        circle.items.push(choice);
        return;
      }
      if (line.startsWith("*") || line.startsWith("-")) {
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
        return err(ln, "Izoh (!) savoldan keyin kelishi kerak");
      }
      if (body) { body.text.push(line); return; }
      err(ln, "Tushunarsiz qator");
    });
    closeChoice();

    const built = quests.map((qq) => build(qq, errors));
    return { quests: built, errors };
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
        why: `${w.en} = ${w.uz}` + (w.ex ? `. Misol: ${w.ex}` : ""),
      };
    };
    const singleToken = (s) => /^[A-Za-z'-]{2,14}$/.test(s);

    q.circles.forEach((circle, c) => {
      const seen = [];
      let mixTurn = 0;
      circle.items.forEach((it) => {
        if (it.k === "rule") {
          steps.push({ id: id(), c, t: "card", title: it.title, body: it.text.join("\n").trim() });
        } else if (it.k === "reading") {
          const sid = id();
          passageIds.set(it, sid);
          steps.push({ id: sid, c, t: "read", title: it.title, text: it.text.join("\n").trim() });
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
            steps.push({ id: id(), c, t: "letters", uz: w.uz, L, a: [w.en], show: w.en, why: `"${w.uz}" = ${w.en}` });
          }
          if (w.ex && singleToken(w.en)) {
            const re = new RegExp("\\b(" + w.en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\w*)\\b", "i");
            const m = w.ex.match(re);
            if (m && m[1].toLowerCase() === w.en.toLowerCase()) {
              const i = m.index;
              steps.push({ id: id(), c, t: "gap", before: w.ex.slice(0, i).trim(), after: w.ex.slice(i + m[1].length).trim(),
                hint: w.uz, a: [m[1]], show: m[1], why: `${w.en} = ${w.uz}` });
            }
          }
          if (seen.length) {
            const pw = seen[mixTurn++ % seen.length];
            if (singleToken(pw.en)) {
              steps.push({ id: id(), c, t: "spell", uz: pw.uz, hint: pw.en[0], a: [pw.en], show: pw.en, why: `"${pw.uz}" = ${pw.en}` });
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
      title: q.title, pool: q.pool, line: q.line,
      circles: q.circles.map((c, i) => ({ name: c.name, n: steps.filter((s) => s.c === i && s.a).length })),
      steps, gradable,
    };
  }

  const api = { parse, norm };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QuestParser = api;
})(typeof window !== "undefined" ? window : this);
