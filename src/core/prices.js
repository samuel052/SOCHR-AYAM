// core/prices.js — מנוע המחירים היומי + זעזועי מחיר
// מקור: פרק 2 §ב (שגרה 0x5FE5), פרק 3 §4 (וריאנטי הזעזוע 0x67A7+)

import { CENTER_PRICE, PRICE_ENGINE, SHOCK_ENGINE } from './constants.js';

/**
 * הגרלת מחירי היום: 3 סחורות × 3 נמלים, הגרלה עצמאית לכל תא.
 * סדר ההגרלות (חשוב למצב האותנטי!) כמו במקור 0x5FF1: לכל נמל בתורו —
 * נחושת, זיתים, חיטה (נמל 1, אחר-כך 2, אחר-כך 3).
 * @returns {number[][]} prices[port][good]
 */
export function rollDailyPrices(rng) {
  const prices = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let port = 0; port < 3; port++) {
    for (let good = 0; good < 3; good++) {
      const p = PRICE_ENGINE[good];
      prices[port][good] = CENTER_PRICE[good] - p.dev + rng.random(p.k) * p.step;
    }
  }
  return prices;
}

/**
 * זעזוע מחיר (אירוע R∈[1,12], פרק 3 §4): סחורה+כיוון נגזרים מ-R,
 * הנמל מוגרל, והמחיר החדש נכתב לתא — מחוץ לטווח הרגיל.
 * @param {number[][]} prices  מטבלת rollDailyPrices — משתנה במקום
 * @param {number} R  ערך האירוע 1..12
 * @returns {{good:number, up:boolean, port:number, newPrice:number}}
 */
export function applyPriceShock(prices, rng, R) {
  // R: 1-2 נחושת↑, 3-4 זיתים↑, 5-6 חיטה↑, 7-8 נחושת↓, 9-10 זיתים↓, 11-12 חיטה↓
  const up = R <= 6;
  const good = Math.floor(((R - 1) % 6) / 2);
  const port = rng.random(3); // Random(3)+1 במקור → 0..2 אצלנו
  const s = SHOCK_ENGINE[good][up ? 'up' : 'down'];
  const delta = s.base + rng.random(s.k) * s.step;
  const newPrice = CENTER_PRICE[good] + (up ? delta : -delta);
  prices[port][good] = newPrice;
  return { good, up, port, newPrice };
}
