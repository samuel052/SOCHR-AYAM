// core/events.js — אירועי תחילת היום: הבורר + כל המטפלים
// מקור: פרק 3 (בורר 0x64AE, מטפלים), פרק 4 (הצעות הסוחר)

import { CENTER_PRICE, GOODS } from './constants.js';
import { applyPriceShock } from './prices.js';
import { loseCargoPercent, loseCash } from './loss.js';
import { wealth, cargoValue } from './state.js';
import { rollDemand, resolveOffer } from './negotiation.js';

/** קטגוריות המקור לצורך מניעת חזרה (0x64C8–0x672E).
 * שינויי המחיר הם שישה זוגות; שאר הקטגוריות הן משפחות האירוע השלמות. */
export function eventCategory(R) {
  // הבינארי מונע רק את אותו זוג מספרים: 1–2, 3–4, ... 29–30.
  // גם משפחה רחבה (למשל הרחבה 13–18) מחולקת לשלושה זוגות נפרדים.
  return Math.floor((R - 1) / 2);
}

/**
 * הגרלת אירוע היום (רק מיום 2 — פרק 3 §1).
 * כולל: מניעת-חזרה (re-roll), דילוג-צוות בימים 6+, ושערי "שחקן עשיר".
 * @returns {number} R הסופי (1..30)
 */
export function rollDailyEvent(state, rng, { commit = true } = {}) {
  let R;
  for (;;) {
    R = rng.random(30) + 1;
    // רק מועמד שנפסל בגלל חזרה מדלג על שתי הגרלות שערי-העושר.
    if (state.prevEventR && eventCategory(R) === eventCategory(state.prevEventR)) continue;
    break;
  }
  // שתי ההגרלות נצרכות תמיד, גם כשהסף אינו מתקיים וגם אם הראשונה כבר כפתה R=15.
  const gateA = rng.random(6);
  if (state.cash > 20000 && gateA === 1) R = 15;
  const gateB = rng.random(6);
  if (state.cash > 45000 && gateB === 1) R = 15;

  if (commit) state.prevEventR = R;
  return R;
}

/** זעזוע מחיר — R∈[1,12] (פרק 3 §4). */
export function eventPriceShock(state, rng, R) {
  const res = applyPriceShock(state.prices, rng, R);
  return { type: 'priceShock', ...res };
}

/** בונה את פירוק התשלום שהבינארי מציע עבור הרחבת הספינה (0x6AA5–0x6CD2). */
function expansionPayment(state, cost) {
  const payment = { cash: 0, bank: 0, tons: [0, 0, 0] };
  if (state.cash > cost) payment.cash = cost;
  else if (state.bank > cost) payment.bank = cost;
  else if (state.cash + state.bank > cost) {
    payment.cash = Math.trunc(state.cash);
    payment.bank = cost - payment.cash;
  } else {
    const rich = richestGoodForPayment(state);
    const richValue = rich ? rich.value : 0;
    if (richValue >= cost && rich) {
      payment.tons[rich.good] = Math.round(cost / CENTER_PRICE[rich.good]);
    } else {
      if (rich) payment.tons[rich.good] = state.cargo[rich.good];
      const remainder = cost - Math.trunc(richValue);
      // באג מקור מאומת: נבחר מקור כספי יחיד לפי התנאי המשונה הזה, נקטם
      // לסכום הזמין בו, ואין מעבר למקור השני גם אם התשלום נשאר חסר.
      if (state.cash > state.bank || state.cash >= richValue) {
        payment.cash = Math.min(remainder, Math.trunc(state.cash));
      } else {
        payment.bank = Math.min(remainder, Math.trunc(state.bank));
      }
    }
  }
  return payment;
}

function richestGoodForPayment(state) {
  let best = null;
  for (let c = 0; c < 3; c++) {
    if (state.cargo[c] < 1) continue;
    const value = state.cargo[c] * CENTER_PRICE[c];
    if (best === null || value > best.value) best = { good: c, value };
  }
  return best;
}

/** הצעת הרחבת ספינה — R∈[13,18] (0x69FB–0x6F68).
 *  הצעה שאי אפשר לממן מכלל המזומן+בנק+מטען אינה אירוע ומחייבת reroll אצל הקורא. */
