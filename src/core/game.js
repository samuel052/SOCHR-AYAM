// core/game.js — תזמור המשחק: לולאת הימים, האירוע היומי, סוף המשחק והניקוד
// מקור: פרק 8 §2, §6 (לולאה 0xCBD3, ניקוד 0xCBE5)

import { LAST_DAY } from './constants.js';
import { newGame, beginDay, cargoValue } from './state.js';
import {
  rollDailyEvent, eventPriceShock, eventExpansionOffer, eventTheft,
  eventCrewDesertion, eventTraderBuys, eventTraderSells, eventCollision,
} from './events.js';
import { isBankrupt } from './actions.js';

export { newGame };

/**
 * פתיחת יום: מחירים+מזג אוויר; מיום 2 — אירוע יומי.
 * מחזיר את תיאור האירוע (חלק מהאירועים אינטראקטיביים — נושאים accept()).
 * @returns {{weatherStormPort:number|null, event:object|null}}
 */
export function startDay(state, rng) {
  beginDay(state, rng);
  let event = null;
  if (state.day > 1) {
    for (;;) {
      const R = rollDailyEvent(state, rng, { commit: false });
      if (R <= 12) event = eventPriceShock(state, rng, R);
      else if (R <= 18) event = eventExpansionOffer(state, rng);
      else if (R <= 20) event = eventCrewDesertion(state);
      else if (R <= 22) event = eventTheft(state, rng);
      else if (R <= 26) event = eventTraderBuys(state, rng);
      else if (R <= 28) event = eventTraderSells(state, rng);
      else event = eventCollision(state, rng);
      if (event !== null) {
        // במקור prevEvent נכתב רק אחרי שהמטפל והבחירה/האישור הסתיימו.
        event.R = R;
        event.complete = () => {
          if (event.completed) return false;
          state.prevEventR = R;
          event.completed = true;
          return true;
        };
        break;
      }
    }
  }
  return { weatherStormPort: state.stormPort, event };
}

/** סיום יום ("לנוח עד למחרת"): קידום היום; בדיקת סוף/פשיטת-רגל. */
export function endDay(state) {
  // 0xBB8D: הבדיקה נעשית רק ביציאה מן הימים 1–6. ביום 7 עוברים לניקוד גם בחוב נזק.
  if (state.day < LAST_DAY && isBankrupt(state, cargoValue)) {
    state.day = LAST_DAY;
    state.gameOver = true;
    state.endReason = 'bankrupt';
    return;
  }
  state.day += 1;
  if (state.day > LAST_DAY) {
    state.gameOver = true;
    state.endReason = 'weekOver';
  }
}

/** הניקוד הסופי (פרק 8 §6, קוד 0xCBE5): מזומן + בנק. המטען אינו נספר! */
export function finalScore(state) {
  return state.cash + state.bank;
}
