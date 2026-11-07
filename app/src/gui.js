/* =====================================================================
   GRAMMAR ENGINE SCREENS: one renderer per question ui (13 kinds, 24 types).
   The engine builds questions as data; this file only draws them and
   collects the response object the engine expects.
   ===================================================================== */
const GUI = (() => {
  const segHTML = (segs, fill) => segs.map(s => s.gap != null ? (fill ? fill(s.gap) : '<span class="gapbox">&nbsp;</span>') : esc(s.t)).join('');
  function tlSVG(k) { let m = ''; if (k === 'dot') m = '<circle cx="84" cy="26" r="7" fill="currentColor"/>'; else if (k === 'span-now') m = '<circle cx="62" cy="26" r="6" fill="currentColor"/><rect x="62" y="22" width="134" height="8" rx="4" fill="currentColor"/>'; else if (k === 'life') m = '<line x1="22" y1="26" x2="194" y2="26" stroke="currentColor" stroke-width="3" stroke-dasharray="1 7" stroke-linecap="round"/>' + [70, 118, 160].map(x => `<path d="M${x - 5} 21l10 10M${x + 5} 21l-10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/>`).join(''); else m = '<circle cx="120" cy="26" r="7" fill="currentColor"/>';
    return `<svg viewBox="0 0 240 60" height="56" aria-hidden="true"><line x1="10" y1="26" x2="230" y2="26" stroke="currentColor" stroke-opacity=".4" stroke-width="2"/>${m}<line x1="196" y1="10" x2="196" y2="42" stroke="currentColor" stroke-width="2.5"/><text x="196" y="56" text-anchor="middle" font-size="10" font-weight="800" fill="currentColor">HOZIR</text><text x="12" y="56" font-size="10" font-weight="700" fill="currentColor" fill-opacity=".7">O'TMISH</text></svg>`; }
  function needsCheck(q) {
    const p = q.payload;
    switch (q.ui) { case 'tap': return !p.single && !p.need; case 'tiles': return !p.auto; case 'choice': case 'match': case 'rightwrong': case 'chain': return false; case 'fix': return true; default: return true; }
  }
  function render(q, cur, lock) {
    const p = q.payload, r = cur.resp, D = lock ? 'disabled' : '';
    switch (q.ui) {
      case 'choice': {
        let top = '';
        if (p.situation) top += `<div class="uzline">${esc(p.situation)}</div>`;
        if (p.sentence) top += `<div class="sent">${esc(p.sentence)}</div>`;
        if (p.segments && !p.inline) top += `<div class="sent">${segHTML(p.segments)}</div>`;
        const opt = o => o.tl ? `<span>${tlSVG(o.tl)}${o.caption ? `<span class="small" style="display:block">${esc(o.caption)}</span>` : ''}</span>` : esc(o.text);
        if (p.inline) return `<div class="sent">${segHTML(p.segments, () => p.options.map(o => `<button class="mini ${r.choice === o.id ? 'on' : ''}" data-act="gopt" data-id="${o.id}" ${D}>${esc(o.text)}</button>`).join(' / '))}</div>`;
        return top + `<div class="opts2">${p.options.map(o => `<button class="opt2 ${r.choice === o.id ? 'sel' : ''}" data-act="gopt" data-id="${o.id}" ${D}>${opt(o)}</button>`).join('')}</div>`;
      }
      case 'tap': { const sel = r.selected || []; return `<div class="sent">${p.tokens.map((t, i) => `<button class="tok ${sel.includes(i) ? 'on' : ''}" data-act="gtok" data-i="${i}" ${D}>${esc(t)}</button>`).join(' ')}</div>${p.need ? `<p class="small">${p.need} ta so'zni bosing.</p>` : ''}`; }
      case 'match': { const m = r.pairs || [], pk = r.pick;
        return `<div class="matchg">${p.left.map((l, i) => `<button class="opt2 ${pk === i ? 'pick' : ''}" style="grid-column:1;grid-row:${i + 1}" data-act="gml" data-i="${i}" ${m[i] != null ? `data-k="${i + 1}"` : ''} ${D}>${esc(l)}</button>`).join('')}
          ${p.right.map((x, j) => { const o = m.indexOf(j); return `<button class="opt2" style="grid-column:2;grid-row:${j + 1}" data-act="gmr" data-j="${j}" ${o >= 0 ? `data-k="${o + 1}"` : ''} ${D}>${esc(x)}</button>`; }).join('')}</div><p class="small">Avval boshini, keyin oxirini bosing.</p>`; }
      case 'selects': { const v = r.values || [];
        return `<div class="sent sm">${p.blocks.map(b => b.map(s => s.gap != null ? `<select class="selg" data-act-chg="gsel" data-g="${s.gap}" ${D}><option value="">…</option>${p.gaps[s.gap].options.map(o => `<option ${v[s.gap] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>` : esc(s.t)).join('')).join(' ')}</div>`; }
      case 'type': {
        let h = p.from ? `<p style="font-weight:650;opacity:.9">${esc(p.from)} →</p>` : '';
        h += `<div class="sent">${segHTML(p.segments, () => `<span class="gapbox">&nbsp;</span>${p.base ? ` <span style="opacity:.75">(${esc(p.base)})</span>` : ''}`)}</div>`;
        return h + `<input class="tin" data-gtext="1" value="${esc(r.text || '')}" placeholder="${esc(p.placeholder || '')}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Javob" ${D}>`; }
      case 'slots': { const v = r.values || []; let gi = 0; const used = new Set(v.map(x => x && x.c));
        return `<div style="display:grid;gap:8px">${p.sentences.map(sv => `<div class="sent sm">${sv.map(s => { if (s.gap == null) return esc(s.t); const k = gi++; return `<button class="mini ${v[k] ? 'on' : ''}" data-act="gslot" data-g="${k}" ${D}>${v[k] ? esc(v[k].t) : '&nbsp;&nbsp;&nbsp;&nbsp;'}</button>`; }).join('')}</div>`).join('')}</div>
          <div class="tpool">${p.chips.map((c, i) => used.has(i) ? '' : `<button class="gtile" data-act="gchip" data-i="${i}" ${D}>${esc(c)}</button>`).join('')}</div>`; }
      case 'tiles': { const line = r.line || [];
        return `${p.uz ? `<div class="uzline">${esc(p.uz)}</div>` : ''}${p.segments ? `<div class="sent">${segHTML(p.segments)}</div>` : ''}
          <div class="tline">${line.map((ti, k) => `<button class="gtile" data-act="gtout" data-k="${k}" ${D}>${esc(p.tiles[ti])}</button>`).join('')}</div>
          <div class="tpool">${p.tiles.map((t, i) => line.includes(i) ? '' : `<button class="gtile" data-act="gtin" data-i="${i}" ${D}>${esc(t)}</button>`).join('')}</div>${p.punct ? `<p class="small">Oxiri “${esc(p.punct)}” bilan tugaydi</p>` : ''}`; }
      case 'rightwrong': {
        if (r.verdict === 'wrong') return `<p class="small">Xato so'zni bosing:</p><div class="sent">${p.tokens.map((t, i) => `<button class="tok ${r.tapped === i ? 'on' : ''}" data-act="grwtap" data-i="${i}" ${D}>${esc(t)}</button>`).join(' ')}</div>`;
        return `<div class="sent">${esc(p.tokens.join(' '))}</div><div class="row"><button class="mini" data-act="grw" data-v="right" ${D}>To'g'ri</button><button class="mini" data-act="grw" data-v="wrong" ${D}>Noto'g'ri</button></div>`; }
      case 'fix': return `<div class="sent">${p.tokens.map((t, i) => `<button class="tok ${r.tapped === i ? 'on' : ''}" data-act="gfixtap" data-i="${i}" ${D}>${esc(t)}</button>`).join(' ')}</div>${r.tapped != null ? `<p class="small">Belgilangan qismning to'g'risini yozing:</p><input class="tin" data-gtext="1" value="${esc(r.text || '')}" autocomplete="off" autocapitalize="off" spellcheck="false" ${D}>` : '<p class="small">Avval xatoni bosing.</p>'}`;
      case 'sort': { const b = r.bins || []; return `<div style="display:grid;gap:8px">${p.rows.map((row, i) => `<div class="sortrow"><span style="font-weight:650">${esc(row)}</span><div class="row">${p.bins.map((x, j) => `<button class="mini ${b[i] === j ? 'on' : ''}" data-act="gbin" data-i="${i}" data-j="${j}" ${D}>${esc(x)}</button>`).join('')}</div></div>`).join('')}</div>`; }
      case 'pair': { const m = r.map || []; return `<div style="display:grid;gap:8px">${p.sentences.map((s, i) => `<div class="sortrow"><b>${'AB'[i]}. ${esc(s)}</b></div>`).join('')}${p.contexts.map((c, ci) => `<div class="sortrow"><span>${esc(c)}</span><div class="row">${p.sentences.map((_, si) => `<button class="mini ${m[ci] === si ? 'on' : ''}" data-act="gpair" data-c="${ci}" data-s="${si}" ${D}>${'AB'[si]} gap</button>`).join('')}</div></div>`).join('')}</div>`; }
      case 'dialog': { const v = r.values || [];
        return `<div style="display:flex;flex-direction:column;gap:8px">${p.turns.map(t => `<div class="bubble ${t.side === 'b' ? 'b' : ''}">${t.segments.map(s => { if (s.gap == null) return esc(s.t); const g = p.gaps[s.gap];
          return p.input === 'select' ? `<select class="selg" data-act-chg="gsel" data-g="${s.gap}" ${D}><option value="">…</option>${g.options.map(o => `<option ${v[s.gap] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
            : `<input class="selg" data-gdlg="${s.gap}" value="${esc(v[s.gap] || '')}" placeholder="${g.base ? '(' + esc(g.base) + ')' : ''}" size="12" autocomplete="off" autocapitalize="off" spellcheck="false" ${D}>`; }).join('')}</div>`).join('')}</div>`; }
      case 'chain': { const ch = r.choices || [];
        return p.steps.map((st, i) => i > ch.length ? '' : `<div style="display:grid;gap:6px;margin-bottom:8px"><div class="sent sm">${segHTML(st.segments, () => ch[i] ? `<span class="gapbox filled">${esc(st.options.find(o => o.id === ch[i]).text)}</span>` : '<span class="gapbox">&nbsp;</span>')}</div>${ch[i] ? '' : `<div class="row">${st.options.map(o => `<button class="mini" data-act="gchain" data-i="${i}" data-id="${o.id}" ${D}>${esc(o.text)}</button>`).join('')}</div>`}</div>`).join(''); }
    }
    return '<p>?</p>';
  }
  /* user interaction → updates cur.resp; returns 'submit' when the answer is complete by itself */
  function act(q, cur, d) {
    const p = q.payload, r = cur.resp;
    switch (d.act) {
      case 'gopt': r.choice = d.id; return 'submit';
      case 'gtok': { const i = +d.i; if (p.single) { r.selected = [i]; return 'submit'; } r.selected = r.selected || []; r.selected = r.selected.includes(i) ? r.selected.filter(x => x !== i) : [...r.selected, i]; if (p.need && r.selected.length === p.need) return 'submit'; return; }
      case 'gml': r.pick = +d.i; return;
      case 'gmr': { if (r.pick == null) return; r.pairs = r.pairs || Array(p.left.length).fill(null); const j = +d.j; r.pairs = r.pairs.map(x => x === j ? null : x); r.pairs[r.pick] = j; r.pick = null; if (r.pairs.every(x => x != null)) { cur.final = { pairs: r.pairs.slice() }; return 'submit'; } return; }
      case 'gslot': { r.values = r.values || []; r.values[+d.g] = null; return; }
      case 'gchip': { r.values = r.values || []; const n = sum(p.sentences.map(s => s.filter(x => x.gap != null).length)); for (let k = 0; k < n; k++) if (!r.values[k]) { r.values[k] = { t: p.chips[+d.i], c: +d.i }; break; } return; }
      case 'gtin': { r.line = r.line || []; r.line.push(+d.i); if (p.auto && r.line.length === p.auto) return 'submit'; return; }
      case 'gtout': { r.line.splice(+d.k, 1); return; }
      case 'grw': if (d.v === 'right') { r.verdict = 'right'; return 'submit'; } r.verdict = 'wrong'; return;
      case 'grwtap': r.tapped = +d.i; return 'submit';
      case 'gfixtap': r.tapped = +d.i; return;
      case 'gbin': { r.bins = r.bins || []; r.bins[+d.i] = +d.j; return; }
      case 'gpair': { r.map = r.map || []; r.map[+d.c] = +d.s; return; }
      case 'gchain': { r.choices = r.choices || []; r.choices[+d.i] = d.id; if (r.choices.length === p.steps.length && r.choices.every(Boolean)) return 'submit'; return; }
    }
  }
  /* the response object in the engine's shape */
  function response(q, cur) {
    const r = cur.resp;
    switch (q.ui) {
      case 'choice': return { choice: r.choice };
      case 'tap': return { selected: r.selected || [] };
      case 'match': return cur.final || { pairs: r.pairs || [] };
      case 'selects': return { values: (r.values || []).slice() };
      case 'type': return { text: r.text || '' };
      case 'slots': return { values: (r.values || []).map(x => x ? x.t : '') };
      case 'tiles': return { tiles: (r.line || []).map(i => q.payload.tiles[i]) };
      case 'rightwrong': return r.verdict === 'wrong' ? { verdict: 'wrong', tapped: r.tapped } : { verdict: 'right' };
      case 'fix': return { tapped: r.tapped, text: r.text || '' };
      case 'sort': return { bins: r.bins || [] };
      case 'pair': return { map: r.map || [] };
      case 'dialog': return { values: (r.values || []).slice() };
      case 'chain': return { choices: r.choices || [] };
    }
    return {};
  }
  return { render, act, response, needsCheck };
})();