export function eventExpansionOffer(state, rng) {
  const tons = (rng.random(2) + 1) * 50;           // 50 או 100
  const cost = (2 * tons + rng.random(tons)) * 10;
  const canAfford = state.cash + state.bank + cargoValue(state) >= cost;
  if (!canAfford) return null;
  const payment = expansionPayment(state, cost);
  return {
    type: 'expansion', tons, cost, payment, canAfford: true,
    accept() {
      if (state.cash < payment.cash || state.bank < payment.bank) return false;
      if (payment.tons.some((q, c) => q > state.cargo[c])) return false;
      // סדר הכתיבות בבינארי: קיבולת תחילה, ורק אחר כך ניכויי התשלום.
      state.capacity += tons;
      state.cash -= payment.cash;
      state.bank -= payment.bank;
      for (let c = 0; c < 3; c++) state.cargo[c] -= payment.tons[c];
      return true;
    },
  };
}

/** נטישת צוות — R∈[19,20]. האירוע ישים רק בימים 2–5.
 *  צוות חדש או מו״מ שנכשל מדלגים מיד מספר יום אחד, בלי אתחול בוקר נוסף. */
export function eventCrewDesertion(state) {
  if (state.day >= 6) return null;
  return {
    type: 'crewDesertion',
    newCrew() {
      state.day += 1;
      return { accepted: false, dayLost: true };
    },
    rollDemand(rng) { return rollDemand(state, rng); },
    negotiate(offer, demand) {
      const accepted = resolveOffer(state, offer, demand);
      if (!accepted) state.day += 1;
      return { accepted, dayLost: !accepted };
    },
  };
}

/** גניבה — ניסיון מזומן תמיד; רק תוצאה 0 עוברת למסלול מטען (0x719D). */
export function eventTheft(state, rng) {
  const stolen = loseCash(state, rng);
  if (stolen > 0) {
    return { type: 'theft', kind: 'cash', amount: stolen };
  }
  const res = loseCargoPercent(state, rng);
  if (res) return { type: 'theft', kind: 'cargo', ...res };
  return null;
}

/** סוחר קונה ממני — R∈[23,26] (פרק 4 §1). מציע מחיר לטון על כל מלאי סחורה אחת.
 *  הסחורה: הראשונה בסדר נחושת→זיתים→חיטה שיש ממנה יותר מטון אחד. */
const BUY_OFFER = [ // לכל סחורה: מחיר-שוק + Random(k)×step − sub
  { k: 30, step: 50, sub: 600 },  // נחושת
  { k: 70, step: 10, sub: 300 },  // זיתים
  { k: 14, step: 5,  sub: 40 },   // חיטה
];
export function eventTraderBuys(state, rng) {
  let g = -1;
  for (let c = 0; c < 3; c++) {
    if (state.cargo[c] > 1) { g = c; break; }
  }
  if (g === -1) return null;
  const p = BUY_OFFER[g];
  const price = state.prices[state.location][g] + rng.random(p.k) * p.step - p.sub;
  const tons = state.cargo[g];
  return {
    type: 'traderBuys', good: g, goodName: GOODS[g], price, tons,
    total: price * tons,
    accept() { state.cash += price * tons; state.cargo[g] = 0; },
  };
}

/** סוחר מוכר לי — R∈[27,28] (פרק 4 §2). */
export function eventTraderSells(state, rng) {
  const g = rng.random(3);
  const center = CENTER_PRICE[g];
  // מחיר לטון = (Trunc(Random(center)/5) + Trunc(center/10)) × 5   (קוד 0x7843)
  const price = (Math.trunc(rng.random(center) / 5) + Math.trunc(center / 10)) * 5;
  // budget=.25*cash+Random(Trunc(.75*cash)+1); הכמות היא הכפולה הבאה של 5 לפי מחיר המרכז.
  const budget = 0.25 * state.cash + rng.random(Math.trunc(0.75 * state.cash) + 1);
  const tons = 5 * Math.trunc((budget / center) / 5 + 1);
  const total = price * tons;
  if (!(state.cash > 0 && total <= state.cash)) return null;
  return {
    type: 'traderSells', good: g, goodName: GOODS[g], price, tons,
    total, canAfford: true,
    accept() {
      if (state.cash < total) return false;
      state.cash -= total;
      state.cargo[g] += tons;
      return true;
    },
  };
}

/** התנגשות ספינת דיג — R∈[29,30] (פרק 3 §9):
 *  נזק += 10×Trunc(רכוש/(150+Random(80))). תוצאת אפס אינה אירוע ומחייבת reroll. */
export function eventCollision(state, rng) {
  const dmg = 10 * Math.trunc(wealth(state) / (150 + rng.random(80)));
  if (dmg <= 0) return null;
  state.damage += dmg;
  return { type: 'collision', damage: dmg };
}
