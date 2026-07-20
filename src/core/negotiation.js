// core/negotiation.js — שגרת המו"מ המשותפת 0x579A (פרק 3 §6, פרק 7 §5)
// משמשת את פיתוי-הצוות ואת כופר-השודדים: דרישה נסתרת, הצעה של השחקן, קיבול אם עברה.

import { CENTER_PRICE } from './constants.js';
import { wealth } from './state.js';

/** דרישת הצד השני = רכוש ÷ (Random(6)+4) — Real לא מעוגל במקור.
 *  נשמר כשבר מדויק כדי שהשוואת הגבול הקשיחה לא תאבד את החלק השברי. */
export function rollDemand(state, rng) {
  const denominator = rng.random(6) + 4;
  const numerator = wealth(state);
  return {
    numerator,
    denominator,
    valueOf() { return numerator / denominator; },
  };
}

/** שווי הצעה: מזומן + טונות מכל סחורה לפי מחירי המרכז (עקבי עם 0x4648). */
export function offerValue(offer) {
  return offer.cash
    + offer.tons[0] * CENTER_PRICE[0]
    + offer.tons[1] * CENTER_PRICE[1]
    + offer.tons[2] * CENTER_PRICE[2];
}

/** בדיקת חוקיות הצעה: אי אפשר להציע יותר ממה שיש (שגרת 0x584C). */
export function offerIsAffordable(state, offer) {
  if (offer.cash < 0 || offer.cash > state.cash) return false;
  for (let c = 0; c < 3; c++) {
    if (offer.tons[c] < 0 || offer.tons[c] > state.cargo[c]) return false;
  }
  return true;
}

/** ביצוע המו"מ: מחזיר true אם ההצעה התקבלה (offerValue > demand),
 *  ומנכה את ההצעה מהשחקן במקרה קיבול. */
export function resolveOffer(state, offer, demand) {
  const value = offerValue(offer);
  const accepted = demand && typeof demand === 'object'
    ? value * demand.denominator > demand.numerator
    : value > demand;
  if (accepted) {
    state.cash -= offer.cash;
    for (let c = 0; c < 3; c++) state.cargo[c] -= offer.tons[c];
  }
  return accepted;
}
