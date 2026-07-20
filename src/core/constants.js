// core/constants.js — קבועי המשחק. מקור: פרקים 2, 3, 8.

/** הנמלים. האינדקסים 0..2 מקבילים ל-1..3 במקור (תורכיה/ישראל/מצרים, פרק 6 שגרה 0x4CE1). */
export const PORTS = ['תורכיה', 'ישראל', 'מצרים'];
export const TURKEY = 0, ISRAEL = 1, EGYPT = 2;

/** הסחורות. האינדקסים 0..2 מקבילים ל-1..3 במקור (פרק 2 §ב). */
export const GOODS = ['נחושת', 'זיתים', 'חיטה'];
export const COPPER = 0, OLIVES = 1, WHEAT = 2;

/** מחירי המרכז — קבועים לכל המשחק (פרק 2 §ב.2, אתחול @0xBCEF). */
export const CENTER_PRICE = [3000, 500, 50];

/** פרמטרי מנוע המחיר היומי (פרק 2 §ב.3): מחיר = מרכז − סטייה + Random(k)×קפיצה */
export const PRICE_ENGINE = [
  { dev: 500, k: 11, step: 100 }, // נחושת: 2500..3500
  { dev: 150, k: 7,  step: 50  }, // זיתים: 350..650
  { dev: 15,  k: 8,  step: 5   }, // חיטה: 35..70
];

/** פרמטרי זעזוע המחיר (פרק 3 §4). לירידות זיתים/חיטה פרמטרים שונים מן העליות. */
export const SHOCK_ENGINE = [
  { up: { base: 1100, k: 5, step: 100 }, down: { base: 1100, k: 5, step: 100 } },
  { up: { base: 200,  k: 4, step: 50  }, down: { base: 150,  k: 3, step: 50  } },
  { up: { base: 20,   k: 5, step: 5   }, down: { base: 15,   k: 3, step: 5   } },
];

/** ערכי פתיחה (פרק 8 §1). */
export const INITIAL = {
  cash: 5000,
  bank: 0,
  cargo: [0, 0, 0],
  damage: 0,
  capacity: 100,
  location: ISRAEL,
  day: 1,
  hour: 8,
};

export const LAST_DAY = 7;       // שבוע מסחר (פרק 1)
export const NIGHT_HOUR = 16;    // סף לילה (פרק 6 §1)
export const RICH_THRESHOLD = 45000; // שער "שחקן עשיר" (פרק 3 §2.3, פרק 5)
