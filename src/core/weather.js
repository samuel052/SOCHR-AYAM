// core/weather.js — קביעת מזג האוויר היומי
// מקור: פרק 3 §1 (שגרה 0x60F4)

/**
 * מזג האוויר של היום.
 * נאמנות למקור: Random(8) נצרך תמיד (גם ביום 1!) — חשוב לרצף במצב האותנטי;
 * ביום 1 התוצאה תמיד "רגוע". בימים 2+: סיכוי 3/8 לסערה בנמל אקראי.
 * @param {number} day  היום (1..7)
 * @returns {{stormPort: number|null}}  אינדקס הנמל הסוער או null אם רגוע
 */
export function rollWeather(rng, day) {
  const bad = rng.random(8) < 3;      // תנאי 1 — מוגרל תמיד (0x6102)
  if (day === 1 || !bad) return { stormPort: null };
  return { stormPort: rng.random(3) }; // Random(3)+1 במקור → 0..2 אצלנו
}
