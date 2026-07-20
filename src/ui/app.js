// ui/app.js — M3: ממשק מלא ברוח המסכים המקוריים.
// כל הלוגיקה — במנוע (core/); כאן תצוגה, במה (stage), מפה חיה וסצנות.
import { createRng } from '../core/rng.js';
import { PORTS, GOODS, NIGHT_HOUR, LAST_DAY } from '../core/constants.js';
import { newGame, startDay, endDay, finalScore } from '../core/game.js';
import { totalCargo } from '../core/state.js';
import { buy, sell, deposit, withdraw, repair } from '../core/actions.js';
import { sail, routeHours, voyageRisk, guardShipPrice, completeVoyageAfterPirates } from '../core/voyage.js';
import { attemptEscape, fight, ransomDemand, resolveRansom } from '../core/pirates.js';
import { offerIsAffordable } from '../core/negotiation.js';
import { scenes } from './scenes.js';
import { mapSvg, placeShip, animateVoyage, PORT_CITY } from './map.js';

let S = null;
let rng = null;

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('he-IL');
const shekel = (n) => `${fmt(n)} ש"ח`;
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי'];

function log(msg, cls = '') {
  const li = document.createElement('li');
  li.textContent = msg;
  if (cls) li.className = cls;
  $('log').prepend(li);
}

// ---------- עמודת המצב (הפאנלים הכחולים) ----------
function renderSidebar(hourOverride = null) {
  $('sidebar').innerHTML = `
    <div class="spanel hero">
      <div class="cap">${PORTS[S.location]} · ${PORT_CITY[S.location]}</div>
      <div class="kv"><span>יום:</span><b>${DAY_NAMES[S.day - 1] ?? S.day}</b></div>
      <div class="kv"><span>שעה:</span><b>${hourOverride ?? S.hour}:00</b></div>
      <div class="kv"><span>תחזית:</span><b>${S.stormPort !== null ? `⛈️ ${PORTS[S.stormPort]}` : '☀️ רגוע'}</b></div>
    </div>
    <div class="spanel">
      <div class="cap">מלאי (${fmt(totalCargo(S))}/${fmt(S.capacity)} טון)</div>
      ${GOODS.map((g, i) => `<div class="kv"><span>${g}</span><b>${fmt(S.cargo[i])}</b></div>`).join('')}
    </div>
    <div class="spanel hero">
      <div class="cap">כסף מזומן</div>
      <div class="big-val">${fmt(S.cash)}</div>
      <div class="kv"><span>בבנק:</span><b>${fmt(S.bank)}</b></div>
    </div>
    <div class="spanel">
      <div class="kv"><span>נזק לספינה</span><b class="${S.damage > 0 ? 'bad' : ''}">${fmt(S.damage)}</b></div>
    </div>`;
}

// ---------- לוחות המחירים ----------
function renderBoards() {
  $('boards').innerHTML = [2, 1, 0].map((pi) => `
    <div class="board ${pi === S.location ? 'here' : ''}">
      <div class="bhead">${PORTS[pi]}${pi === S.location ? ' ⚓' : ''}</div>
      ${GOODS.map((g, gi) => `<div class="brow"><span>${g}</span>
        <span class="price">${fmt(S.prices[pi][gi])}</span></div>`).join('')}
    </div>`).join('');
}

function refresh() { renderSidebar(); renderBoards(); }

// ---------- הבמה ----------
function stage(sceneKey, bodyHtml, handlers = {}) {
  $('stage').innerHTML = `<div class="stage-card">
    ${sceneKey ? scenes[sceneKey]() : ''}
    <div class="stage-body">${bodyHtml}</div>
  </div>`;
  for (const [id, fn] of Object.entries(handlers)) {
    const el = $(id);
    if (el) el.onclick = fn;
  }
}

/** במת המפה: המפה + תוכן מתחתיה. */
function stageMap(bodyHtml, handlers = {}) {
  $('stage').innerHTML = `<div class="stage-card">${mapSvg()}
    <div class="stage-body">${bodyHtml}</div></div>`;
  placeShip(S.location);
  for (const [id, fn] of Object.entries(handlers)) {
    const el = $(id);
    if (el) el.onclick = fn;
  }
}

