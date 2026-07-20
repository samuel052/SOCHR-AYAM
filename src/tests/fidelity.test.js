import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventCategory, eventTheft, eventTraderBuys, eventTraderSells, eventCollision, eventExpansionOffer, eventCrewDesertion } from '../core/events.js';
import { fight } from '../core/pirates.js';
import { guardShipPrice, sail, completeVoyageAfterPirates } from '../core/voyage.js';
import { rollDemand, resolveOffer } from '../core/negotiation.js';
import { ISRAEL, TURKEY, EGYPT } from '../core/constants.js';
import { buy, sell, deposit, withdraw, repair } from '../core/actions.js';
import { startDay, endDay } from '../core/game.js';

class SeqRng {
  constructor(values) { this.values = [...values]; this.calls = []; }
  random(n) {
    assert.ok(this.values.length, `חסרה תוצאת Random(${n})`);
    const value = this.values.shift();
    assert.ok(value >= 0 && value < n, `תוצאה ${value} מחוץ לטווח Random(${n})`);
    this.calls.push(n);
    return value;
  }
}

const state = (over = {}) => Object.assign({
  cash: 0, bank: 0, cargo: [0, 0, 0], damage: 0, capacity: 100,
  guards: 0, location: ISRAEL, hour: 8, stormPort: null,
}, over);

test('קטגוריות מניעת-החזרה תואמות את 15 זוגות המספרים בבינארי', () => {
  const ranges = Array.from({ length: 15 }, (_, i) => [2 * i + 1, 2 * i + 2]);
  ranges.forEach(([a, b], category) => {
    for (let r = a; r <= b; r++) assert.equal(eventCategory(r), category);
  });
});

test('דרישת צוות/כופר נשמרת כ-Real ללא קיטום והקבלה היא גדולה ממש', () => {
  const rng = new SeqRng([0]); // מחלק 4
  const s = state({ cash: 401 });
  const demand = rollDemand(s, rng); // 100.25, לא 100
  assert.equal(Number(demand), 100.25);
  assert.equal(resolveOffer(s, { cash: 100, tons: [0,0,0] }, demand), false);

  const s2 = state({ cash: 400 });
  const equalDemand = { numerator: 400, denominator: 4 };
  assert.equal(resolveOffer(s2, { cash: 100, tons: [0,0,0] }, equalDemand), false);
  assert.equal(resolveOffer(s2, { cash: 101, tons: [0,0,0] }, equalDemand), true);
});

test('גניבה מנסה מזומן גם מתחת ל-500 ורק אפס עובר למטען', () => {
  const cashState = state({ cash: 100 });
  const cashRng = new SeqRng([0]);
  assert.deepEqual(eventTheft(cashState, cashRng), { type: 'theft', kind: 'cash', amount: 20 });
  assert.deepEqual(cashRng.calls, [40]);

  const cargoState = state({ cargo: [10, 0, 0] });
  const cargoRng = new SeqRng([0, 0]);
  const result = eventTheft(cargoState, cargoRng);
  assert.equal(result.kind, 'cargo');
  assert.equal(result.good, 0);
  assert.equal(result.tons, 2);
  assert.deepEqual(cargoRng.calls, [40, 21]);
});

test('סוחר קונה את הסחורה הראשונה עם יותר מטון אחד, לא את הגדולה ביותר', () => {
  const s = state({ cash: 1000, cargo: [2, 100, 100], prices: [[3000,500,50]], location: 0 });
  const rng = new SeqRng([0]);
  const event = eventTraderBuys(s, rng);
  assert.equal(event.good, 0);
  assert.equal(event.tons, 2);
  assert.deepEqual(rng.calls, [30]);
});

