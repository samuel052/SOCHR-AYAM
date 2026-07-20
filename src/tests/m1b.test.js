// tests/m1b.test.js — בדיקות שאר מודולי הליבה + סימולציית משחקים מלאים
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModernRng, Tp3Rng } from '../core/rng.js';
import { newGame, beginDay, cargoValue, totalCargo } from '../core/state.js';
import { loseCargoPercent, loseCash, shipDamage, jettison } from '../core/loss.js';
import { attemptEscape, fight } from '../core/pirates.js';
import { sail, voyageRisk, guardShipPrice, navErrorDest, completeVoyageAfterPirates } from '../core/voyage.js';
import { buy, sell, deposit, withdraw, repair } from '../core/actions.js';
import { startDay, endDay, finalScore } from '../core/game.js';
import { rollDailyEvent, eventCategory } from '../core/events.js';
import { ISRAEL, TURKEY, EGYPT } from '../core/constants.js';

const mkState = (over = {}) => Object.assign(newGame(new ModernRng(1)), over);

// ---------- שגרת ההפסד (פרק 6 §4) ----------

test('הפסד-מטען: 20–40% מהסחורה הראשונה עם >2 טון, מינ׳ 1', () => {
  const rng = new ModernRng(2);
  for (let i = 0; i < 5000; i++) {
    const s = mkState({ cargo: [0, 2, 50] }); // נחושת 0, זיתים 2 (לא >2) → חיטה
    const res = loseCargoPercent(s, rng);
    assert.equal(res.good, 2);
    assert.ok(res.tons >= 10 && res.tons <= 20); // 20–40% מ-50
    assert.equal(s.cargo[2], 50 - res.tons);
  }
});

test('גניבת מזומן: Trunc(cash/(40..79))×10 — כ-12.5%–25%', () => {
  const rng = new ModernRng(3);
  for (let i = 0; i < 5000; i++) {
    const s = mkState({ cash: 8000 });
    const stolen = loseCash(s, rng);
    assert.ok(stolen >= Math.trunc(8000 / 79) * 10 && stolen <= Math.trunc(8000 / 40) * 10);
  }
});

test('נזק ספינה: max(100, Trunc(רכוש/(50..79))×10)', () => {
  const rng = new ModernRng(4);
  const sSmall = mkState({ cash: 100 });
  assert.equal(shipDamage(sSmall, rng), 100); // מינימום 100
  for (let i = 0; i < 3000; i++) {
    const s = mkState({ cash: 10000 });
    const d = shipDamage(s, rng);
    assert.ok(d >= Math.trunc(10000 / 79) * 10 && d <= Math.trunc(10000 / 50) * 10);
  }
});

test('השלכת עומס: מעל 3×קיבולת — חיתוך מדויק לעודף מהסחורה הגדולה', () => {
  const rng = new ModernRng(5);
  const s = mkState({ capacity: 100, cargo: [200, 150, 30] }); // 380 > 300
  const res = jettison(s, rng);
  assert.equal(res.good, 0);
  assert.equal(res.tons, 80); // 380−300
  assert.equal(totalCargo(s), 300);
});

// ---------- שודדים (פרק 7) ----------

test('בריחה: בלתי אפשרית מעל 81% מטען', () => {
  const rng = new ModernRng(6);
  for (let i = 0; i < 300; i++) {
    const s = mkState({ capacity: 100, cargo: [82, 0, 0] });
    const r = attemptEscape(s, rng);
    assert.equal(r.escaped, false);
    assert.equal(r.reason, 'weight'); // 82 > 50% קיבולת
  }
});

test('בריחה: ספינה ריקה ותקינה ≈ 75%', () => {
  const rng = new ModernRng(7);
  let esc = 0;
  const N = 40000;
  for (let i = 0; i < N; i++) {
    const s = mkState();
    if (attemptEscape(s, rng).escaped) esc++;
  }
  assert.ok(Math.abs(esc / N - 0.75) < 0.01, `שיעור בריחה ${esc / N}`);
});

