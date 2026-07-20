// core/pirates.js — מפגש שודדי הים: קרב, בריחה, כופר, ביזה
// מקור: פרק 7 (כניסה 0x8D85, קרב 0x8F21, עוזר-נזק 0x8D98)

import { CENTER_PRICE } from './constants.js';
import { richestGood } from './loss.js';
import { cargoValue, totalCargo, wealth } from './state.js';
import { rollDemand, resolveOffer } from './negotiation.js';

/** ניסיון בריחה (פרק 7 §4). @returns {{escaped:boolean, reason?:string}} */
export function attemptEscape(state, rng) {
  const cargo = totalCargo(state);
  let escaped = false;
  if (cargo <= 0.81 * state.capacity) {
    let m = Math.trunc(state.capacity / 30) - Math.trunc(cargo / 30) + 1;
    if (m < 1) m = 1;
    if (rng.random(m) > 0) {
      // שלב הנזק: נתפס אם Random(נזק/30+1) > 0
      const kd = Math.trunc(state.damage / 30) + 1;
      escaped = rng.random(kd) === 0;
    }
  }
  if (escaped) return { escaped: true };
  const reason = cargo > 0.5 * state.capacity ? 'weight'
    : state.damage > 0 ? 'damage' : 'speed';
  return { escaped: false, reason };
}

/** דרישת הכופר (אותו מו"מ של הצוות — פרק 7 §5). */
export const ransomDemand = rollDemand;
export const resolveRansom = resolveOffer;

/** עוזר נזק-קרב 0x8D98: בהסתברות 1/n — נזק = Trunc(רכוש×(Random(15)+5)/1000)×10
 *  (5%–19% מהרכוש). מחזיר את הנזק או 0. */
function battleDamage(state, rng, n) {
  if (rng.random(n) !== 0) return 0;
  const dmg = Math.trunc((wealth(state) * (rng.random(15) + 5)) / 1000) * 10;
  state.damage += dmg;
  return dmg;
}

/**
 * הקרב (פרק 7 §6). disadvantage=true אחרי בריחה/כופר כושלים (משמר אפקטיבי −1).
 * @returns תוצאת הקרב המלאה
 */
export function fight(state, rng, disadvantage = false) {
  const guardsEff = state.guards - (disadvantage ? 1 : 0);
  // שתי ההגרלות נצרכות תמיד (נאמנות רצף: Random(4) ואז Random(6))
  const roll4 = rng.random(4);
  const roll6 = rng.random(6);
  const victory = roll4 < guardsEff || (guardsEff <= 0 && roll6 === 1);

  if (victory) {
    const result = { type: 'victory', captured: false, treasure: 0, damage: 0 };
    if (rng.random(3) === 1) { // לכידת ספינתם — 1/3
      state.capacity += 50;
      result.captured = true;
    } else {
      // לכידה ומטמון הם מסלולים בלעדיים. Int הוא קיטום כלפי אפס (1ABA), לא Round.
      const w = state.cash + cargoValue(state) + state.bank;
      let treasure = Math.trunc(w / 100) * (rng.random(15) + 5)
        + (w * state.guards) / 10;
      if (treasure < 100) treasure = 100;
      treasure = 5 * Math.trunc(treasure / 5);
      state.cash += treasure;
      result.treasure = treasure;
    }
    result.damage = battleDamage(state, rng, 4); // ניצחון: סיכוי נזק 1/4
    return result;
  }

  // תבוסה (פרק 7 §6.3)
  const guardsLost = state.guards;
  state.guards = 0;
  const result = { type: 'defeat', guardsLost, plunder: null, damage: 0 };
  const rich = richestGood(state);
  const missingGuards = 3 - Math.min(guardsLost, 3);
  if (rich && rich.value > state.cash) {
    // גניבת מטען: (Random(15)+5)% + 10%×(3−משמר) מהסחורה היקרה, מינ' 1
    const g = rich.good;
    const pct = rng.random(15) + 5;
    let tons = Math.trunc((state.cargo[g] * pct) / 100
      + missingGuards * Math.trunc(state.cargo[g] / 10));
    if (tons < 1) tons = 1;
    if (tons > state.cargo[g]) tons = state.cargo[g];
    state.cargo[g] -= tons;
    result.plunder = { kind: 'cargo', good: g, tons };
  } else if (state.cash > 500) {
    // גניבת מזומן: (Random(1.5%×מזומן)+מזומן/200)×10 + (3−משמר)×מזומן/10
    let stolen = (rng.random(Math.max(1, Math.trunc(0.015 * state.cash)))
      + Math.trunc(state.cash / 200)) * 10
      + missingGuards * Math.trunc(state.cash / 10);
    if (stolen > state.cash) stolen = state.cash;
    state.cash -= stolen;
    result.plunder = { kind: 'cash', amount: stolen };
    result.damage = battleDamage(state, rng, 2);
  } else {
    // כשאין רכיב ראוי לביזה: נזק ודאי מיוחד, כולל הכסף בבנק וללא הגרלת 1/2.
    const w = state.cash + cargoValue(state) + state.bank;
    let dmg = 10 * Math.trunc(w * (rng.random(15) + 35 - 10 * guardsLost) / 1000);
    if (dmg < 100) dmg = 100;
    state.damage += dmg;
    result.damage = dmg;
  }
  // ענף המטען מגיע לכאן אחרי הביזה וזקוק לעוזר 1/2.
  if (result.plunder?.kind === 'cargo') result.damage = battleDamage(state, rng, 2);
  return result;
}