test('סוחר מוכר: תקציב 25%–100% וכמות בכפולה הבאה של 5 לפי מחיר המרכז', () => {
  const s = state({ cash: 10000 });
  const rng = new SeqRng([2, 10, 0]);
  const event = eventTraderSells(s, rng);
  assert.equal(event.good, 2);
  assert.equal(event.price, 35);
  assert.equal(event.tons, 55);
  assert.equal(event.total, 1925);
  assert.deepEqual(rng.calls, [3, 50, 7501]);
});

test('התנגשות מכפילה את מנת הרכוש בעשר', () => {
  const s = state({ cash: 1000, cargo: [1, 0, 0] });
  const rng = new SeqRng([0]);
  const event = eventCollision(s, rng);
  assert.equal(event.damage, 260);
  assert.equal(s.damage, 260);
});

test('התנגשות בתוצאת נזק אפס מסומנת כלא־ישימה לצורך reroll', () => {
  const s = state({ cash: 0, cargo: [0, 0, 0] });
  assert.equal(eventCollision(s, new SeqRng([0])), null);
  assert.equal(s.damage, 0);
});

test('אירוע צוות נמצא בליבה: צוות חדש או מו״מ שנכשל מדלגים יום אחד בלבד', () => {
  const a = state({ day: 3, cash: 100 });
  assert.deepEqual(eventCrewDesertion(a).newCrew(), { accepted: false, dayLost: true });
  assert.equal(a.day, 4);

  const b = state({ day: 3, cash: 100 });
  const event = eventCrewDesertion(b);
  const demand = event.rollDemand(new SeqRng([0]));
  assert.deepEqual(event.negotiate({ cash: 0, tons: [0,0,0] }, demand), { accepted: false, dayLost: true });
  assert.equal(b.day, 4);
  assert.equal(eventCrewDesertion(state({ day: 6 })), null);
});

test('prevEvent נכתב רק בהשלמת מסך האירוע', () => {
  const s = state({ day: 2, prevEventR: 0, prices: [[0,0,0],[0,0,0],[0,0,0]] });
  // 9 מחירים, מזג-אוויר רגוע, R=1, שני שערים, נמל ועוצמת זעזוע.
  const rng = new SeqRng([0,0,0,0,0,0,0,0,0, 7, 0,0,0, 0,0]);
  const { event } = startDay(s, rng);
  assert.equal(event.R, 1);
  assert.equal(s.prevEventR, 0);
  assert.equal(event.complete(), true);
  assert.equal(s.prevEventR, 1);
  assert.equal(event.complete(), false);
});

test('תיקון־יתר גובה את כל הסכום וחותך את הנזק לאפס', () => {
  const s = state({ cash: 1000, damage: 100, day: 2, dockClosedDay: 7 });
  const result = repair(s, 250);
  assert.equal(result.ok, true);
  assert.equal(result.applied, 100);
  assert.equal(result.spent, 250);
  assert.equal(s.cash, 750);
  assert.equal(s.damage, 0);
});

test('מסחר משמר גם את פעולות ה-Real/Trunc הפנימיות (שבר אינו נגיש בעורך המקור)', () => {
  const s = state({ cash: 1000, cargo: [2,0,0], location: 0, prices: [[100,100,100],[100,100,100],[100,100,100]] });
  const bought = buy(s, 0, 1.9);
  assert.equal(bought.cost, 190);
  assert.equal(bought.cargoTons, 1);
  assert.equal(s.cargo[0], 3);
  const sold = sell(s, 0, 0.9);
  assert.equal(sold.income, 90);
  assert.equal(sold.cargoTons, 0);
  assert.equal(s.cargo[0], 3);
  assert.equal(s.cash, 900);
});

test('ליבת הבנק שומרת Real בלי קיטום (עורך המשתמש עצמו ספרתי בלבד)', () => {
  const s = state({ cash: 100 });
  assert.equal(deposit(s, 12.5).ok, true);
  assert.equal(s.cash, 87.5);
  assert.equal(s.bank, 12.5);
  assert.equal(withdraw(s, 2.25).ok, true);
  assert.equal(s.cash, 89.75);
  assert.equal(s.bank, 10.25);
});

