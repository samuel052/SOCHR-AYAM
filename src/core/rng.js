// core/rng.js — מחוללי המספרים האקראיים של הרימיקס
// מקור: פרק 2 (פענוח K.com) — Randomize @0x0F14, LCG @0x10E6, Random @0x10DA
//
// שני מימושים מאחורי ממשק אחיד { random(n) → 0..n-1 }:
//   1. Tp3Rng   — המחולל האותנטי של Turbo Pascal 3 (זהה ביט-ביט למקור).
//   2. ModernRng — mulberry32 (חלופה אופציונלית, שאינה חלק ממנוע המקור).

/** המחולל האותנטי של TP3.
 *  RandSeed := (RandSeed × 129 + 0x361962E9) mod 2^32          // פרק 2 §א.3
 *  Random(n) = (HighWord(RandSeed) >> 1) mod n                 // פרק 2 §א.4
 */
export class Tp3Rng {
  /** @param {number} seed זרע 32 ביט */
  constructor(seed = 0x2E024489) { // הזרע המהודר בקובץ המקורי (נדרס ב-Randomize)
    this.seed = seed >>> 0;
  }

  /** Randomize של המקור: הזרע נבנה משעון DOS — CX=(שעה<<8)|דקה, DX=(שנייה<<8)|מאיות.
   *  seed = (CX << 16) | DX.  (פרק 2 §א.2) */
  randomizeFromClock(date = new Date()) {
    const cx = ((date.getHours() & 0xff) << 8) | (date.getMinutes() & 0xff);
    const dx = ((date.getSeconds() & 0xff) << 8) | (Math.floor(date.getMilliseconds() / 10) & 0xff);
    this.seed = (((cx << 16) >>> 0) | dx) >>> 0;
  }

  /** מקדם את הזרע ומחזיר שלם ב-[0,n-1] — בדיוק כמו call 0x10DA.
   *  המודולו יוצר הטיה זעירה כש-n אינו מחלק את 32768; n=0 הוא שגיאת חלוקה במקור. */
  random(n) {
    if (!Number.isInteger(n) || n <= 0) throw new RangeError('Turbo Pascal Random(n) requires n > 0');
    // seed*129 < 2^39 — בטוח בתחום ה-double של JS
    this.seed = (this.seed * 129 + 0x361962E9) % 0x100000000;
    const high = (this.seed >>> 16) & 0xffff; // המילה הגבוהה
    return (high >> 1) % n;
  }
}

/** mulberry32 — מחולל מודרני קטן ואיכותי. */
export class ModernRng {
  constructor(seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0) {
    this.seed = seed >>> 0;
  }
  random(n) {
    this.seed = (this.seed + 0x6d2b79f5) >>> 0;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(u * n);
  }
}

/** יוצר RNG לפי מצב המשחק. @param {'authentic'|'modern'} mode */
export function createRng(mode = 'authentic', seed = undefined) {
  if (mode === 'authentic') {
    const r = new Tp3Rng(seed);
    if (seed === undefined) r.randomizeFromClock();
    return r;
  }
  return new ModernRng(seed);
}
