# UX Spec: הבנק (Bank)

> **Status**: Approved for implementation (autonomous authoring; revisions welcome)
> **Author**: ux-designer על בסיס `אפיון מסכי משחק.docx` §מסך הפקדה, GDD banking
> **Last Updated**: 2026-07-08 | **Journey Phase(s)**: ניהול סיכונים
> **Template**: UX Spec

## Purpose & Player Need

"לנעול רווחים מפני גניבה ופיראטים / לשחרר מזומן לקנייה." שתי פעולות סימטריות,
מהירות, ללא חיכוך.

## Player Context on Arrival

יזום, לרוב אחרי מכירה גדולה (הפקדה) או לפני קנייה (משיכה). ההקשר: פחד מגניבה —
המסך יכול לרמוז זאת בעדינות (שלט "כספך שמור עמנו").

## Navigation Position / Entry & Exit

port-hub → **bank** (hotspot/מקש 4) → חזרה (כפתור/Esc) → port-hub.

## Layout Specification

חדר בנק (לפי docx): שני פקידים — דלפק "הפקדה" ודלפק "משיכה". לחיצה על דלפק
פותחת כרטיס עם Quantity Picker ‏(P4): טווח 1..מזומן (הפקדה) / 1..יתרה (משיכה),
כפתורי "מקס'", תצוגה חיה "מזומן לאחר / בבנק לאחר". שתי היתרות מוצגות גם בפאנל ה־HUD.

```text
┌─[Info Bar]────────────────────────────┐
│   🧑‍💼 הפקדה          🧑‍💼 משיכה        │
│   ┌─ הפקדה ─────────────┐             │
│   │ סכום [◄═●═►][2,000] │             │
│   │ [מקס'] בבנק לאחר: 5,000│           │
│   │   [ הפקד ] [ ביטול ]  │            │
│   └──────────────────────┘             │
│                     [⇦ חזרה לנמל]      │
```

## States & Variants

| מצב | טריגר | שינוי |
|---|---|---|
| אין מזומן | cash==0 | דלפק הפקדה מעומעם + טולטיפ |
| אין יתרה | bank==0 | דלפק משיכה מעומעם |

## Interaction Map / Events Fired

דלפק→Picker→"הפקד"/"משוך" → ‏`deposit(x)` / `withdraw(x)`; ‏Result כושל מציג
שגיאה מקומית. אין אירועים נוספים.

## Transitions & Animations

‏slide-in; צליל מטבעות בעסקה; ספירה מונפשת בפאנל (reduced-motion: מיידי).

## Data Requirements

קריאה: cash, bank. כתיבה: deposit/withdraw דרך GameFacade.

## Accessibility

מסלול מקלדת מלא; סכומים בפורמט Format.gd; שגיאות בטקסט.

## Localization Considerations

תוויות קצרות; ללא מטבע-סימן קשיח (מהטבלה: "ש\"ח").

## Acceptance Criteria

- [ ] הפקדה/משיכה שלמה ב־≤3 קליקים מה־hub.
- [ ] ‏cash+bank נשמר קבוע בכל עסקה (מוצג נכון בפאנל).
- [ ] דלפק לא רלוונטי מעומעם עם הסבר.
- [ ] ניסיון משיכת־יתר נחסם עם הודעה (ולא שגיאה שקטה).
- [ ] מסלול מקלדת מלא + focus נראה.

## Open Questions

— אין.
