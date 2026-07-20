// tests/m1.test.js — בדיקות M1: נאמנות ה-RNG, מנוע המחירים, הזעזועים ומזג האוויר
// כל בדיקת התפלגות משווה לערכים התאורטיים מפרקי הפענוח.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tp3Rng, ModernRng } from '../core/rng.js';
import { rollDailyPrices, applyPriceShock } from '../core/prices.js';
import { rollWeather } from '../core/weather.js';
import { CENTER_PRICE } from '../core/constants.js';

// ---------- RNG ----------

test('Tp3Rng: תואם ביט-ביט לנוסחת המקור (אימות צולב ב-BigInt)', () => {
  const rng = new Tp3Rng(0x2E024489);
  let seedB = 0x2E024489n;
  for (let i = 0; i < 10000; i++) {
    const n = (i % 29) + 2;
    const got = rng.random(n);
    seedB = (seedB * 129n + 0x361962E9n) & 0xFFFFFFFFn; // פרק 2 §א.3
    const high = Number((seedB >> 16n) & 0xFFFFn);
    const want = (high >> 1) % n;                        // פרק 2 §א.4
    assert.equal(got, want, `סטייה בצעד ${i}`);
  }
});

test('Tp3Rng: דטרמיניזם — אותו זרע נותן אותו רצף', () => {
  const a = new Tp3Rng(12345), b = new Tp3Rng(12345);
  for (let i = 0; i < 1000; i++) assert.equal(a.random(30), b.random(30));
});

test('Tp3Rng: Randomize אורז את שעון DOS ו-Random(0) נכשל', () => {
  const rng = new Tp3Rng(0);
  rng.randomizeFromClock({
    getHours: () => 23, getMinutes: () => 59,
    getSeconds: () => 58, getMilliseconds: () => 990,
  });
  assert.equal(rng.seed, 0x173B3A63);
  assert.throws(() => rng.random(0), RangeError);
});

test('ModernRng: טווח ואחידות גסה', () => {
  const rng = new ModernRng(42);
  const counts = new Array(30).fill(0);
  const N = 300000;
  for (let i = 0; i < N; i++) {
    const v = rng.random(30);
    assert.ok(v >= 0 && v < 30);
    counts[v]++;
  }
  for (const c of counts) assert.ok(Math.abs(c / N - 1 / 30) < 0.005);
});

// ---------- מחירים (פרק 2) ----------

test('מחירים: כל תא בסט הערכים החוקי בלבד', () => {
  const rng = new ModernRng(7);
  const legal = [
    new Set(Array.from({ length: 11 }, (_, i) => 2500 + i * 100)),
    new Set(Array.from({ length: 7 }, (_, i) => 350 + i * 50)),
    new Set(Array.from({ length: 8 }, (_, i) => 35 + i * 5)),
  ];
  for (let d = 0; d < 20000; d++) {
    const p = rollDailyPrices(rng);
    for (let port = 0; port < 3; port++)
      for (let good = 0; good < 3; good++)
        assert.ok(legal[good].has(p[port][good]), `מחיר לא חוקי ${p[port][good]}`);
  }
});

test('מחירים עם ModernRng: התפלגות אחידה בקירוב על המדרגות', () => {
  const rng = new ModernRng(11);
  const N = 120000;
  const counts = [new Map(), new Map(), new Map()];
  for (let d = 0; d < N; d++) {
    const p = rollDailyPrices(rng);
    for (let good = 0; good < 3; good++) {
      const v = p[0][good]; // נמל אחד מספיק — הגרלות עצמאיות
      counts[good].set(v, (counts[good].get(v) ?? 0) + 1);
    }
  }
  const expected = [1 / 11, 1 / 7, 1 / 8];
  for (let good = 0; good < 3; good++) {
    for (const [, c] of counts[good])
      assert.ok(Math.abs(c / N - expected[good]) < 0.01,
        `סטייה בהתפלגות סחורה ${good}`);
  }
});

test('מחירים: עצמאות בין הנמלים (אין תא קבוע)', () => {
  const rng = new ModernRng(13);
  let differ = 0;
  for (let d = 0; d < 1000; d++) {
    const p = rollDailyPrices(rng);
    if (p[0][0] !== p[1][0] || p[1][0] !== p[2][0]) differ++;
  }
  assert.ok(differ > 800); // כמעט תמיד שונים
});

// ---------- זעזועי מחיר (פרק 3 §4) ----------

test('זעזוע: מיפוי R→סחורה/כיוון וטווחים מדויקים', () => {
  const rng = new ModernRng(17);
  const ranges = [ // [up-min, up-max, down-min, down-max] — פרק 3 §4
    [4100, 4500, 1500, 1900],
    [700, 850, 250, 350],
    [70, 90, 25, 35],
  ];
  for (let R = 1; R <= 12; R++) {
    for (let i = 0; i < 3000; i++) {
      const prices = rollDailyPrices(rng);
      const { good, up, port, newPrice } = applyPriceShock(prices, rng, R);
      assert.equal(good, Math.floor(((R - 1) % 6) / 2));
      assert.equal(up, R <= 6);
      assert.equal(prices[port][good], newPrice);
      const [uMin, uMax, dMin, dMax] = ranges[good];
      if (up) assert.ok(newPrice >= uMin && newPrice <= uMax, `R=${R} מחיר ${newPrice}`);
      else assert.ok(newPrice >= dMin && newPrice <= dMax, `R=${R} מחיר ${newPrice}`);
    }
  }
});

test('זעזוע: הנמל המושפע אחיד (1/3)', () => {
  const rng = new ModernRng(19);
  const counts = [0, 0, 0];
  const N = 90000;
  for (let i = 0; i < N; i++) {
    const prices = rollDailyPrices(rng);
    counts[applyPriceShock(prices, rng, 1).port]++;
  }
  for (const c of counts) assert.ok(Math.abs(c / N - 1 / 3) < 0.01);
});

// ---------- מזג אוויר (פרק 3 §1) ----------

test('מזג אוויר: יום 1 תמיד רגוע אך צורך הגרלה (נאמנות רצף)', () => {
  const a = new Tp3Rng(555), b = new Tp3Rng(555);
  assert.equal(rollWeather(a, 1).stormPort, null);
  b.random(8); // הצריכה המקבילה
  assert.equal(a.random(30), b.random(30)); // הרצפים מסונכרנים
});

test('מזג אוויר: ימים 2+ — סערה בשיעור 3/8, נמל אחיד', () => {
  const rng = new ModernRng(23);
  const N = 160000;
  let storms = 0;
  const portCounts = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const w = rollWeather(rng, 3);
    if (w.stormPort !== null) { storms++; portCounts[w.stormPort]++; }
  }
  assert.ok(Math.abs(storms / N - 3 / 8) < 0.01, `שיעור סערות ${storms / N}`);
  for (const c of portCounts) assert.ok(Math.abs(c / storms - 1 / 3) < 0.02);
});

// ---------- אימות צולב: המנוע במצב אותנטי ----------

test('אותנטי: מחירי יום שלם עם Tp3Rng — חוקיים ודטרמיניסטיים', () => {
  const p1 = rollDailyPrices(new Tp3Rng(0xBEEF));
  const p2 = rollDailyPrices(new Tp3Rng(0xBEEF));
  assert.deepEqual(p1, p2);
  for (let port = 0; port < 3; port++) {
    assert.ok(p1[port][0] >= 2500 && p1[port][0] <= 3500);
    assert.ok(p1[port][1] >= 350 && p1[port][1] <= 650);
    assert.ok(p1[port][2] >= 35 && p1[port][2] <= 70);
  }
});
