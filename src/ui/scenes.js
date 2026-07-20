// ui/scenes.js — סצנות SVG ברוח מסכי המקור (STORM.WIN, PIRATES.WIN, THIEVES.SCR...)
// סגנון "משולב": צורות שטוחות מודרניות, קומפוזיציות נאמנות לצילומי המסך המקוריים.

// ---------- אבני בניין ----------

/** ספינת מפרש בצד — ברוח הספינה מ-INTRO.SCR. */
export function ship(x, y, s, { hull = '#7a4a1d', sail = '#2e9e4f', sail2 = '#c0392b', flip = false, tilt = 0 } = {}) {
  return `<g transform="translate(${x},${y}) rotate(${tilt}) scale(${flip ? -s : s},${s})">
    <path d="M-52,0 L52,0 L38,16 Q0,24 -38,16 Z" fill="${hull}"/>
    <rect x="-46" y="-6" width="92" height="7" fill="${shade(hull, -18)}"/>
    <circle cx="-30" cy="-2.5" r="2" fill="#ffd76a"/><circle cx="-10" cy="-2.5" r="2" fill="#ffd76a"/>
    <circle cx="10" cy="-2.5" r="2" fill="#ffd76a"/><circle cx="30" cy="-2.5" r="2" fill="#ffd76a"/>
    <rect x="-16" y="-58" width="3" height="52" fill="#4a2c10"/>
    <rect x="18" y="-48" width="3" height="42" fill="#4a2c10"/>
    <path d="M-14,-56 Q8,-46 -14,-16 Z" fill="${sail}"/>
    <path d="M-16,-52 Q-34,-40 -16,-18 Z" fill="${shade(sail, -12)}"/>
    <path d="M20,-46 Q38,-34 20,-12 Z" fill="${sail2}"/>
    <path d="M-16,-58 L-2,-54 L-16,-50 Z" fill="#c0392b"/>
  </g>`;
}

/** גלים — שורת קשתות. */
export function waves(y, color, width = 400, amp = 5, step = 26) {
  let d = `M0,${y}`;
  for (let x = 0; x < width + step; x += step) d += ` q${step / 2},-${amp * 2} ${step},0`;
  return `<path d="${d} L${width},${y + 60} L0,${y + 60} Z" fill="${color}"/>`;
}

function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + pct / 100))));
  const [r, g, b] = [f(n >> 16), f((n >> 8) & 255), f(n & 255)];
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const SKY = { day: ['#8ec9e8', '#c8e6f5'], dusk: ['#3a4a7a', '#c98a2d'], night: ['#141c3a', '#2a3a6a'], storm: ['#3d4654', '#5a6678'] };

function frame(inner, mood = 'day', extra = '') {
  const [top, bot] = SKY[mood];
  return `<svg viewBox="0 0 400 170" xmlns="http://www.w3.org/2000/svg" class="scene" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="sky-${mood}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient></defs>
    <rect width="400" height="170" fill="url(#sky-${mood})"/>
    ${extra}${inner}
    ${waves(128, mood === 'storm' ? '#2e4a66' : mood === 'night' ? '#1d2c55' : '#2464a0', 400, mood === 'storm' ? 9 : 5)}
    ${waves(140, mood === 'storm' ? '#243a52' : mood === 'night' ? '#16224a' : '#1b4f86', 400, mood === 'storm' ? 8 : 4, 34)}
  </svg>`;
}

const sun = `<circle cx="345" cy="34" r="18" fill="#ffd76a"/>`;
const moon = `<circle cx="345" cy="34" r="15" fill="#f5efd8"/><circle cx="339" cy="30" r="13" fill="#141c3a" opacity=".85"/>
  <circle cx="60" cy="26" r="1.5" fill="#fff"/><circle cx="130" cy="48" r="1.2" fill="#fff"/><circle cx="230" cy="22" r="1.5" fill="#fff"/>`;
const bolt = (x) => `<polygon points="${x},18 ${x - 12},62 ${x - 2},60 ${x - 16},98 ${x + 8},56 ${x - 2},58 ${x + 10},18" fill="#ffe680"/>`;

