// ui/map.js — מפת הים התיכון המזרחי עם ספינה נעה, ברוח MAP.WIN המקורי:
// תורכיה (מרסין) למעלה, קפריסין באמצע, ישראל (חיפה) מימין, מצרים (פורט-סעיד) למטה.
import { TURKEY, ISRAEL, EGYPT, PORTS } from '../core/constants.js';

/** עיר-הנמל של כל מדינה (כמו במקור). */
export const PORT_CITY = ['מרסין', 'חיפה', 'פורט-סעיד'];

/** מיקומי הנמלים על המפה (viewBox 420×300). */
export const PORT_XY = [
  [150, 62],   // תורכיה — מרסין
  [352, 180],  // ישראל — חיפה
  [235, 262],  // מצרים — פורט-סעיד
];

const label = (x, y, name, city) => `
  <g text-anchor="middle">
    <circle cx="${x}" cy="${y}" r="6" fill="#ffd76a" stroke="#7a4a1d" stroke-width="2"/>
    <text x="${x}" y="${y - 14}" class="map-port">${name}</text>
    <text x="${x}" y="${y + 22}" class="map-city">${city}</text>
  </g>`;

/** SVG המפה. הספינה — אלמנט #map-ship שמוזז ב-JS. */
export function mapSvg() {
  const [t, i, e] = PORT_XY;
  return `<svg id="map" viewBox="0 0 420 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <rect width="420" height="300" fill="#1e5f96"/>
    <!-- גלים עדינים -->
    ${[70, 120, 170, 220].map((y) => `<path d="M20,${y} q14,-6 28,0 t28,0 t28,0 t28,0 t28,0 t28,0 t28,0 t28,0 t28,0 t28,0 t28,0 t28,0 t28,0" stroke="#2a6fa8" stroke-width="2" fill="none"/>`).join('')}
    <!-- תורכיה (חוף צפוני) -->
    <path d="M0,0 H420 V38 Q340,52 280,44 Q210,58 150,48 Q80,60 0,44 Z" fill="#3f8a5a"/>
    <path d="M0,0 H420 V30 Q330,42 260,36 Q200,48 140,40 Q75,50 0,36 Z" fill="#4a9a66" opacity=".6"/>
    <!-- ישראל-לבנון (חוף מזרחי) -->
    <path d="M420,38 V300 H392 Q384,240 392,190 Q382,130 396,80 Q388,56 420,38 Z" fill="#c9a35a"/>
    <path d="M420,60 V300 H400 Q394,240 400,195 Q392,135 404,86 Z" fill="#d8b46a" opacity=".7"/>
    <!-- מצרים (חוף דרומי) -->
    <path d="M0,300 H420 V282 Q330,268 250,276 Q160,264 80,274 Q40,268 0,276 Z" fill="#d8b46a"/>
    <path d="M0,300 H420 V290 Q320,278 240,284 Q150,274 70,282 Z" fill="#c9a35a" opacity=".8"/>
    <!-- קפריסין -->
    <path d="M175,108 Q200,96 228,104 Q246,112 232,124 Q200,132 180,124 Z" fill="#3f8a5a"/>
    <text x="205" y="119" class="map-city" text-anchor="middle">קפריסין</text>
    <!-- נמלים -->
    ${label(t[0], t[1] - 4, PORTS[TURKEY], PORT_CITY[TURKEY])}
    ${label(i[0] - 8, i[1], PORTS[ISRAEL], PORT_CITY[ISRAEL])}
    ${label(e[0], e[1] + 6, PORTS[EGYPT], PORT_CITY[EGYPT])}
    <!-- הספינה -->
    <g id="map-ship" style="visibility:hidden">
      <path d="M-14,0 L14,0 L9,6 Q0,9 -9,6 Z" fill="#7a4a1d"/>
      <rect x="-1.5" y="-16" width="2" height="16" fill="#4a2c10"/>
      <path d="M-1,-15 Q7,-9 -1,-3 Z" fill="#2e9e4f"/>
      <path d="M-2,-13 Q-8,-8 -2,-4 Z" fill="#c0392b"/>
    </g>
  </svg>`;
}

/** מציב את הספינה בנמל (סטטית). */
export function placeShip(port) {
  const g = document.getElementById('map-ship');
  if (!g) return;
  const [x, y] = PORT_XY[port];
  g.style.visibility = 'visible';
  g.setAttribute('transform', `translate(${x},${y + 10})`);
}

/**
 * הנפשת הפלגה: מהנמל from אל to, בקטע הדרך [startFrac..fraction]
 * (למשל 0.5→1 = המחצית השנייה, אחרי עצירת שודדים).
 * onHour נקרא בכל "שעה" (לעדכון השעון), done בסיום.
 */
export function animateVoyage({ from, to, hours, fromHour, fraction = 1, startFrac = 0, back = false, onHour, done }) {
  const g = document.getElementById('map-ship');
  const [x0, y0] = PORT_XY[from];
  const [x1, y1] = PORT_XY[to];
  const msPerHour = 550;
  const span = fraction - startFrac;
  const total = hours * span * msPerHour + (back ? hours * span * msPerHour : 0);
  const start = performance.now();
  let lastHour = -1;
  g.style.visibility = 'visible';
  // טיימר ולא requestAnimationFrame — כדי שההפלגה תושלם גם בטאב-רקע
  // (rAF מושהה כשהדפדפן לא מצייר, והמשחק היה נתקע ב"מפליגים...").
  const timer = setInterval(() => {
    const t = Math.min(1, (performance.now() - start) / total);
    // הלוך (ואם back — גם חזור)
    const p = back
      ? startFrac + (t < 0.5 ? t * 2 : (1 - t) * 2) * span
      : startFrac + t * span;
    const x = x0 + (x1 - x0) * p;
    const y = y0 + (y1 - y0) * p + 10;
    const flip = (back && t >= 0.5) !== (x1 < x0);
    g.setAttribute('transform', `translate(${x},${y})${flip ? ' scale(-1,1)' : ''}`);
    const hoursPassed = Math.floor(t * total / msPerHour);
    if (hoursPassed !== lastHour) { lastHour = hoursPassed; onHour?.(fromHour + hoursPassed); }
    if (t >= 1) { clearInterval(timer); done?.(); }
  }, 33);
}
