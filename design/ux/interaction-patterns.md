# Interaction Pattern Library

> **Status**: Approved for implementation (autonomous authoring per owner's "המשך לאפיון"; revisions welcome)
> **Author**: ux-designer (agent) על בסיס `אפיון מסכי משחק.docx` + צילומי המקור
> **Last Updated**: 2026-07-08
> **Template**: Interaction Pattern Library

---

## Overview

המשחק הוא hub-and-overlay ‏(ADR-0007): מסך נמל מתמשך, מסכי פעולה מלאים, ושכבות
מודאליות לאירועים והחלטות. עכבר הוא הקלט הראשי; כל דפוס חייב להיות משוחק
בעכבר בלבד (TR-ARCH-009), עם מקלדת כקיצור. כל הטקסט עברית RTL ‏(ADR-0006).

## Pattern Catalog

| # | דפוס | קטגוריה | בשימוש |
|---|------|----------|--------|
| P1 | Hub Hotspot | Navigation | port-hub |
| P2 | Event Card | Modal | day-events, voyage, pirates |
| P3 | Decision Dialog | Modal | day-events (סוחר/expand/צוות), pirates |
| P4 | Quantity Picker | Input | market, bank, repair, pirates (פשרה), crew |
| P5 | Price Board | Data Display | port-hub, market |
| P6 | Info Bar | Data Display | כל המסכים (hud.md) |
| P7 | Confirm Bar | Input | אזהרות הפלגה, סיום יום 7 |
| P8 | Modal Barrier | Overlay | כל המודאלים |

---

## Patterns

### P1 — Hub Hotspot

**Category**: Navigation | **Used In**: port-hub

**Description**: אזור אינטראקטיבי בציור הנמל (שוק, בנק, רציף, לוח מודעות, מזח,
פונדק). לחיצה מנווטת למסך הפעולה. שקול לתפריט 5–6 האפשרויות של המקור.

**Specification**:
- ‏hover: הבהרת האזור + תווית שם בעברית + שינוי סמן ליד; ‏click: ניווט.
- מצב מנוטרל (למשל רציף כשאין נזק): עמעום + tooltip "אין נזק לתיקון".
- מקלדת: מספרים 1–6 במיפוי תפריט המקור (1 לקנות, 2 למכור, 3 לנסוע, 4 בנק, 5 לנוח, 6 לתקן).
- נגישות: לכל hotspot תווית טקסט גלויה ב־hover ובניווט מקלדת (focus ring).

**When to Use**: פעולות הליבה בנמל. **When NOT**: פעולות משנה (הגדרות — אייקון קבוע ב־Info Bar).

### P2 — Event Card

**Category**: Modal | **Used In**: הכרזות יום, אירועי בוקר מיידיים, אירועי הפלגה

**Description**: כרטיס מודאלי במרכז המסך: איור פיקסל־ארט, כותרת, גוף טקסט
(נוסח המקור מטבלת המחרוזות, מסומן `# original`), וכפתור "המשך" יחיד.

**Specification**:
- נפתח מעל Modal Barrier ‏(P8); ‏"המשך" בעכבר, ‏Enter/רווח במקלדת.
- אין timeout — הכרטיס נשאר עד אישור (קהל היעד מבוגר; אין לחץ זמן).
- רצף כרטיסים (יום←מזג אוויר←אירוע) מוצג בזה אחר זה, לא בערימה.
- אנימציית כניסה 150ms fade+scale; מכובדת ע"י reduced-motion (חיתוך מיידי).

### P3 — Decision Dialog

**Category**: Modal | **Used In**: expand, סוחר קונה/מוכר, שביתת צוות, פיראטים

**Description**: ‏Event Card עם 2–3 כפתורי החלטה במקום "המשך"; ממומש מעל
`decision_required(pd)` — ‏DecisionRouter ממפה kind→דיאלוג (ADR-0007).

**Specification**:
- הכפתורים נגזרים מ־PendingDecision.kind; אין כפתור "סגור" — חובה להחליט (כמו במקור).
- החלטות עם קלט (מו"מ צוות, פשרה) מטמיעות Quantity Picker ‏(P4) בגוף הדיאלוג.
- תשובה לא חוקית (הצעה מעל המצוי) — הדיאלוג נשאר פתוח + הודעת שגיאה מקומית אדומה+אייקון.
- ‏Esc אינו סוגר (אין ביטול להחלטות המקור); ‏Tab בין כפתורים.

### P4 — Quantity Picker

**Category**: Input | **Used In**: קניה/מכירה, בנק, תיקון, פשרה, מו"מ צוות

**Description**: בחירת סכום/כמות: ‏slider + שדה מספר + כפתורי "מקס'" ו"אפס",
עם שורת תצוגה חיה של המשמעות ("עלות: 3,300 ש"ח" / "יתרה לאחר: 1,700").

**Specification**:
- טווח נגזר מהמצב (מקס' קניה = cash/price; מכירה = מלאי; תיקון = min(cash, damage)).
- קלט מקלדת ישיר בשדה; חיצים ±1; ‏PgUp/PgDn ±10. ולידציה חיה, כפתור אישור מנוטרל כשלא חוקי.
- מספרים בפורמט עברי עם מפריד אלפים דרך `Format.gd` ‏(ADR-0006).

### P5 — Price Board

**Category**: Data Display | **Used In**: port-hub (תחתית), market

**Description**: טבלת 3×3 של מחירי הסחורות בשלושת הנמלים — שחזור לוח המחירים
התחתון של המקור. הנמל הנוכחי מודגש; מחיר ששונה באירוע בוקר מסומן חץ ↑/↓ + צבע.

**Specification**:
- קריאה בלבד; ‏hover על תא מציג tooltip ‏"נחושת במרסין: 2,600 ש"ח לטון".
- סימון חריגה אינו בצבע בלבד (חץ + הדגשה) — עיוורון צבעים.

### P6 — Info Bar

ראו `design/ux/hud.md` (שורת המידע העליונה + פאנל המטען).

### P7 — Confirm Bar

**Category**: Input | **Used In**: אזהרת לילה, אזהרת עומס, מנוחה ביום 7 עם סחורה

**Description**: דיאלוג אישור דו־כפתורי ("להפליג בכל זאת" / "לחזור") עם טקסט
האזהרה של המקור. ברירת המחדל בפוקוס היא הבחירה הבטוחה.

### P8 — Modal Barrier

**Category**: Overlay | **Used In**: כל המודאלים

**Specification**: ‏ColorRect מלא (שחור 55%) שבולע קלט עכבר; ‏`is_modal_open`
מנטרל קיצורי מקלדת של ה־hub ‏(ADR-0007 §5, זהירות dual-focus של 4.6).
מודאל־על־מודאל אסור — DecisionRouter מציג בתור (queue).

---

## Gaps & Patterns Needed

- דפוס אנימציית הפלגה (ספינה חוצה מפה/ים חי) — יוגדר ב־voyage.md; לא דפוס גנרי.
- דפוס הזנת שם לשיא (שדה טקסט עברי יחיד) — פשוט דיו; מתועד ב־endgame-hiscores.md.

## Open Questions

- ‏QQ-UX-01: האם להציג את תפריט 1–6 הטקסטואלי של המקור גם כרשימה גלויה (נוסטלגיה) או קיצורי מקלדת בלבד? הנחת עבודה: קיצורים + תוויות ב־hover; לבחינת פלייטסט.
