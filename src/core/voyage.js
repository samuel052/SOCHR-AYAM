// core/voyage.js — צינור ההפלגה המלא
// מקור: פרק 6 (פרוצדורה 0x8D76/גוף 0x9E62): סיכון, מפגע-מסע, עומס, ערפל/שביתה,
// בורר אירועי-דרך R2, ספינות משמר, הגעה.

import { ISRAEL, TURKEY, EGYPT, NIGHT_HOUR, CENTER_PRICE } from './constants.js';
import { loseCargoPercent, shipDamage, jettison } from './loss.js';
import { cargoValue, totalCargo, wealth } from './state.js';

/** משכי מסלולים בשעות — מאומת מהמקור (0xB080–0xB096):
 *  אם המוצא או היעד הוא ישראל → 4 שעות; אחרת (תורכיה↔מצרים) → 8 שעות.
 *  שעת ההגעה = שעה + משך (0xB0A6); אירועי הדרך פוגעים בנקודת האמצע
 *  שעה + משך/2 (0xA53B). */
export function routeHours(from, to) {
  return (from === ISRAEL || to === ISRAEL) ? 4 : 8;
}

/** מחיר ספינת משמר (0xA82C–0xA8DF):
 *  5×Trunc(רכוש/(200+Random(100))), מינ׳ 75; בסיכון>0 תוספת שליש; קיטום לכפולת 5. */
export function guardShipPrice(state, rng, risk = 0) {
  let price = 5 * Math.trunc(wealth(state) / (200 + rng.random(100)));
  if (price < 75) price = 75;
  if (risk > 0) price += price / 3;
  price = Math.trunc(price / 5) * 5;
  return price;
}

/** רמת הסיכון [0x2C7] (פרק 6 §2). */
export function voyageRisk(state, dest, arrivalHour) {
  const stormRelevant = state.stormPort !== null
    && (state.stormPort === state.location || state.stormPort === dest);
  const night = arrivalHour > NIGHT_HOUR;
  if (night) return stormRelevant ? 4 : 2;
  return stormRelevant ? 3 : 0;
}

/** סטיית ניווט — דטרמיניסטית (פרק 6 §3.5): יעד ישראל→תורכיה, אחרת→ישראל. */
export const navErrorDest = (dest) => (dest === ISRAEL ? TURKEY : ISRAEL);

/** השלמת חצי המסלול שנותר אחרי מפגש פיראטים. בזמן המפגש המקור עדיין במוצא ובשעת האמצע. */
export function completeVoyageAfterPirates(state, continuation) {
  if (!continuation || continuation.completed) return false;
  state.location = continuation.dest;
  state.hour += continuation.remainingHours;
  continuation.completed = true;
  return true;
}

/**
 * ביצוע ההפלגה. מחזיר רשימת אירועים; מפגש-שודדים מוחזר כ-pendingPirates
 * (הכרעת השחקן קרב/בריחה/כופר נעשית מעל — ב-UI/סימולטור).
 */