test('קרב: הסתברויות ניצחון לפי משמר — 1/6, 25%, 50%, 75%', () => {
  const rng = new ModernRng(8);
  const expected = [1 / 6, 0.25, 0.5, 0.75];
  for (let g = 0; g <= 3; g++) {
    let wins = 0;
    const N = 40000;
    for (let i = 0; i < N; i++) {
      const s = mkState({ guards: g, cash: 1000 });
      if (fight(s, rng).type === 'victory') wins++;
    }
    assert.ok(Math.abs(wins / N - expected[g]) < 0.01, `משמר=${g}: ${wins / N}`);
  }
});

test('קרב-תבוסה: כל המשמר אובד; בניצחון לכידה או מטמון (לא שניהם)', () => {
  const rng = new ModernRng(9);
  for (let i = 0; i < 2000; i++) {
    const s = mkState({ guards: 3, cash: 5000 });
    const r = fight(s, rng);
    if (r.type === 'defeat') assert.equal(s.guards, 0);
    else if (r.captured) {
      assert.equal(r.treasure, 0);
    } else {
      assert.ok(r.treasure >= 100);
      assert.equal(r.treasure % 5, 0);
    }
  }
});

// ---------- הפלגה (פרק 6) ----------

test('סיכון: יום נקי=0, יום+סערה=3, לילה=2, לילה+סערה=4', () => {
  const s = mkState({ location: ISRAEL, stormPort: null, hour: 8 });
  assert.equal(voyageRisk(s, TURKEY, 12), 0);
  s.stormPort = TURKEY;
  assert.equal(voyageRisk(s, TURKEY, 12), 3);
  assert.equal(voyageRisk(s, TURKEY, 17), 4);
  s.stormPort = null;
  assert.equal(voyageRisk(s, TURKEY, 17), 2);
});

test('הפלגת יום נקייה ללא נזק — לעולם אין מפגע-מסע (k=1)', () => {
  const rng = new ModernRng(10);
  for (let i = 0; i < 3000; i++) {
    const s = mkState({ location: ISRAEL, hour: 8, stormPort: null });
    const r = sail(s, rng, TURKEY);
    const hazardTypes = ['storm', 'aground', 'worsened', 'damaged'];
    assert.ok(!r.events.some((e) => hazardTypes.includes(e.type)));
  }
});

test('סטיית ניווט דטרמיניסטית: ישראל→תורכיה, אחרת→ישראל', () => {
  assert.equal(navErrorDest(ISRAEL), TURKEY);
  assert.equal(navErrorDest(TURKEY), ISRAEL);
  assert.equal(navErrorDest(EGYPT), ISRAEL);
});

test('מחיר ספינת משמר: מינ׳ 75, כפולת 5, +שליש בסערה', () => {
  const rng = new ModernRng(11);
  for (let i = 0; i < 3000; i++) {
    const s = mkState({ cash: 100 });
    const p = guardShipPrice(s, rng);
    assert.ok(p >= 75 && p % 5 === 0);
  }
});

// ---------- אירועים (פרק 3) ----------

test('בורר מועמד: אין חזרת קטגוריה יומיים ברצף', () => {
  const rng = new ModernRng(12);
  const s = mkState({ day: 6, cash: 100 });
  let prevCat = null;
  for (let i = 0; i < 20000; i++) {
    const R = rollDailyEvent(s, rng);
    assert.ok(R >= 1 && R <= 30);
    if (prevCat !== null) assert.notEqual(eventCategory(R), prevCat);
    prevCat = eventCategory(R);
  }
});

test('שער עשיר: מזומן גבוה מטה לעבר הרחבה (R=15)', () => {
  const rng = new ModernRng(13);
  const s = mkState({ cash: 100000, day: 3 });
  let r15 = 0;
  const N = 30000;
  for (let i = 0; i < N; i++) {
    s.prevEventR = 0;
    if (rollDailyEvent(s, rng) === 15) r15++;
  }
  // שני שערים של 1/6 מעל הבסיס 1/30 — שיעור R=15 חייב להיות גבוה משמעותית
  assert.ok(r15 / N > 0.2, `שיעור R=15 לעשיר: ${r15 / N}`);
});