test('ביום 7 עוברים לניקוד בלי בדיקת פשיטת רגל', () => {
  const s = state({ day: 7, cash: 0, bank: 0, cargo: [0,0,0], damage: 100 });
  endDay(s);
  assert.equal(s.gameOver, true);
  assert.equal(s.endReason, 'weekOver');
});

test('פשיטת רגל לפני היום האחרון כופה day=7 כמו הבינארי', () => {
  const s = state({ day: 3, cash: 0, bank: 0, cargo: [0,0,0], damage: 1 });
  endDay(s);
  assert.equal(s.gameOver, true);
  assert.equal(s.endReason, 'bankrupt');
  assert.equal(s.day, 7);
});

test('הרחבה במסלול מטען+השלמה בוחרת בנק כשהוא גדול מהמזומן ומהמטען', () => {
  const s = state({ cash: 100, bank: 500, cargo: [0, 0, 10], capacity: 100 });
  const rng = new SeqRng([0, 0]); // תוספת 50; מחיר 1000
  const event = eventExpansionOffer(s, rng);
  assert.deepEqual(event.payment, { cash: 0, bank: 500, tons: [0, 0, 10] });
  assert.equal(event.accept(), true);
  assert.equal(s.cash, 100);
  assert.equal(s.bank, 0);
  assert.deepEqual(s.cargo, [0, 0, 0]);
  assert.equal(s.capacity, 150);
});

test('הרחבה משמרת את באגי השוויון והעיגול לתשלום חסר', () => {
  const equality = eventExpansionOffer(
    state({ cash: 1000, bank: 0, cargo: [0, 1, 0] }),
    new SeqRng([0, 0]),
  );
  // cash==cost נופל למסלול מטען; נגבים זית אחד ועוד 500 בלבד.
  assert.deepEqual(equality.payment, { cash: 500, bank: 0, tons: [0,1,0] });

  const rounded = eventExpansionOffer(
    state({ cash: 0, bank: 0, cargo: [0, 3, 0] }),
    new SeqRng([0, 24]), // מחיר 1240; Round(1240/500)=2 => שווי 1000 בלבד
  );
  assert.equal(rounded.cost, 1240);
  assert.deepEqual(rounded.payment, { cash: 0, bank: 0, tons: [0,2,0] });
});

test('ניצחון: לכידה בלעדית למטמון ונזק נבדק ב-Random(4)', () => {
  const s = state({ cash: 1000, guards: 3 });
  const rng = new SeqRng([0, 0, 1, 3]);
  const result = fight(s, rng);
  assert.equal(result.captured, true);
  assert.equal(result.treasure, 0);
  assert.equal(s.capacity, 150);
  assert.deepEqual(rng.calls, [4, 6, 3, 4]);
});

test('מטמון משתמש ב-Int/floor ולא ב-Round', () => {
  const s = state({ cash: 1050, guards: 1 });
  const rng = new SeqRng([0, 0, 0, 2, 3]);
  const result = fight(s, rng);
  assert.equal(result.captured, false);
  assert.equal(result.treasure, 175);
  assert.deepEqual(rng.calls, [4, 6, 3, 15, 4]);
});

test('תבוסת שחקן עני מפעילה נזק ודאי מיוחד כולל הבנק', () => {
  const s = state({ cash: 400, bank: 600, guards: 0 });
  const rng = new SeqRng([2, 0, 0]);
  const result = fight(s, rng);
  assert.equal(result.type, 'defeat');
  assert.equal(result.plunder, null);
  assert.equal(result.damage, 350);
  assert.deepEqual(rng.calls, [4, 6, 15]);
});

test('מחיר משמר כולל מכפיל 5 ותוספת שליש לכל risk>0', () => {
  const calm = new SeqRng([50]);
  assert.equal(guardShipPrice(state({ cash: 5000 }), calm, 0), 100);
  const risky = new SeqRng([50]);
  assert.equal(guardShipPrice(state({ cash: 5000 }), risky, 2), 130);
});