// ---------- הסצנות ----------

export const scenes = {
  title: () => frame(ship(200, 118, 1.5, { sail: '#2e9e4f', sail2: '#c0392b' }), 'day', sun),
  newday: () => frame(ship(320, 122, 0.8) + `<text x="30" y="60" font-size="26">🌅</text>`, 'dusk'),
  rest: () => frame(ship(320, 122, 0.8, { flip: true }), 'night', moon),

  sail: () => frame(ship(200, 120, 1.1), 'day', sun),
  sailNight: () => frame(ship(200, 120, 1.1), 'night', moon),
  arrive: () => frame(ship(150, 120, 1) +
    `<rect x="290" y="96" width="110" height="34" fill="#8a5a2b"/><rect x="286" y="92" width="114" height="8" fill="#a06a33"/>
     <rect x="320" y="46" width="8" height="46" fill="#6b4520"/><rect x="352" y="56" width="8" height="36" fill="#6b4520"/>`, 'day', sun),

  storm: () => frame(ship(190, 118, 1.05, { tilt: -14, sail: '#4a7a5a', sail2: '#8a3a30' }), 'storm', bolt(90) + bolt(310)),
  aground: () => frame(ship(210, 112, 1, { tilt: 10 }) +
    `<polygon points="150,150 190,108 240,150" fill="#5a5f66"/><polygon points="230,152 268,118 300,152" fill="#4a4f56"/>`, 'night', moon),
  damaged: () => frame(ship(200, 120, 1.05, { tilt: -6, sail: '#8a8f96' }) +
    `<text x="255" y="70" font-size="24">💨</text>`, 'day'),
  fog: () => frame(ship(200, 122, 1, { sail: '#9aa5ad', sail2: '#8a959d' }) +
    `<rect x="0" y="40" width="400" height="22" fill="#dfe6ea" opacity=".8"/>
     <rect x="0" y="72" width="400" height="18" fill="#d2dade" opacity=".75"/>
     <rect x="0" y="100" width="400" height="16" fill="#c7d0d5" opacity=".7"/>`, 'day'),
  strike: () => frame(
    `<rect x="250" y="92" width="150" height="38" fill="#8a5a2b"/>
     <text x="325" y="80" font-size="30" text-anchor="middle">✊</text>
     <rect x="285" y="96" width="80" height="24" rx="3" fill="#f5efd8"/>
     <text x="325" y="113" font-size="13" font-weight="bold" text-anchor="middle" fill="#b03030">שביתה!</text>` +
    ship(110, 122, 0.9), 'day', sun),
  overweight: () => frame(ship(200, 130, 1.05, { tilt: 3 }) +
    `<text x="140" y="70" font-size="24">📦</text><text x="255" y="60" font-size="24">📦</text>`, 'day', sun),
  navError: () => frame(ship(230, 120, 1, { flip: true }) +
    `<text x="120" y="66" font-size="30">🧭</text><text x="80" y="100" font-size="22">❓</text>`, 'dusk'),
  derelict: () => frame(ship(120, 118, 0.95) +
    ship(290, 112, 0.85, { sail: '#8a8f7a', sail2: '#7a7f6a', flip: true, tilt: 4 }) +
    `<text x="275" y="52" font-size="22">🕸️</text>`, 'dusk'),

  pirates: () => frame(
    ship(115, 122, 0.95) +
    ship(300, 118, 1.05, { flip: true, hull: '#3a3f45', sail: '#2a2f35', sail2: '#4a1f1f' }) +
    `<rect x="296" y="42" width="26" height="16" fill="#111"/><text x="309" y="55" font-size="11" text-anchor="middle" fill="#fff">☠</text>`, 'dusk'),
  battleWin: () => frame(ship(140, 118, 1.05) +
    ship(310, 128, 0.8, { flip: true, hull: '#3a3f45', sail: '#2a2f35', sail2: '#4a1f1f', tilt: 16 }) +
    `<text x="300" y="66" font-size="26">🔥</text>`, 'dusk'),
  battleLoss: () => frame(ship(140, 122, 1, { tilt: -8, sail: '#8a8f96' }) +
    ship(310, 114, 1.05, { flip: true, hull: '#3a3f45', sail: '#2a2f35', sail2: '#4a1f1f' }) +
    `<text x="130" y="64" font-size="26">🔥</text>`, 'storm'),
  escape: () => frame(ship(90, 118, 1, { tilt: -4 }) +
    ship(330, 116, 0.9, { flip: true, hull: '#3a3f45', sail: '#2a2f35', sail2: '#4a1f1f' }) +
    `<text x="180" y="82" font-size="24">💨</text>`, 'dusk'),
  ransom: () => frame(ship(115, 122, 0.95) +
    ship(300, 118, 1.05, { flip: true, hull: '#3a3f45', sail: '#2a2f35', sail2: '#4a1f1f' }) +
    `<text x="192" y="80" font-size="28" text-anchor="middle">💰</text>`, 'dusk'),

  shockUp: () => frame(`<text x="200" y="90" font-size="52" text-anchor="middle">📈</text>` + ship(330, 126, 0.7), 'day', sun),
  shockDown: () => frame(`<text x="200" y="90" font-size="52" text-anchor="middle">📉</text>` + ship(330, 126, 0.7), 'day', sun),
  expand: () => frame(ship(200, 118, 1.25) + `<text x="90" y="70" font-size="30">🔨</text>`, 'day', sun),
  crew: () => frame(ship(260, 120, 0.95) +
    `<text x="80" y="106" font-size="30">🧔</text><text x="115" y="106" font-size="30">🧔</text><text x="150" y="106" font-size="30">😠</text>`, 'day', sun),
  theft: () => frame(
    `<rect x="240" y="60" width="140" height="70" fill="#6b4520"/><polygon points="240,60 310,30 380,60" fill="#4a2c10"/>
     <rect x="295" y="95" width="28" height="35" fill="#3a2408"/>
     <text x="200" y="110" font-size="34">🦹</text><text x="160" y="90" font-size="24">💰</text>`, 'night', moon),
  trader: () => frame(
    `<rect x="250" y="94" width="150" height="36" fill="#8a5a2b"/>
     <text x="330" y="88" font-size="34" text-anchor="middle">🧔</text>
     <text x="290" y="124" font-size="22">📦</text><text x="360" y="124" font-size="22">📦</text>` +
    ship(110, 122, 0.9), 'day', sun),
  collision: () => frame(ship(160, 120, 1) +
    ship(275, 126, 0.65, { flip: true, sail: '#4a6a8a', sail2: '#3a5a7a' }) +
    `<text x="218" y="92" font-size="26">💥</text>`, 'day', sun),
  bank: () => frame(
    `<rect x="130" y="60" width="140" height="70" fill="#e8dfc8"/>
     <polygon points="120,60 200,28 280,60" fill="#c9b98a"/>
     <rect x="145" y="75" width="14" height="55" fill="#b8a878"/><rect x="175" y="75" width="14" height="55" fill="#b8a878"/>
     <rect x="205" y="75" width="14" height="55" fill="#b8a878"/><rect x="235" y="75" width="14" height="55" fill="#b8a878"/>
     <text x="200" y="52" font-size="18" text-anchor="middle">🏦</text>`, 'day', sun),
  repair: () => frame(ship(220, 116, 1.05, { tilt: 2 }) +
    `<rect x="60,96" y="96" width="90" height="34" fill="#8a5a2b"/><rect x="56" y="92" width="98" height="8" fill="#a06a33"/>
     <text x="100" y="82" font-size="28" text-anchor="middle">🔧</text>`, 'day', sun),
  score: () => frame(ship(200, 118, 1.3) + `<text x="90" y="60" font-size="34">🏆</text>`, 'dusk'),
  bankrupt: () => frame(ship(230, 130, 1, { tilt: 22, sail: '#8a8f96', sail2: '#6a6f76' }) +
    `<text x="110" y="80" font-size="32">💸</text>`, 'storm'),
};
