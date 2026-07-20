// core/actions.js — פעולות התפריט הראשי: מסחר, בנק, תיקון
// מקור: פרק 8 §3–5

/** קנייה (פרק 8 §3): המקור מחשב מחיר ב-Real ומוסיף Trunc(tons) למלאי.
 *  עורך הקלט מקבל רק ספרות, ולכן במסלול שחקן tons תמיד שלם; אין בדיקת קיבולת. */
export function buy(state, good, tons) {
  if (tons <= 0) return { ok: false, reason: 'invalid' };
  const cost = state.prices[state.location][good] * tons;
  if (cost > state.cash) return { ok: false, reason: 'noCash' }; // "כספך אינו מאפשר לך"
  state.cash -= cost;
  const cargoTons = Math.trunc(tons);
  state.cargo[good] += cargoTons;
  return { ok: true, cost, cargoTons };
}

/** מכירה: ההכנסה מחושבת ב-Real ומן המלאי נגרע Trunc(tons).
 *  עורך המקור אינו מאפשר ליצור שבר, ולכן ההתנהגות הנגישה היא של טונות שלמים. */
export function sell(state, good, tons) {
  if (tons <= 0) return { ok: false, reason: 'invalid' };
  if (tons > state.cargo[good]) return { ok: false, reason: 'noCargo' }; // "אין לך כל-כך הרבה"
  const income = state.prices[state.location][good] * tons;
  const cargoTons = Math.trunc(tons);
  state.cargo[good] -= cargoTons;
  state.cash += income;
  return { ok: true, income, cargoTons };
}

/** הפקדה בבנק (פרק 8 §4): ללא עמלה וללא ריבית. הבנק תמיד פתוח (קוד-מת במקור). */
export function deposit(state, amount) {
  if (amount <= 0) return { ok: false, reason: 'invalid' };
  if (amount > state.cash) return { ok: false, reason: 'noCash' };
  state.cash -= amount;
  state.bank += amount;
  return { ok: true };
}

/** משיכה מהבנק (פרק 8 §4). */
export function withdraw(state, amount) {
  if (amount <= 0) return { ok: false, reason: 'invalid' };
  if (amount > state.bank) return { ok: false, reason: 'noBank' }; // "אין לך סכום כזה בבנק"
  state.bank -= amount;
  state.cash += amount;
  return { ok: true };
}

/** תיקון (פרק 8 §5): 1 ש"ח = 1 יחידת נזק, מהמזומן.
 *  הרציף סגור ביום dockClosedDay ("תאלץ להמתין עד מחר"). */
export function repair(state, amount) {
  if (state.day === state.dockClosedDay) return { ok: false, reason: 'dockClosed' };
  if (amount <= 0) return { ok: false, reason: 'invalid' };
  if (amount > state.cash) return { ok: false, reason: 'noCash' };
  const applied = Math.min(amount, state.damage);
  // המקור מאפשר לשלם יותר מן הנזק: כל הסכום יורד, והנזק נחתך לאפס.
  state.cash -= amount;
  state.damage = Math.max(0, state.damage - amount);
  return { ok: true, applied, spent: amount, remaining: state.damage };
}

/** בדיקת פשיטת רגל (פרק 8 §5, שגרה 0xB4E2): נזק > מזומן+בנק+שווי-מטען → סוף משחק. */
export function isBankrupt(state, cargoValueFn) {
  return state.damage > state.cash + state.bank + cargoValueFn(state);
}