export function sail(state, rng, dest) {
  const events = [];
  const from = state.location;
  const duration = routeHours(from, dest);
  const arrivalHour = state.hour + duration;
  if (state.hour > NIGHT_HOUR) {
    return { events, pendingPirates: false, arrivedAt: state.location, returnedToOrigin: false, blocked: 'late' };
  }
  if (state.damage > 1000) {
    return { events, pendingPirates: false, arrivedAt: state.location, returnedToOrigin: false, blocked: 'damage' };
  }
  if (arrivalHour > 20) {
    return { events, pendingPirates: false, arrivedAt: state.location, returnedToOrigin: false, blocked: 'arrival' };
  }
  const risk = voyageRisk(state, dest, arrivalHour);
  const midpointHour = state.hour + Math.trunc(duration / 2);
  let actualDest = dest;
  let hazardOccurred = false;
  let returnedToOrigin = false;

  // --- שלב א': מפגע מסע (0x9CAA, פרק 6 §3) ---
  const k = 1 + Math.trunc((state.damage + 399) / 400) + 2 * risk;
  const hazardRoll = rng.random(k) > 0;
  const parityRoll = rng.random(2) === 1; // נצרכת תמיד, גם כש-Random(k)==0
  const hazard = hazardRoll && parityRoll;
  if (hazard) {
    const damagedFlag = state.damage > 0;
    const minorFlag = !damagedFlag && rng.random(3) === 1;
    if (damagedFlag || minorFlag) {
      const stormRelevant = state.stormPort !== null
        && (state.stormPort === state.location || state.stormPort === dest);
      if (stormRelevant) {
        // שני מסלולים חלופיים: מטען יקר => אובדן מטען בלבד; אחרת נזק בלבד.
        if (cargoValue(state) > 10000) {
          events.push({ type: 'storm', lost: loseCargoPercent(state, rng), damage: 0 });
        } else {
          events.push({ type: 'storm', lost: null, damage: shipDamage(state, rng) });
        }
      } else if (midpointHour > NIGHT_HOUR) {
        const dmg = shipDamage(state, rng); // שרטון לילי (§3.3)
        events.push({ type: 'aground', damage: dmg });
      } else {
        const dmg = shipDamage(state, rng); // החמרה/נזק סתמי (§3.4)
        events.push({ type: damagedFlag ? 'worsened' : 'damaged', damage: dmg });
      }
      hazardOccurred = true;
    } else {
      actualDest = navErrorDest(dest); // סטיית ניווט (§3.5)
      events.push({ type: 'navError', intended: dest, actual: actualDest });
      hazardOccurred = true;
    }
  }

  // --- שלב ב': עומס יתר (0x9BE1, פרק 6 §5) ---
  if (!hazardOccurred && totalCargo(state) > state.capacity) {
    const over = totalCargo(state) - state.capacity;
    const k2 = over > 70 ? 1 : over > 60 ? 2 : over > 40 ? 3 : over > 20 ? 4 : 6;
    if (rng.random(k2) === 0) {
      const res = jettison(state, rng);
      events.push({ type: 'overweight', ...res });
      hazardOccurred = true;
    }
  }

  // --- שלב ג': ערפל/שביתה (פרק 6 §6) — רק אם יש זמן לחזור ---
  if (!hazardOccurred && state.hour + duration + Math.trunc(duration / 2) <= 20) {
    if (rng.random(12) === 0) {
      const isFog = rng.random(2) === 1;
      events.push({ type: isFog ? 'fog' : 'strike', port: actualDest });
      // חצי דרך הלוך + חזרה למוצא
      state.hour += duration; // זמן אבוד (הלוך ושוב מחצית)
      returnedToOrigin = true;
      hazardOccurred = true;
    }
  }

  // --- שלב ד': בורר אירועי-דרך R2 (פרק 6 §7) ---
  let pendingPirates = false;
  // Random(20) נצרך בכל הפלגה, גם כשהמפגע הקודם מבטל את הטיפול בתוצאה.
  let R2 = rng.random(20) + 1;
  if (midpointHour >= NIGHT_HOUR && R2 > 15) R2 = 1;
  if (!hazardOccurred && !returnedToOrigin) {
    if (R2 <= 6) {
      pendingPirates = true; // ההכרעה — אצל הקורא
    } else if (R2 === 7) {
      actualDest = navErrorDest(actualDest);
      events.push({ type: 'navError', intended: dest, actual: actualDest });
    } else if (R2 === 9 || R2 === 10) {
      // ספינה נטושה (§7.1): מנסים נחושת→זיתים→חיטה ונעצרים בכמות החיובית הראשונה.
      const found = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        const w = wealth(state);
        found[c] = Math.trunc(((rng.random(25) + 11) / 100) * w / CENTER_PRICE[c]);
        if (found[c] > 0) {
          state.cargo[c] += found[c];
          break;
        }
      }
      events.push({ type: 'derelict', found });
    }
  }

  // --- הגעה (פרק 6 §9) ---
  if (pendingPirates) {
    state.hour = midpointHour;
    return {
      events, pendingPirates: true, arrivedAt: state.location, finalDest: actualDest,
      returnedToOrigin, risk, R2,
      continuation: {
        dest: actualDest,
        remainingHours: duration - Math.trunc(duration / 2),
        completed: false,
      },
    };
  }
  if (!returnedToOrigin) {
    state.location = actualDest;
    state.hour += duration;
    // רק סטייה ממצרים כשהיעד המקורי ישראל והיעד בפועל תורכיה מוסיפה ארבע שעות.
    // המסלול הישיר מצרים→תורכיה נשאר בן שמונה שעות.
    if (from === EGYPT && dest === ISRAEL && state.location === TURKEY) state.hour += 4;
  }
  return { events, pendingPirates, arrivedAt: state.location, finalDest: state.location, returnedToOrigin, risk, R2 };
}