test('הרחבת ספינה: תשלום מן הבנק כשהוא הרכיב שמכסה את המחיר', async () => {
  const { eventExpansionOffer } = await import('../core/events.js');
  const rng = new ModernRng(21);
  for (let i = 0; i < 500; i++) {
    const s = mkState({ cash: 0, bank: 5000, capacity: 100 });
    const ev = eventExpansionOffer(s, rng);
    assert.ok(ev);
    assert.ok(ev.cost >= 1000 && ev.cost <= 2990);
    assert.equal(ev.payment.bank, ev.cost);
    ev.accept();
    assert.equal(s.bank, 5000 - ev.cost);
    assert.equal(s.cash, 0);
    assert.equal(s.capacity, 100 + ev.tons);
  }
});

// ---------- פעולות (פרק 8) ----------

test('מסחר/בנק/תיקון: חוקי היסוד', () => {
  const s = mkState({ cash: 5000 });
  s.prices = [[3000, 500, 50], [3100, 400, 45], [2600, 350, 50]];
  s.location = ISRAEL;
  assert.equal(buy(s, 1, 5).ok, true);       // 5×400=2000
  assert.equal(s.cash, 3000);
  assert.equal(buy(s, 0, 100).ok, false);    // אין כסף
  assert.equal(sell(s, 1, 3).ok, true);
  assert.equal(deposit(s, 1000).ok, true);
  assert.equal(withdraw(s, 2000).ok, false); // אין בבנק
  s.damage = 500; s.dockClosedDay = 9;
  const rep = repair(s, 300);
  assert.equal(rep.applied, 300);
  assert.equal(s.damage, 200);
  s.day = 3; s.dockClosedDay = 3;
  assert.equal(repair(s, 100).reason, 'dockClosed');
});

// ---------- סימולציה: 1000 משחקים מלאים ----------

test('סימולציה: 1000 שבועות מלאים — שלמות מצב וללא ערכים בלתי-חוקיים', () => {
  for (let game = 0; game < 1000; game++) {
    const rng = game % 2 ? new ModernRng(1000 + game) : new Tp3Rng(1000 + game);
    const s = newGame(rng);
    while (!s.gameOver) {
      const { event } = startDay(s, rng);
      if (event?.accept && event.canAfford !== false) event.accept();
      event?.complete?.();
      // אסטרטגיית בוט פשוטה: קנה בזול, הפלג, מכור ביוקר
      const here = s.location;
      let cheap = 0;
      for (let c = 1; c < 3; c++) if (s.prices[here][c] < s.prices[here][cheap]) cheap = c;
      const afford = Math.trunc(s.cash / s.prices[here][cheap]);
      if (afford > 0) buy(s, cheap, Math.min(afford, s.capacity));
      const dest = (here + 1) % 3;
      const res = sail(s, rng, dest);
      if (res.pendingPirates) {
        const esc = attemptEscape(s, rng);
        if (!esc.escaped) fight(s, rng, true);
        completeVoyageAfterPirates(s, res.continuation);
      }
      for (let c = 0; c < 3; c++) if (s.cargo[c] > 0) sell(s, c, s.cargo[c]);
      if (s.damage > 0 && s.day !== s.dockClosedDay) repair(s, Math.min(s.cash, s.damage));
      endDay(s);
      // אינווריאנטות
      assert.ok(s.cash >= 0, 'מזומן שלילי');
      assert.ok(s.bank >= 0, 'בנק שלילי');
      assert.ok(s.cargo.every((t) => t >= 0), 'מטען שלילי');
      assert.ok(s.damage >= 0, 'נזק שלילי');
      assert.ok(s.capacity >= 100, 'קיבולת ירדה');
      assert.ok(s.day <= 8, 'לולאת ימים');
    }
    const score = finalScore(s);
    assert.ok(Number.isFinite(score) && score >= 0);
  }
});