// עורך 0x4F59 מתעלם מכל תו שאינו ספרה (גם '.', ',', סימן ו-e), במקום לפרש שבר.
const numVal = (id) => {
  const digits = String($(id)?.value ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

// ---------- תפריט הנמל (המגילה) ----------
function portMenu() {
  refresh();
  // אפשרות התיקון מופיעה רק כשבאמת יש נזק — כמו במקור
  const opts = [
    ['m-buy', 'לקנות', () => tradePanel('buy')],
    ['m-sell', 'למכור', () => tradePanel('sell')],
    ['m-sail', 'לנסוע', sailPanel, 'primary'],
    ['m-bank', 'לגשת לבנק', bankPanel],
    ...(S.damage > 0 ? [['m-repair', 'לתקן את הספינה', repairPanel]] : []),
    ['m-rest', 'לנוח עד למחרת', finishDay],
  ];
  stage(null, `<div class="menu-scroll">
      <h3>האפשרויות העומדות בפניך</h3>
      <div class="opts">
        ${opts.map(([id, label, , cls], i) =>
    `<button id="${id}" ${cls ? `class="${cls}"` : ''}>${i + 1}. ${label}</button>`).join('')}
      </div>
    </div>`,
  Object.fromEntries(opts.map(([id, , fn]) => [id, fn])));
}

// ---------- מסחר ----------
function tradePanel(mode) {
  const isBuy = mode === 'buy';
  // כמו במקור: בקנייה — כמה אפשר לקנות מכל סחורה בכסף שבידך; במכירה — כמה יש לך
  const infoRows = GOODS.map((g, i) => {
    const price = S.prices[S.location][i];
    const val = isBuy ? Math.trunc(S.cash / price) : S.cargo[i];
    return `<div class="brow"><span>${g} — ${shekel(price)} לטון</span>
      <span class="price">${isBuy ? `תוכל לקנות עד ${fmt(val)} טון` : `יש לך ${fmt(val)} טון`}</span></div>`;
  }).join('');
  stage('trader', `<h3>${isBuy ? 'לקנות' : 'למכור'} — נמל ${PORTS[S.location]}</h3>
    <p>${isBuy ? `בידך <b>${shekel(S.cash)}</b> במזומן:` : 'הסחורה שבמחסן הספינה:'}</p>
    <div class="trade-info">${infoRows}</div>
    <div class="row">
      <label>סחורה <select id="t-good">${GOODS.map((g, i) =>
    `<option value="${i}">${g}</option>`).join('')}</select></label>
      <label>טונות <input type="number" id="t-tons" min="1" step="1" value="1"></label>
    </div>
    <div class="row">
      <button id="t-go" class="primary">${isBuy ? 'קנה' : 'מכור'}</button>
      <button id="t-back">חזרה לתפריט</button>
    </div>
    ${isBuy ? '<p class="note">קנייה מעל הקיבולת אפשרית — אך מסוכנת בהפלגה!</p>' : ''}`, {
    't-back': portMenu,
    't-go': () => {
      const good = Number($('t-good').value), tons = numVal('t-tons');
      const res = isBuy ? buy(S, good, tons) : sell(S, good, tons);
      if (!res.ok) {
        log(res.reason === 'noCash' ? 'כספך אינו מאפשר לך לקנות כמות כזו.'
          : res.reason === 'noCargo' ? 'אין לך כל-כך הרבה סחורה למכור.' : 'כמות לא חוקית.');
      } else {
        log(isBuy ? `קנית ${tons} טון ${GOODS[good]} תמורת ${shekel(res.cost)}.`
          : `מכרת ${tons} טון ${GOODS[good]} תמורת ${shekel(res.income)}.`);
        refresh();
      }
      tradePanel(mode);
    },
  });
}

// ---------- בנק ----------
function bankPanel() {
  stage('bank', `<h3>🏦 הבנק</h3>
    <p>בחשבונך: <b>${shekel(S.bank)}</b> · במזומן: <b>${shekel(S.cash)}</b></p>
    <div class="row">
      <input type="number" id="b-amount" min="1" step="1" value="1000">
      <button id="b-dep" class="primary">הפקדה</button>
      <button id="b-wd">משיכה</button>
      <button id="b-back">חזרה לתפריט</button>
    </div>
    <p class="note">ללא ריבית וללא עמלה — אבל מה שבבנק מוגן מגנבים ומשודדים.</p>`, {
    'b-back': portMenu,
    'b-dep': () => {
      const a = numVal('b-amount');
      const r = deposit(S, a);
      log(r.ok ? `הפקדת ${shekel(a)} בבנק.` : 'אין לך סכום כזה במזומן.');
      if (r.ok) refresh();
      bankPanel();
    },
    'b-wd': () => {
      const a = numVal('b-amount');
      const r = withdraw(S, a);
      log(r.ok ? `משכת ${shekel(a)} מהבנק.` : 'אין לך סכום כזה בבנק.');
      if (r.ok) refresh();
      bankPanel();
    },
  });
}

// ---------- מספנה ----------
function repairPanel() {
  if (S.day === S.dockClosedDay) {
    stage('repair', `<h3>🔧 המספנה</h3><p>הרציף סגור היום! תיאלץ להמתין עד מחר.</p>
      <div class="row"><button id="r-back">חזרה לתפריט</button></div>`, { 'r-back': portMenu });
    return;
  }
  stage('repair', `<h3>🔧 המספנה</h3>
    <p>הנזק שנגרם לספינתך עומד על <b>${fmt(S.damage)}</b>.
    עלות התיקון: 1 ש"ח לכל יחידת נזק (בידך ${shekel(S.cash)}).</p>
    <div class="row">
      <label>כמה לתקן? <input type="number" id="r-amount" min="1"
        value="${Math.max(1, Math.min(S.cash, S.damage))}"></label>
      <button id="r-go" class="primary">תקן</button>
      <button id="r-back">חזרה לתפריט</button>
    </div>`, {
    'r-back': portMenu,
    'r-go': () => {
      const a = numVal('r-amount');
      const r = repair(S, a);
      if (r.ok) {
        log(`תיקנת ${fmt(r.applied)} נזק. נותר: ${fmt(r.remaining)}.`);
        refresh();
        if (S.damage === 0) { portMenu(); return; } // אין עוד מה לתקן — חזרה לתפריט
      } else log('אין לך מספיק מזומן לתיקון.');
      repairPanel();
    },
  });
}

// ---------- הפלגה ----------
function sailPanel() {
  if (S.hour > 16) {
    stageMap('<h3>⛵ מאוחר מדי להפליג</h3><p>לא ניתן לצאת להפלגה אחרי השעה 16:00.</p><div class="row"><button id="sd-back">חזרה לתפריט</button></div>', { 'sd-back': portMenu });
    return;
  }
  if (S.damage > 1000) {
    stageMap('<h3>🔧 הספינה אינה כשירה</h3><p>הנזק גדול מ־1,000; יש לתקן את הספינה לפני ההפלגה.</p><div class="row"><button id="sd-back">חזרה לתפריט</button></div>', { 'sd-back': portMenu });
    return;
  }
  const dests = [0, 1, 2].filter((p) => p !== S.location);
  const btns = dests.map((d) => {
    const h = routeHours(S.location, d);
    const arr = S.hour + h;
    return `<button id="sd-${d}" class="primary" ${arr > 20 ? 'disabled' : ''}>
      ${PORTS[d]} — ${h} שעות (הגעה ~${arr}:00)</button>`;
  }).join('');
  stageMap(`<h3>⛵ לאן מפליגים?</h3>
    <div class="row">${btns}<button id="sd-back">חזרה לתפריט</button></div>
    ${dests.some((d) => S.hour + routeHours(S.location, d) > 20)
      ? '<p class="note">יעד שהגעתו אחרי 20:00 — מאוחר מדי להיום.</p>' : ''}`,
  Object.fromEntries([['sd-back', portMenu],
    ...dests.map((d) => [`sd-${d}`, () => confirmNight(d)])]));
}

function confirmNight(dest) {
  const arr = S.hour + routeHours(S.location, dest);
  if (arr <= NIGHT_HOUR) { guardsPanel(dest); return; }
  stage('sailNight', `<h3>🌙 הפלגת לילה</h3>
    <p>ההגעה ל${PORTS[dest]} צפויה בשעה ${arr}:00 — אחרי רדת החשכה. הסיכון גבוה יותר. להפליג?</p>
    <div class="row"><button id="n-yes" class="primary">להפליג</button>
    <button id="n-no">ביטול</button></div>`, {
    'n-yes': () => guardsPanel(dest), 'n-no': portMenu,
  });
}

function guardsPanel(dest) {
  const duration = routeHours(S.location, dest);
  const risk = voyageRisk(S, dest, S.hour + duration);
  const price = guardShipPrice(S, rng, risk);
  stage('sail', `<h3>🛡️ ספינות משמר</h3>
    <p>בנמל מציעים ליווי חמוש — <b>${shekel(price)}</b> לספינה. כמה לשכור?</p>
    <div class="row">${[0, 1, 2, 3].map((n) =>
    `<button id="g-${n}" ${n * price > S.cash ? 'disabled' : ''}>${n === 0 ? 'ללא ליווי' : `${n} ספינות`}</button>`).join('')}</div>`,
  Object.fromEntries([0, 1, 2, 3].map((n) => [`g-${n}`, () => {
    S.cash -= n * price;
    S.guards = n;
    if (n > 0) log(`שכרת ${n} ספינות משמר תמורת ${shekel(n * price)}.`);
    runVoyage(dest);
  }])));
}

const voyageScene = {
  storm: 'storm', aground: 'aground', worsened: 'damaged', damaged: 'damaged',
  navError: 'navError', overweight: 'overweight', fog: 'fog', strike: 'strike', derelict: 'derelict',
};
const voyageMsg = {
  storm: (e) => e.lost
    ? `סערה עזה! אבדו ${e.lost.tons} טון ${GOODS[e.lost.good]}.`
    : `סערה עזה! נגרם נזק של ${fmt(e.damage)}.`,
  aground: (e) => `בחשכה עלתה הספינה על שרטון! נזק: ${fmt(e.damage)}.`,
  worsened: (e) => `הנזק הקיים החמיר בלב ים! נזק נוסף: ${fmt(e.damage)}.`,
  damaged: (e) => `הספינה נפגעה בדרך. נזק: ${fmt(e.damage)}.`,
  navError: (e) => `טעות ניווט! במקום ${PORTS[e.intended]} הגעת ל${PORTS[e.actual]}.`,
  overweight: (e) => `עומס יתר! נאלצת להשליך ${e.tons} טון ${GOODS[e.good]} לים.`,
  fog: () => 'ערפל כבד ירד על הים! נאלצת לשוב לנמל המוצא.',
  strike: (e) => `שביתה בנמל ${PORTS[e.port]}! נאלצת לשוב לנמל המוצא.`,
  derelict: (e) => `מצאת ספינה נטושה ובה: ${e.found.map((t, i) =>
    t > 0 ? `${t} טון ${GOODS[i]}` : null).filter(Boolean).join(', ') || 'כלום'}.`,
};

function runVoyage(dest) {
  const from = S.location;
  const fromHour = S.hour;
  const res = sail(S, rng, dest);
  const hours = routeHours(from, dest);
  // תור סצנות לאחר האנימציה
  const queue = res.events.map((e) => ({
    scene: voyageScene[e.type] || 'sail', text: voyageMsg[e.type]?.(e) || e.type,
  }));
  for (const q of queue) log(q.text);

  stageMap('<h3>⛵ מפליגים...</h3><p class="note">הספינה בדרכה. אחוז בהגה!</p>');
  placeShip(from);
  const arrivedAt = res.finalDest ?? S.location;

  if (res.returnedToOrigin) {
    // ערפל/שביתה: חצי דרך ובחזרה
    animateVoyage({
      from, to: dest, hours, fromHour, fraction: 0.5, back: true,
      onHour: (h) => renderSidebar(Math.min(h, S.hour)),
      done: () => showEventQueue(queue, () => afterVoyage(true)),
    });
    return;
  }
  if (res.pendingPirates) {
    // מפגש שודדים בנקודת האמצע (פרק 6: שעה+משך/2)
    animateVoyage({
      from, to: arrivedAt, hours, fromHour, fraction: 0.5,
      onHour: (h) => renderSidebar(Math.min(h, S.hour)),
      done: () => piratesPanel(() => {
        completeVoyageAfterPirates(S, res.continuation);
        stageMap('<h3>⛵ ממשיכים בדרך...</h3>');
        // המשך מנקודת האמצע — לא מההתחלה!
        animateVoyage({
          from, to: arrivedAt, hours, fromHour: fromHour + hours / 2,
          startFrac: 0.5, fraction: 1,
          onHour: (h) => renderSidebar(Math.min(Math.round(h), S.hour)),
          done: () => showEventQueue(queue, () => afterVoyage(false)),
        });
      }),
    });
    return;
  }
  animateVoyage({
    from, to: arrivedAt, hours, fromHour,
    onHour: (h) => renderSidebar(Math.min(h, S.hour)),
    done: () => showEventQueue(queue, () => afterVoyage(false)),
  });
}

/** מציג תור סצנות-אירוע ברצף, ואז ממשיך. */
function showEventQueue(queue, then) {
  if (!queue.length) { then(); return; }
  const [q, ...rest] = queue;
  stage(q.scene, `<h3>${q.text}</h3>
    <div class="row"><button id="q-next" class="primary">המשך</button></div>`, {
    'q-next': () => showEventQueue(rest, then),
  });
}

function afterVoyage(returned) {
  S.guards = 0;
  refresh();
  if (returned) {
    log(`שבת לנמל ${PORTS[S.location]}.`);
    portMenu();
    return;
  }
  log(`⚓ עגנת בנמל ${PORTS[S.location]} בשעה ${S.hour}:00.`);
  stage('arrive', `<h3>הגעת בשלום!</h3>
    <p>עגנת בנמל <b>${PORTS[S.location]}</b> (${PORT_CITY[S.location]}) בשעה ${S.hour}:00.</p>
    <div class="row"><button id="a-ok" class="primary">אל הנמל</button></div>`, { 'a-ok': portMenu });
}

// ---------- שודדים ----------
function piratesPanel(continueVoyage) {
  refresh();
  stage('pirates', `<h3>🏴‍☠️ שודדי ים!</h3>
    <p>ספינת שודדים מתקרבת אליך במהירות. יש לך ${S.guards} ספינות משמר. מה תעשה?</p>
    <div class="row">
      <button id="p-fight" class="danger">להילחם! ⚔️</button>
      <button id="p-flee">לנסות לברוח 💨</button>
      <button id="p-ransom">להציע פשרה 💰</button>
    </div>`, {
    'p-fight': () => resolveFight(false, continueVoyage),
    'p-flee': () => {
      const r = attemptEscape(S, rng);
      if (r.escaped) {
        log('הצלחת לחמוק מהשודדים!');
        stage('escape', `<h3>💨 נמלטת!</h3><p>הספינה שלך מהירה — השודדים נשארו מאחור.</p>
          <div class="row"><button id="e-ok" class="primary">המשך</button></div>`,
        { 'e-ok': continueVoyage });
      } else {
        const why = r.reason === 'weight' ? 'הספינה עמוסה מכדי לברוח'
          : r.reason === 'damage' ? 'הנזק לספינה האט אותך' : 'ספינת השודדים מהירה משלך';
        log(`הבריחה נכשלה — ${why}!`);
        stage('pirates', `<h3>הבריחה נכשלה!</h3><p>${why}. השודדים עולים על הספינה — אין ברירה אלא להילחם.</p>
          <div class="row"><button id="pf-ok" class="danger">לקרב! ⚔️</button></div>`,
        { 'pf-ok': () => resolveFight(true, continueVoyage) });
      }
    },
    'p-ransom': () => ransomPanel(continueVoyage),
  });
}

function ransomPanel(continueVoyage) {
  const demand = ransomDemand(S, rng);
  stage('ransom', `<h3>💰 הצעת פשרה</h3>
    <p>השודדים מוכנים לשמוע הצעה. מה תציע להם תמורת דרככם?</p>
    <div class="row">
      <label>מזומן <input type="number" id="ro-cash" min="0" value="0" max="${S.cash}"></label>
      ${GOODS.map((g, i) => `<label>${g} <input type="number" id="ro-g${i}"
        min="0" value="0" max="${S.cargo[i]}"></label>`).join('')}
    </div>
    <div class="row"><button id="ro-go" class="primary">הצע</button>
    <button id="ro-fight" class="danger">עדיף להילחם</button></div>`, {
    'ro-fight': () => resolveFight(false, continueVoyage),
    'ro-go': () => {
      const offer = { cash: numVal('ro-cash'), tons: [numVal('ro-g0'), numVal('ro-g1'), numVal('ro-g2')] };
      if (!offerIsAffordable(S, offer)) { log('אינך יכול להציע מה שאין לך.'); return; }
      if (resolveRansom(S, offer, demand)) {
        log('השודדים לקחו את הכופר והסתלקו.');
        refresh();
        stage('escape', `<h3>עסקה!</h3><p>השודדים לקחו את הכופר והניחו לך להמשיך.</p>
          <div class="row"><button id="rk-ok" class="primary">המשך</button></div>`, { 'rk-ok': continueVoyage });
      } else {
        log('השודדים דחו את הצעתך בבוז — והם תוקפים!');
        stage('pirates', `<h3>ההצעה נדחתה!</h3><p>"תצטרך להציע הרבה יותר מזה!" — הם תוקפים!</p>
          <div class="row"><button id="rf-ok" class="danger">לקרב! ⚔️</button></div>`,
        { 'rf-ok': () => resolveFight(true, continueVoyage) });
      }
    },
  });
}

function resolveFight(disadvantage, continueVoyage) {
  const r = fight(S, rng, disadvantage);
  refresh();
  const lines = [];
  if (r.type === 'victory') {
    lines.push('ניצחון! הבסת את השודדים!');
    if (r.captured) lines.push('לכדת את ספינתם — הקיבולת גדלה ב-50 טון!');
    if (r.treasure) lines.push(`מצאת בספינתם מטמון של ${shekel(r.treasure)}!`);
  } else {
    lines.push('תבוסה... השודדים השתלטו על הספינה.');
    if (r.guardsLost) lines.push(`ספינות המשמר שלך (${r.guardsLost}) הוטבעו.`);
    if (r.plunder?.kind === 'cargo') lines.push(`השודדים בזזו ${r.plunder.tons} טון ${GOODS[r.plunder.good]}.`);
    if (r.plunder?.kind === 'cash') lines.push(`השודדים שדדו ${shekel(r.plunder.amount)}.`);
  }
  if (r.damage) lines.push(`הספינה נפגעה בקרב — נזק: ${fmt(r.damage)}.`);
  for (const l of lines) log(l);
  stage(r.type === 'victory' ? 'battleWin' : 'battleLoss',
    `<h3>${r.type === 'victory' ? '⚔️ ניצחון!' : '⚔️ תבוסה...'}</h3>
     ${lines.map((l) => `<p>${l}</p>`).join('')}
     <div class="row"><button id="f-ok" class="primary">המשך</button></div>`, { 'f-ok': continueVoyage });
}

// ---------- אירועי בוקר ----------
function morningEvent(event, then) {
  if (!event) { then(); return; }
  const done = () => { event.complete?.(); then(); };
  const simple = (scene, title, text) =>
    stage(scene, `<h3>${title}</h3><p>${text}</p>
      <div class="row"><button id="mv-ok" class="primary">המשך</button></div>`, { 'mv-ok': done });

  switch (event.type) {
    case 'priceShock': {
      const txt = `מחירי ה${GOODS[event.good]} ${event.up ? 'זינקו' : 'צנחו'} בנמל ${PORTS[event.port]} — ${shekel(event.newPrice)} לטון!`;
      log(txt);
      simple(event.up ? 'shockUp' : 'shockDown', event.up ? '📈 המחירים עולים!' : '📉 המחירים צונחים!', txt);
      break;
    }
    case 'expansion':
      {
      const parts = [];
      if (event.payment.cash) parts.push(`${shekel(event.payment.cash)} במזומן`);
      if (event.payment.bank) parts.push(`${shekel(event.payment.bank)} מן הבנק`);
      event.payment.tons.forEach((q, i) => { if (q) parts.push(`${q} טון ${GOODS[i]}`); });
      stage('expand', `<h3>🔨 הצעה מהמספנה</h3>
        <p>אתה יכול להגדיל את גודל ספינתך ב-<b>${event.tons} טון</b>.</p>
        <p>התשלום שנקבע: <b>${parts.join(' ובנוסף ')}</b> (מחיר נקוב: ${shekel(event.cost)}).</p>
        <div class="row"><button id="ev-yes" class="primary" ${event.canAfford ? '' : 'disabled'}>קבל</button>
        <button id="ev-no">דחה</button></div>`, {
        'ev-yes': () => { event.accept(); log(`הספינה הורחבה ב-${event.tons} טון!`); refresh(); done(); },
        'ev-no': () => { log('דחית את הצעת ההרחבה.'); done(); },
      });
      break;
      }
    case 'crewDesertion':
      stage('crew', `<h3>😠 הצוות נוטש!</h3>
        <p>המלחים דורשים שיפור בתנאים ומאיימים לעזוב. מה תעשה?</p>
        <div class="row">
          <button id="cr-new">לחפש צוות חדש (יאבד יום!)</button>
          <button id="cr-talk" class="primary">לנסות לשכנע אותם</button>
        </div>`, {
        'cr-new': () => { event.newCrew(); log('בילית את היום במציאת צוות חדש. יום אבד!'); refresh(); done(); },
        'cr-talk': () => {
          const demand = event.rollDemand(rng);
          stage('crew', `<h3>🤝 משא ומתן עם הצוות</h3>
            <p>מה תציע להם כדי שיישארו?</p>
            <div class="row">
              <label>מזומן <input type="number" id="cw-cash" min="0" value="0" max="${S.cash}"></label>
              ${GOODS.map((g, i) => `<label>${g} <input type="number" id="cw-g${i}"
                min="0" value="0" max="${S.cargo[i]}"></label>`).join('')}
            </div>
            <div class="row"><button id="cw-go" class="primary">הצע</button></div>`, {
            'cw-go': () => {
              const offer = { cash: numVal('cw-cash'), tons: [numVal('cw-g0'), numVal('cw-g1'), numVal('cw-g2')] };
              if (!offerIsAffordable(S, offer)) { log('אינך יכול להציע מה שאין לך.'); return; }
              const result = event.negotiate(offer, demand);
              if (result.accepted) { log('הצוות קיבל את הצעתך ונשאר!'); refresh(); done(); }
              else { log('הצוות דחה את ההצעה ועזב. בילית יום במציאת צוות חדש!'); refresh(); done(); }
            },
          });
        },
      });
      break;
    case 'theft': {
      const txt = event.kind === 'cash' ? `גנבים פרצו בלילה וגנבו ${shekel(event.amount)}!`
        : event.kind === 'cargo' ? `גנבים פרצו למחסן וגנבו ${event.tons} טון ${GOODS[event.good]}!`
          : 'גנבים ניסו לפרוץ — אך לא מצאו דבר.';
      log(txt);
      refresh();
      simple('theft', '🦹 גניבה!', txt);
      break;
    }
    case 'traderBuys':
      if (event.none) { simple('trader', '🧔 סוחר בנמל', 'סוחר חיפש סחורה — אך אין לך מה למכור.'); break; }
      stage('trader', `<h3>🧔 סוחר מעוניין לקנות</h3>
        <p>סוחר מציע לקנות את כל <b>${event.tons} הטונות</b> של ה${event.goodName} שלך
        במחיר <b>${shekel(event.price)}</b> לטון — סה"כ <b>${shekel(event.total)}</b>.</p>
        <div class="row"><button id="ev-yes" class="primary">מכור הכול</button>
        <button id="ev-no">דחה</button></div>`, {
        'ev-yes': () => { event.accept(); log(`מכרת לסוחר תמורת ${shekel(event.total)}.`); refresh(); done(); },
        'ev-no': () => { log('דחית את הצעת הסוחר.'); done(); },
      });
      break;
    case 'traderSells':
      if (!event.canAfford) { simple('trader', '🧔 סוחר בנמל', `סוחר הציע ${event.goodName} — אך אין באפשרותך לקנות.`); break; }
      stage('trader', `<h3>🧔 סוחר מציע סחורה</h3>
        <p>סוחר מציע <b>${event.tons} טון ${event.goodName}</b>
        במחיר <b>${shekel(event.price)}</b> לטון — סה"כ <b>${shekel(event.total)}</b>.</p>
        <div class="row"><button id="ev-yes" class="primary">קנה</button>
        <button id="ev-no">דחה</button></div>`, {
        'ev-yes': () => { event.accept(); log(`קנית מהסוחר ${event.tons} טון ${event.goodName}.`); refresh(); done(); },
        'ev-no': () => { log('דחית את הצעת הסוחר.'); done(); },
      });
      break;
    case 'collision': {
      const txt = event.damage > 0
        ? `ספינת דיג התנגשה בספינתך בנמל! נזק: ${fmt(event.damage)}.`
        : 'ספינת דיג התחככה בספינתך — ללא נזק.';
      log(txt);
      refresh();
      simple('collision', '💥 התנגשות!', txt);
      break;
    }
    default: done();
  }
}

// ---------- מהלך היום ----------
function beginDayFlow() {
  const { event } = startDay(S, rng);
  log(`— יום ${DAY_NAMES[S.day - 1] ?? S.day} —`, 'day-mark');
  const forecast = S.stormPort !== null
    ? `תחזית: ים סוער באזור ${PORTS[S.stormPort]}!` : 'תחזית: ים רגוע ושמיים בהירים.';
  log(forecast);
  refresh();
  stage('newday', `<h3>🌅 בוקר יום ${DAY_NAMES[S.day - 1] ?? S.day}</h3>
    <p>${forecast}</p>
    <div class="row"><button id="nd-ok" class="primary">התחל את היום</button></div>`, {
    'nd-ok': () => morningEvent(event, portMenu),
  });
}

function finishDay() {
  stage('rest', `<h3>🌙 לילה טוב, קפטן</h3><p>הספינה עוגנת בנמל, והצוות נח לקראת יום חדש.</p>
    <div class="row"><button id="rs-ok" class="primary">ליום הבא</button></div>`, {
    'rs-ok': () => {
      endDay(S);
      if (S.gameOver) showScore();
      else beginDayFlow();
    },
  });
}

// ---------- ניקוד ושיאים ----------
const HS_KEY = 'socher-remix-highscores';
const loadHS = () => { try { return JSON.parse(localStorage.getItem(HS_KEY)) || []; } catch { return []; } };

function showScore() {
  $('game-screen').hidden = true;
  const score = finalScore(S);
  const bankrupt = S.endReason === 'bankrupt';
  $('score-screen').innerHTML = `
    <div class="title-flags"><h1>${bankrupt ? '💸 פשיטת רגל!' : '🏁 השבוע הסתיים!'}</h1></div>
    <div id="score-scene">${scenes[bankrupt ? 'bankrupt' : 'score']()}</div>
    <p class="final">${bankrupt
    ? 'הנזק לספינה עלה על כל רכושך. המסע נגמר.'
    : `הצלחת לצבור <b>${shekel(score)}</b>${score > 5000 ? ` — רווח של ${shekel(score - 5000)}!` : ''}`}</p>
    ${bankrupt ? '' : `<div class="row" style="justify-content:center">
      <input type="text" id="hs-name" maxlength="20" placeholder="שמך, קפטן?">
      <button id="hs-save" class="primary">שמור בטבלת השיאים</button></div>`}
    <div id="hs-area">${renderHS(loadHS())}</div>
    <button id="btn-again" class="primary big">משחק חדש</button>`;
  $('score-screen').hidden = false;
  $('btn-again').onclick = startNewGame;
  if (!bankrupt) {
    $('hs-save').onclick = () => {
      const name = ($('hs-name').value.trim() || 'אלמוני').slice(0, 20);
      let hs = loadHS();
      hs.push({ name, score, date: new Date().toISOString().slice(0, 10) });
      hs.sort((a, b) => b.score - a.score);
      hs = hs.slice(0, 10);
      localStorage.setItem(HS_KEY, JSON.stringify(hs));
      $('hs-area').innerHTML = renderHS(hs, name, score);
      $('hs-save').disabled = true;
      $('hs-name').disabled = true;
    };
  }
}

function renderHS(hs, myName, myScore) {
  if (!hs.length) return '';
  let marked = false;
  return `<h3 style="color:var(--gold)">🏆 טבלת השיאים</h3><table class="hs-table">
    <tr><th>#</th><th>שם</th><th>ניקוד</th><th>תאריך</th></tr>
    ${hs.map((h, i) => {
    const me = !marked && h.name === myName && h.score === myScore;
    if (me) marked = true;
    return `<tr class="${me ? 'me' : ''}"><td>${i + 1}</td><td>${h.name}</td>
      <td>${fmt(h.score)}</td><td>${h.date}</td></tr>`;
  }).join('')}</table>`;
}

// ---------- אתחול ----------
function startNewGame() {
  rng = createRng('authentic');
  S = newGame(rng);
  $('log').innerHTML = '';
  $('start-screen').hidden = true;
  $('score-screen').hidden = true;
  $('game-screen').hidden = false;
  beginDayFlow();
}

$('title-scene').innerHTML = scenes.title();
$('highscores-home').innerHTML = renderHS(loadHS());
$('btn-new-game').onclick = startNewGame;
