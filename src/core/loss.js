// core/loss.js — שגרת ההפסד המשותפת 0x5CC9 על ארבעת מצביה (פרק 6 §4)
// הערת דיוק: בענפי גניבת המזומן ונזק הספינה קיים מכפיל ×10; בענף אחוז המטען אין.

import { CENTER_PRICE } from './constants.js';
import { cargoValue, totalCargo, wealth } from './state.js';

/** מצב 0x8E — אובדן אחוז מסחורה אחת: הסחורה הראשונה (נחושת→זיתים→חיטה)
 *  שיש ממנה יותר מ-2 טון. נגנב Trunc(cargo×(20+Random(21))/100), מינ' 1.
 *  @returns {{good:number, tons:number}|null} */
export function loseCargoPercent(state, rng) {
  for (let c = 0; c < 3; c++) {
    if (state.cargo[c] > 2) {
      const pct = 20 + rng.random(21); // 20..40
      let tons = Math.trunc((state.cargo[c] * pct) / 100);
      if (tons < 1) tons = 1;
      state.cargo[c] -= tons;
      return { good: c, tons };
    }
  }
  return null;
}

/** מצב 0x8B — גניבת מזומן: Trunc(מזומן/(40+Random(40)))×10 ≈ 12.5%–25%. */
export function loseCash(state, rng) {
  const stolen = Math.trunc(state.cash / (40 + rng.random(40))) * 10;
  const actual = Math.min(stolen, state.cash);
  state.cash -= actual;
  return actual;
}

/** מצב 0x90 — נזק לספינה: max(100, Trunc(רכוש/(50+Random(30)))×10).
 *  (מינימום 100 — cmp 0x64/jl במקור.) */
export function shipDamage(state, rng) {
  let dmg = Math.trunc(wealth(state) / (50 + rng.random(30))) * 10;
  if (dmg < 100) dmg = 100;
  state.damage += dmg;
  return dmg;
}

/** מצב 0x99 — השלכת עומס (אירוע עומס-יתר, פרק 6 §5):
 *  אם סה"כ ≤ 3×קיבולת → אובדן-אחוז (0x8E); אחרת השלכת העודף המדויק
 *  מעל 3×קיבולת מהסחורה הגדולה ביותר. */
export function jettison(state, rng) {
  const total = totalCargo(state);
  const cap3 = 3 * state.capacity;
  if (total <= cap3) {
    return loseCargoPercent(state, rng);
  }
  // הסחורה הגדולה ביותר (בכמות)
  let g = 0;
  if (state.cargo[1] > state.cargo[0]) g = 1;
  if (state.cargo[2] > state.cargo[g]) g = 2;
  let excess = total - cap3;
  if (excess > state.cargo[g]) excess = state.cargo[g];
  state.cargo[g] -= excess;
  return { good: g, tons: excess };
}

/** בוחר הסחורה היקרה ביותר — שגרת 0x4883 (פרק 7 §6.3):
 *  argmax של cargo[c]×מחיר-מרכז[c] (רק סחורות עם מלאי).
 *  @returns {{good:number, value:number}|null} */
export function richestGood(state) {
  let best = null;
  for (let c = 0; c < 3; c++) {
    const v = state.cargo[c] * CENTER_PRICE[c];
    if (state.cargo[c] > 0 && (best === null || v > best.value)) {
      best = { good: c, value: v };
    }
  }
  return best;
}
