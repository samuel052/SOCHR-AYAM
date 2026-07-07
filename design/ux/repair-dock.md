# UX Spec: רציף התיקונים (Repair Dock)

> **Status**: Approved for implementation (autonomous authoring; revisions welcome)
> **Author**: ux-designer על בסיס `אפיון מסכי משחק.docx` §רציף תיקונים, GDD ship-damage-repair
> **Last Updated**: 2026-07-08 | **Journey Phase(s)**: התאוששות מנזק
> **Template**: UX Spec

## Purpose & Player Need

"לשלם כדי לחזור לים" — ובמצב חמור (נזק>1,000): להבין בדיוק כמה חסר כדי להשתחרר.

## Player Context on Arrival

לרוב אחרי אירוע נזק; לפעמים בלחץ (חסום להפלגה). המסך חייב להציג את סף ה־1,000 בבירור.

## Navigation Position / Entry & Exit

port-hub → **repair-dock** (hotspot/מקש 6; קיים רק כשנזק>0) → חזרה → port-hub.

## Layout Specification

הרציף בגדול והספינה עוגנת בו (docx). רכיבים:

- שורת מצב: "נזק נוכחי: 1,450 ש"ח" + סמן סף: "מעל 1,000 — הספינה מנועה מהפלגה".
- ‏Quantity Picker ‏(P4): סכום תיקון 1..min(cash, damage); כפתורי קיצור:
  "תקן הכול" | "תקן עד סף ההפלגה" (מוריד ל־1,000 בדיוק — מופיע רק כשנזק>1,000).
- תצוגה חיה: "נזק לאחר: X | מזומן לאחר: Y" + חיווי "ניתן להפליג ✓/✗".
- **רציף סגור** (20% מהימים — GDD §3.5): הסצנה עם שלט "סגור להיום", טקסט קצר,
  וכפתור חזרה בלבד. הפאנל מציג שהמצב יתאפס מחר.

## States & Variants

| מצב | טריגר | שינוי |
|---|---|---|
| פתוח | roll_dock_open()=true | מסך התיקון המלא |
| סגור | dock_closed_today | וריאנט "סגור להיום" |
| אין מזומן כלל | cash==0 (ויש בנק) | הפניה: "משוך מהבנק תחילה" + קיצור לבנק |
| תקוע באמת | ‏is_stuck | לא קורה כאן — GameEngine מסיים משחק |

## Interaction Map / Events Fired

‏Picker→"תקן" → ‏`repair(amount)`; ‏"dock_closed" מה־Result מציג את וריאנט הסגור
(המצב נקבע בכניסה הראשונה של היום — ההגרלה בקריאת repair/כניסה דרך GameFacade).

## Transitions & Animations

צליל פטישים בתיקון; פס הנזק יורד מונפש; ‏reduced-motion: מיידי.

## Data Requirements

קריאה: damage, cash, dock_closed_today, sail_block_damage (מה־snapshot/config).
כתיבה: `repair(x)`.

## Accessibility

חיווי "ניתן להפליג" בטקסט+אייקון; מסלול מקלדת מלא.

## Localization Considerations

נוסח "רציף סגור" מטבלת המחרוזות (תואם מסך המקור).

## Acceptance Criteria

- [ ] "תקן עד סף ההפלגה" מוריד את הנזק ל־1,000 בדיוק ומעדכן את חיווי ההפלגה מיד.
- [ ] רציף סגור מציג את הווריאנט הסגור ואינו מאפשר תיקון; למחרת פתוח תמיד.
- [ ] אי אפשר לשלם מעל הנזק (overpay נחסם) או מעל המזומן.
- [ ] ה־hotspot ב־hub נעלם כשנזק==0 אחרי תיקון מלא.
- [ ] מסלול מקלדת מלא + focus נראה.

## Open Questions

- ‏QQ-UX-07: הצעת "משוך מהבנק" בתוך המסך — קיצור נוח או עומס? הנחת עבודה: קישור טקסטואלי בלבד.
