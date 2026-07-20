// core/state.js — מצב המשחק + שגרות עזר לשווי
// מקור: פרק 8 §1 (אתחול 0xC52C), פרק 6 (0x4648, 0x46D0)

import { INITIAL, CENTER_PRICE } from './constants.js';
import { rollDailyPrices } from './prices.js';
import { rollWeather } from './weather.js';

/** יצירת משחק חדש. צורכת הגרלות בסדר המקורי:
 *  Random(7)×2 (יום-רציף-סגור, יום-בנק [מנוטרל במקור]) — פרק 8 §1. */
export function newGame(rng) {
  const dockClosedDay = rng.random(7) + 1;
  rng.random(7); // יום-בנק-סגור — מוגרל ונדרס במקור (קוד מת, 0xC5A0); נצרך לנאמנות רצף
  return {
    cash: INITIAL.cash,
    bank: INITIAL.bank,
    cargo: [...INITIAL.cargo],
    damage: INITIAL.damage,
    capacity: INITIAL.capacity,
    location: INITIAL.location,
    day: INITIAL.day,
    hour: INITIAL.hour,
    dockClosedDay,
    prevEventR: 0,        // [0x2C9]
    prices: [[0,0,0],[0,0,0],[0,0,0]],
    stormPort: null,      // [0x2A2]
    guards: 0,
    gameOver: false,
    log: [],
  };
}

/** שווי המטען לפי מחירי המרכז — שגרת 0x4648 (פרק 6). */
export function cargoValue(state) {
  return state.cargo.reduce((s, t, c) => s + t * CENTER_PRICE[c], 0);
}

/** סה"כ טון — שגרת 0x46D0. */
export function totalCargo(state) {
  return state.cargo[0] + state.cargo[1] + state.cargo[2];
}

/** "רכוש" בשימוש הנוסחאות: מזומן + שווי מטען (פרקים 3, 6, 7). */
export function wealth(state) {
  return state.cash + cargoValue(state);
}

/** פתיחת יום חדש: שעה=8, מחירים, מזג אוויר (פרק 8 §2, שגרה 0xB52A). */
export function beginDay(state, rng) {
  state.hour = 8;
  state.prices = rollDailyPrices(rng);
  state.stormPort = rollWeather(rng, state.day).stormPort;
}
