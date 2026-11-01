/* Castle game drawings (shared art from the approved demo). Exposes window.GameArt. */
(function () {
  "use strict";
  const now = () => Date.now();
  let S = { gold: 0, army: {}, queue: [] }, CAP = 400;
  const cap = () => CAP;
  const dur = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return d ? `${d} kun ${h} soat` : h ? `${h} soat ${m} daq` : m ? `${m} daq ${x} s` : `${x} s`; };

  function look(l){
  if (l<=2) return {k:"wood", c:"#b07a43", d:"#7a5229", roof:"#8a5a2b", trim:"#5a3a1c"};
  if (l<=5) return {k:"stone",c:"#bcc5d1", d:"#8e9bb0", roof:"#b5482f", trim:"#8e9bb0"};
  if (l<=8) return {k:"dark", c:"#7f8aa6", d:"#59607f", roof:"#2f5d9e", trim:"#ffc53d"};
  return {k:"royal",c:"#efe8d8", d:"#c9bfa6", roof:"#e0a514", trim:"#ffc53d"};
}
const LOOKNAME = {wood:"Yog'och", stone:"Tosh", dark:"Qora tosh", royal:"Shoh saroyi"};
function scene(b, opts){
  opts = opts || {};
  const dmg = opts.damaged, wl=b.wall, tl=b.tower, cl=b.castle, id = opts.id||"";
  const K = look(cl), W = look(wl), TW = look(tl);
  const wallH = 14 + wl*3, towerH = 44 + tl*7, keepH = 50 + cl*6, keepW = 58 + cl*4;
  const flagC = (opts.banner ? "#ffc53d" : opts.enemy ? "#ff5d6c" : "#4fb3ff");
  const cx = 200, gy = 168, kx = cx - keepW/2, ky = gy - keepH;
  let s = `<svg viewBox="0 -30 400 230" role="img" aria-label="${opts.enemy?"Dushman qal'asi":"Sizning qal'angiz"}">
  <defs><linearGradient id="sky${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${dmg?"#9aa7b6":"#7cc6ff"}"/><stop offset="1" stop-color="${dmg?"#c9cfd6":"#d9f0ff"}"/></linearGradient></defs>
  <rect y="-30" width="400" height="230" fill="url(#sky${id})"/>
  <circle cx="340" cy="38" r="16" fill="#fff6c9" opacity="${dmg?.3:.95}"/>
  <path d="M0 140 Q60 110 120 135 T250 128 T400 132 V200 H0z" fill="#6fbf73"/>
  <path d="M0 160 Q100 145 200 158 T400 155 V200 H0z" fill="#5aa95e"/>
  <rect y="${gy}" width="400" height="32" fill="#4f9a53"/>`;
  // outer towers (more towers at higher castle levels)
  const tx = [cx-keepW/2-26, cx+keepW/2+4];
  if (cl >= 4) tx.push(cx-keepW/2-62, cx+keepW/2+40);
  tx.forEach((x,i) => {
    const h = i >= 2 ? towerH*0.75 : towerH, ty = gy - h;
    s += `<rect x="${x}" y="${ty}" width="22" height="${h}" fill="${TW.c}" stroke="#0002"/>`;
    if (TW.k === "wood") for (let y=ty+6;y<gy;y+=7) s += `<line x1="${x}" y1="${y}" x2="${x+22}" y2="${y}" stroke="${TW.d}" stroke-width="1.2"/>`;
    else for (let j=0;j<3;j++) s += `<rect x="${x+j*8}" y="${ty-6}" width="6" height="6" fill="${TW.c}"/>`;
    s += `<path d="M${x-3} ${ty-(TW.k==="wood"?0:6)} l14 -${12+tl} 14 ${12+tl}z" fill="${TW.roof}"/>`;
    if (TW.k === "royal") s += `<circle cx="${x+11}" cy="${ty-20-tl}" r="2.5" fill="#fff6c9"/>`;
    s += `<rect x="${x+8}" y="${ty+12}" width="6" height="10" rx="3" fill="#2b3550"/>`;
    if (TW.k === "dark" || TW.k === "royal") s += `<rect x="${x}" y="${ty+2}" width="22" height="2" fill="${TW.trim}"/>`;
  });
  // keep
  if (K.k === "wood") {
    s += `<rect x="${kx}" y="${ky}" width="${keepW}" height="${keepH}" fill="${K.c}" stroke="#0003"/>`;
    for (let y=ky+7;y<gy;y+=8) s += `<line x1="${kx}" y1="${y}" x2="${kx+keepW}" y2="${y}" stroke="${K.d}" stroke-width="1.5"/>`;
    s += `<path d="M${kx-6} ${ky} L${cx} ${ky-26} L${kx+keepW+6} ${ky}z" fill="${K.roof}"/>`;
  } else {
    s += `<rect x="${kx}" y="${ky}" width="${keepW}" height="${keepH}" fill="${K.c}" stroke="#0002"/>`;
    for (let y=ky+10;y<gy;y+=10) s += `<line x1="${kx}" y1="${y}" x2="${kx+keepW}" y2="${y}" stroke="${K.d}" stroke-width=".8" opacity=".6"/>`;
    for (let i=0;i<Math.floor(keepW/12);i++) s += `<rect x="${kx+i*12+1}" y="${ky-8}" width="8" height="8" fill="${K.c}"/>`;
    if (cl >= 7) { // upper tier
      const uw = keepW*0.55, ux = cx-uw/2, uh = 26 + cl*2;
      s += `<rect x="${ux}" y="${ky-8-uh}" width="${uw}" height="${uh}" fill="${K.c}" stroke="#0002"/>`;
      s += K.k === "royal" ? `<path d="M${ux-2} ${ky-8-uh} q${uw/2+2} -${uw*0.7} ${uw+4} 0z" fill="${K.roof}"/>` : `<path d="M${ux-4} ${ky-8-uh} l${uw/2+4} -18 ${uw/2+4} 18z" fill="${K.roof}"/>`;
    }
    if (K.k !== "stone") s += `<rect x="${kx}" y="${ky+2}" width="${keepW}" height="3" fill="${K.trim}"/>`;
  }
  const topY = cl >= 7 ? ky - 8 - (26+cl*2) - (K.k==="royal"?keepW*0.38:18) : K.k==="wood" ? ky-26 : ky-8;
  s += `<path d="M${cx-11} ${gy} v-20 a11 11 0 0 1 22 0 v20z" fill="#5a3a1c"/>`;
  s += `<rect x="${cx-22}" y="${ky+14}" width="8" height="12" rx="4" fill="#2b3550"/><rect x="${cx+14}" y="${ky+14}" width="8" height="12" rx="4" fill="#2b3550"/>`;
  s += `<line x1="${cx}" y1="${topY}" x2="${cx}" y2="${topY-24}" stroke="#5a3a1c" stroke-width="2"/><path class="flagw" d="M${cx} ${topY-24} h18 l-4 6 4 6 h-18z" fill="${flagC}"/>`;
  // wall
  const wy = gy - wallH;
  const wallSeg = (x1,x2,top) => {
    if (W.k === "wood") { let p=""; for (let x=x1;x<x2;x+=7) p += `<path d="M${x} ${gy} V${top+5} l3.5 -6 3.5 6 V${gy}z" fill="${W.c}" stroke="${W.d}" stroke-width=".8"/>`; return p; }
    let p = `<rect x="${x1}" y="${top}" width="${x2-x1}" height="${gy-top}" fill="${W.c}" stroke="#0002"/>`;
    for (let x=x1;x<x2-6;x+=14) p += `<rect x="${x}" y="${top-6}" width="9" height="6" fill="${W.c}"/>`;
    if (W.k === "dark" || W.k === "royal") p += `<rect x="${x1}" y="${top}" width="${x2-x1}" height="2" fill="${W.trim}"/>`;
    return p;
  };
  if (dmg) {
    s += wallSeg(40,112,wy) + wallSeg(284,360,wy+6);
    s += `<g fill="#888">${[130,150,250,262].map((x,i)=>`<rect x="${x}" y="${gy-5-i%2*3}" width="${7+i}" height="5" transform="rotate(${i*17} ${x} ${gy})"/>`).join("")}</g>`;
    s += `<path d="M${cx-20} ${ky+4} l6 14 -4 8 6 12" stroke="#2229" stroke-width="2" fill="none"/>`;
    s += `<g class="smoke" fill="#555">${[[cx-10,ky-4,0],[cx+16,ky,0.7],[cx-40,gy-towerH,1.4]].map(([x,y,d])=>`<circle cx="${x}" cy="${y}" r="7" style="animation-delay:${d}s"/>`).join("")}</g>`;
  } else {
    s += wallSeg(40,cx-14,wy) + wallSeg(cx+14,360,wy);
    s += `<rect x="${cx-14}" y="${wy}" width="28" height="${wallH}" fill="#5a3a1c"/>`;
  }
  if (!opts.enemy) {
    // storage (right) shows how full it is
    const fill = Math.min(1, S.gold / cap()), SL = look(b.storage);
    s += `<rect x="350" y="${gy-30}" width="42" height="30" fill="${SL.k==="wood"?"#a86d32":SL.c}"/><path d="M346 ${gy-30} l25 -16 25 16z" fill="${SL.roof}"/>`;
    s += `<rect x="357" y="${gy-24}" width="28" height="22" fill="#5a3a1c"/><rect x="357" y="${gy-2-22*fill}" width="28" height="${22*fill}" fill="#ffc53d"/>`;
    s += `<text x="371" y="${gy+16}" text-anchor="middle" font-family="Lilita One,sans-serif" font-size="10" fill="#fff">Ombor ${b.storage}</text>`;
    // barracks + soldiers on the left
    const BL = look(b.barracks);
    if (BL.k === "wood") s += `<path d="M8 ${gy} l18 -28 18 28z" fill="#e0c9a6" stroke="#8a5a2b"/><path d="M22 ${gy} l4 -11 4 11z" fill="#5a3a1c"/>`;
    else s += `<rect x="6" y="${gy-26}" width="44" height="26" fill="${BL.c}" stroke="#0002"/><path d="M2 ${gy-26} l26 -14 26 14z" fill="${BL.roof}"/><rect x="22" y="${gy-14}" width="12" height="14" fill="#5a3a1c"/>`;
    s += `<text x="28" y="${gy+16}" text-anchor="middle" font-family="Lilita One,sans-serif" font-size="10" fill="#fff">Kazarma ${b.barracks}</text>`;
    const shown = [];
    ["spear","archer","cav","cat"].forEach(k => { for (let i=0;i<Math.min(S.army[k],3);i++) shown.push(k); });
    shown.slice(0,6).forEach((k,i) => { const w = k==="cav"||k==="cat" ? 22 : 15; s += `<use href="#t-${k}" x="${62+i*19}" y="${gy-4}" width="${w}" height="18"/>`; });
    // construction: scaffold + countdown over the building being upgraded
    const POS = {castle:[cx, topY-30], wall:[110, wy-10], tower:[tx[0]+11, gy-towerH-30], barracks:[28, gy-46], storage:[371, gy-52]};
    S.queue.forEach(q => {
      const [px,py] = POS[q.k];
      if (q.k === "castle" || q.k === "tower") s += `<g stroke="#8a5a2b" stroke-width="1.6"><line x1="${px-16}" y1="${py+26}" x2="${px-16}" y2="${gy}"/><line x1="${px+16}" y1="${py+26}" x2="${px+16}" y2="${gy}"/><line x1="${px-16}" y1="${py+50}" x2="${px+16}" y2="${py+50}"/></g>`;
      s += `<g><rect x="${px-34}" y="${py-6}" width="68" height="22" rx="11" fill="#14202ee6"/><use href="#hammer" x="${px-30}" y="${py-3}" width="16" height="16"/><text data-live="q:${q.k}" x="${px+6}" y="${py+10}" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="800" font-size="11" fill="#ffc53d">${dur(q.end-now())}</text></g>`;
    });
  }
  if (opts.shield) s += `<ellipse cx="${cx}" cy="${gy-30}" rx="190" ry="95" fill="#4fb3ff22" stroke="#4fb3ff88" stroke-width="2" stroke-dasharray="6 5"/>`;
  return s + `</svg>`;
}

function buildIcon(k){
  const m = {castle:`<rect x="12" y="20" width="28" height="26" fill="#9aa6b6"/><rect x="12" y="15" width="6" height="6" fill="#9aa6b6"/><rect x="23" y="15" width="6" height="6" fill="#9aa6b6"/><rect x="34" y="15" width="6" height="6" fill="#9aa6b6"/><path d="M22 46v-9a4 4 0 0 1 8 0v9z" fill="#5a3a1c"/><line x1="26" y1="15" x2="26" y2="4" stroke="#5a3a1c" stroke-width="2"/><path d="M26 4h10l-3 3 3 3H26z" fill="#4fb3ff"/>`,
    wall:`<rect x="4" y="24" width="44" height="22" fill="#9aa6b6"/>${[4,14,24,34,42].map(x=>`<rect x="${x}" y="18" width="6" height="6" fill="#9aa6b6"/>`).join("")}<path d="M4 31h44M4 38h44M15 24v7M30 24v7M22 31v7M38 31v7M12 38v8M28 38v8" stroke="#6f7c8f" stroke-width="1.2"/>`,
    tower:`<rect x="18" y="16" width="16" height="30" fill="#9aa6b6"/><path d="M15 16l11-12 11 12z" fill="#b5482f"/><rect x="24" y="22" width="4" height="8" fill="#2b3550"/><path d="M38 10l8 -2M38 14l9 1" stroke="#8a5a2b" stroke-width="2"/>`,
    barracks:`<path d="M6 46l20-34 20 34z" fill="#e0c9a6" stroke="#8a5a2b" stroke-width="1.5"/><path d="M21 46l5-13 5 13z" fill="#5a3a1c"/><line x1="26" y1="12" x2="26" y2="4" stroke="#5a3a1c" stroke-width="2"/><path d="M26 4h9l-3 3 3 3h-9z" fill="#ff5d6c"/>`,
    mine:`<path d="M4 46q0-30 22-30t22 30z" fill="#7a6a58"/><path d="M15 46q0-15 11-15t11 15z" fill="#2a2018"/><circle cx="22" cy="40" r="2" fill="#ffc53d"/><circle cx="30" cy="42" r="1.6" fill="#ffc53d"/><path d="M36 14l8-8M40 6l6 6" stroke="#9aa6b6" stroke-width="3"/>`,
    storage:`<rect x="8" y="22" width="36" height="24" fill="#a86d32"/><path d="M4 22l22-14 22 14z" fill="#7b241c"/><rect x="16" y="28" width="20" height="18" fill="#5a3a1c"/><circle cx="21" cy="40" r="4" fill="#ffc53d"/><circle cx="30" cy="41" r="4" fill="#ffc53d"/><circle cx="26" cy="35" r="4" fill="#ffc53d"/>`};
  return `<svg viewBox="0 0 52 52">${m[k]}</svg>`;
}

  const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <symbol id="coin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ffc53d" stroke="#b7860b" stroke-width="2"/><circle cx="12" cy="12" r="6" fill="none" stroke="#e0a514" stroke-width="1.5"/><path d="M10 8.5h3.2a2 2 0 0 1 0 4H10v-4zm0 4h3.6a2 2 0 0 1 0 4H10z" fill="#9a6b00"/></symbol>
    <symbol id="cup" viewBox="0 0 24 24"><path d="M7 3h10v6a5 5 0 0 1-10 0z" fill="#ffc53d" stroke="#b7860b" stroke-width="1.5"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" fill="none" stroke="#b7860b" stroke-width="1.5"/><rect x="10.5" y="13" width="3" height="4" fill="#b7860b"/><rect x="7" y="17" width="10" height="3" rx="1" fill="#8d5f00"/></symbol>
    <symbol id="sword" viewBox="0 0 24 24"><path d="M15 3h6v6L10 20l-6-6z" fill="#cfd8e3" stroke="#6b7c90" stroke-width="1.4"/><path d="M5 12l7 7M3 19l2 2" stroke="#8d5f00" stroke-width="3" stroke-linecap="round"/></symbol>
    <symbol id="star" viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor" stroke="#0004" stroke-width="1"/></symbol>
    <symbol id="shield" viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5.5-3.6 9.3-8 11-4.4-1.7-8-5.5-8-11V5z" fill="#4fb3ff" stroke="#1f6fae" stroke-width="1.5"/><path d="M8 12l3 3 5-6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></symbol>
    <symbol id="hammer" viewBox="0 0 24 24"><path d="M13 4l7 7-3 3-7-7z" fill="#9aa9bb"/><path d="M10 7L3 18l3 3 11-7" fill="#a86d32"/></symbol>
    <!-- troops: chunky figures, not stick men -->
    <symbol id="t-spear" viewBox="0 0 40 48"><ellipse cx="20" cy="46" rx="10" ry="2" fill="#0003"/><line x1="31" y1="4" x2="31" y2="44" stroke="#8a5a2b" stroke-width="2.5"/><path d="M31 1l3 7h-6z" fill="#dfe6ee"/><rect x="13" y="30" width="5" height="14" rx="2" fill="#4a3b2c"/><rect x="21" y="30" width="5" height="14" rx="2" fill="#4a3b2c"/><path d="M11 18q9-6 18 0v14H11z" fill="#c0392b"/><rect x="11" y="27" width="18" height="4" fill="#7b241c"/><circle cx="20" cy="13" r="7" fill="#f2c49b"/><path d="M12 12q8-11 16 0z" fill="#9aa9bb"/><rect x="19" y="5" width="2" height="5" fill="#9aa9bb"/><path d="M5 20h9v12q-4.5 4-9 0z" fill="#e8b84a" stroke="#8d5f00" stroke-width="1.2"/><circle cx="29" cy="24" r="3" fill="#f2c49b"/></symbol>
    <symbol id="t-archer" viewBox="0 0 40 48"><ellipse cx="20" cy="46" rx="10" ry="2" fill="#0003"/><rect x="13" y="30" width="5" height="14" rx="2" fill="#3d4a2c"/><rect x="21" y="30" width="5" height="14" rx="2" fill="#3d4a2c"/><path d="M11 18q9-6 18 0v14H11z" fill="#2e8b57"/><rect x="11" y="27" width="18" height="4" fill="#1e5a39"/><circle cx="20" cy="13" r="7" fill="#e8b48a"/><path d="M12 13q0-10 8-10t8 10l-3-2-5 2-5-2z" fill="#1e5a39"/><path d="M32 6q-9 16 0 32" fill="none" stroke="#8a5a2b" stroke-width="2.5"/><line x1="32" y1="6" x2="32" y2="38" stroke="#eee" stroke-width="1"/><circle cx="31" cy="22" r="3" fill="#e8b48a"/><rect x="6" y="15" width="5" height="14" rx="2" fill="#8a5a2b"/><path d="M7 15l1-4M10 15l1-4" stroke="#ddd" stroke-width="1.4"/></symbol>
    <symbol id="t-cav" viewBox="0 0 56 48"><ellipse cx="28" cy="46" rx="20" ry="2.5" fill="#0003"/><rect x="12" y="30" width="4" height="15" rx="2" fill="#6b4423"/><rect x="19" y="30" width="4" height="15" rx="2" fill="#6b4423"/><rect x="34" y="30" width="4" height="15" rx="2" fill="#6b4423"/><rect x="41" y="30" width="4" height="15" rx="2" fill="#6b4423"/><ellipse cx="28" cy="28" rx="19" ry="8" fill="#8b5a2b"/><path d="M42 26q6-12 12-10l-2 7-6 6z" fill="#8b5a2b"/><path d="M45 16l3-4 1 5z" fill="#5a3a1c"/><path d="M9 25q-6 2-6 10" stroke="#3a2512" stroke-width="3" fill="none"/><rect x="20" y="20" width="14" height="6" rx="2" fill="#2f5d9e"/><path d="M21 8q6-4 12 0v13H21z" fill="#2f5d9e"/><circle cx="27" cy="5" r="5" fill="#f0c098"/><path d="M21.5 4q5.5-8 11 0z" fill="#ffc53d"/><line x1="36" y1="2" x2="50" y2="22" stroke="#cfd8e3" stroke-width="2"/></symbol>
    <symbol id="t-cat" viewBox="0 0 56 48"><ellipse cx="28" cy="46" rx="22" ry="2.5" fill="#0003"/><rect x="6" y="30" width="44" height="6" rx="2" fill="#8a5a2b"/><path d="M14 30L26 14l12 16" fill="none" stroke="#6b4423" stroke-width="4"/><line x1="26" y1="22" x2="47" y2="4" stroke="#a86d32" stroke-width="4" stroke-linecap="round"/><path d="M43 0q8 0 7 8-7 2-9-4z" fill="#6b4423"/><circle cx="47" cy="3" r="4" fill="#7f8c9a"/><circle cx="14" cy="40" r="6" fill="#5a3a1c" stroke="#3a2512" stroke-width="2"/><circle cx="42" cy="40" r="6" fill="#5a3a1c" stroke="#3a2512" stroke-width="2"/><circle cx="14" cy="40" r="1.5" fill="#cfd8e3"/><circle cx="42" cy="40" r="1.5" fill="#cfd8e3"/></symbol>
  </defs></svg>`;
  window.GameArt = { look, LOOKNAME, scene, buildIcon, DEFS, dur,
    set(st) { S = st; CAP = st.cap || 400; } };
})();