test('סערה עם מטען יקר גורמת אובדן מטען בלבד וצורכת גם Random(20)', () => {
  const s = state({ cash: 1000, cargo: [4,0,0], stormPort: TURKEY });
  const rng = new SeqRng([1, 1, 1, 0, 7]);
  const result = sail(s, rng, TURKEY);
  assert.equal(result.events[0].type, 'storm');
  assert.equal(result.events[0].damage, 0);
  assert.equal(result.events[0].lost.tons, 1);
  assert.equal(s.damage, 0);
  assert.deepEqual(rng.calls, [7, 2, 3, 21, 20]);
});

test('ערפל: תנאי הזמן ללא +2, חזרה עולה משך מסלול, ו-Random(20) עדיין נצרך', () => {
  const s = state({ location: ISRAEL, hour: 8 });
  const rng = new SeqRng([0, 0, 0, 1, 5]);
  const result = sail(s, rng, TURKEY);
  assert.equal(result.returnedToOrigin, true);
  assert.equal(result.events[0].type, 'fog');
  assert.equal(s.hour, 12);
  assert.deepEqual(rng.calls, [1, 2, 12, 2, 20]);
});

test('סטיית ניווט ממצרים לישראל שמגיעה לתורכיה מוסיפה ארבע שעות', () => {
  const s = state({ location: EGYPT, hour: 8 });
  const rng = new SeqRng([0, 0, 1, 6]);
  const result = sail(s, rng, ISRAEL);
  assert.equal(result.arrivedAt, TURKEY);
  assert.equal(s.hour, 16);
  assert.deepEqual(rng.calls, [1, 2, 12, 20]);
});

test('הפלגה ישירה ממצרים לתורכיה נשארת שמונה שעות', () => {
  const s = state({ location: EGYPT, hour: 8 });
  const rng = new SeqRng([0, 0, 1, 7]);
  const result = sail(s, rng, TURKEY);
  assert.equal(result.arrivedAt, TURKEY);
  assert.equal(s.hour, 16);
  assert.deepEqual(rng.calls, [1, 2, 12, 20]);
});

test('ספינה נטושה נעצרת בסחורה הראשונה שכמותה חיובית', () => {
  const s = state({ cash: 10000 });
  const rng = new SeqRng([0, 0, 1, 8, 24]); // R2=9; נחושת 35% => טון אחד
  const result = sail(s, rng, TURKEY);
  const derelict = result.events.find((e) => e.type === 'derelict');
  assert.deepEqual(derelict.found, [1, 0, 0]);
  assert.deepEqual(s.cargo, [1, 0, 0]);
  assert.deepEqual(rng.calls, [1, 2, 12, 20, 25]);
});

test('חסימות הפלגה אינן צורכות RNG', () => {
  for (const [over, reason] of [[{hour:17},'late'], [{damage:1001},'damage'], [{hour:15,location:TURKEY},'arrival']]) {
    const s = state(over);
    const rng = new SeqRng([]);
    assert.equal(sail(s, rng, EGYPT).blocked, reason);
    assert.deepEqual(rng.calls, []);
  }
});

test('מפגש פיראטים משאיר את המצב במוצא ובשעת האמצע עד להשלמת ההפלגה', () => {
  const s = state({ location: ISRAEL, hour: 8 });
  const rng = new SeqRng([0, 0, 1, 0]); // R2=1 => פיראטים
  const result = sail(s, rng, TURKEY);
  assert.equal(result.pendingPirates, true);
  assert.equal(s.location, ISRAEL);
  assert.equal(s.hour, 10);
  assert.equal(result.finalDest, TURKEY);
  assert.equal(completeVoyageAfterPirates(s, result.continuation), true);
  assert.equal(s.location, TURKEY);
  assert.equal(s.hour, 12);
});
