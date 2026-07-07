# Systems Index — רימייק "סוחר הים"

> נוצר: 2026-07-07. מקור אמת ללוגיקה: מסמכי פיענוח הבינארי
> (`רימיקס לסוחר הים/מנגנון הפעלה והגרלת סיכויים ואירועים/`).
> פערים מולאו מ`התפלגות סיכויים.txt` ומסומנים ⚠️ לאימות DOSBox.
>
> **מוסכמה בכל ה־GDDs**: `rand(n)` = מספר שלם אחיד בטווח `0..n-1`
> (כמו `random(n)` של Turbo Pascal). חלוקה שלמה = קיטום (`div`), אלא אם צוין אחרת.

## רשימת מערכות לפי סדר תכן

| # | מערכת | קובץ | שכבה | סטטוס |
|---|-------|------|------|-------|
| 1 | זמן ולוח שנה | `time-calendar.md` | Foundation | Draft |
| 2 | שוק ומחירים | `market-prices.md` | Foundation | Draft |
| 3 | מסחר (קניה/מכירה) | `trading.md` | Core | Draft |
| 4 | בנק | `banking.md` | Core | Draft |
| 5 | ספינה, נזק ותיקון | `ship-damage-repair.md` | Core | Draft |
| 6 | אירועי בוקר | `morning-events.md` | Core | Draft |
| 7 | מנוע הפלגה ואירועי ים | `sailing-engine.md` | Core | Draft |
| 8 | שודדי ים | `pirates.md` | Core | Draft |
| 9 | ניקוד, סיום ושיאים | `scoring-endgame.md` | Feature | Draft |

מערכות Presentation (מסכים, נמל אינטראקטיבי, מסך הפלגה חי) יאופיינו
ב־`design/ux/` על בסיס `רימיקס לסוחר הים/אפיון מסכי משחק.docx` — לא GDD.

## מפת תלויות

```text
time-calendar ──────┐
market-prices ──────┼──> trading ──┐
                    │              ├──> morning-events
banking ────────────┤              │
ship-damage-repair ─┼──────────────┼──> sailing-engine ──> pirates
                    │              │
                    └──────────────┴──> scoring-endgame
```

- **time-calendar**: אין תלויות. כולם תלויים בו.
- **market-prices**: תלוי ב־time-calendar (מחירים נקבעים בתחילת יום). אירועי בוקר כותבים אליו מחירים חריגים.
- **trading**: תלוי ב־market-prices (מחירי נמל נוכחי) וב־ship (קיבולת אינפורמטיבית בלבד — מותר לקנות מעבר).
- **banking**: תלוי ב־time-calendar בלבד. משפיע על חישובי "הון כולל" בחלק מהאירועים ⚠️.
- **ship-damage-repair**: נזק נכתב ע"י אירועי בוקר, הפלגה ופיראטים; חוסם הפלגה מעל 1,000 ש"ח.
- **morning-events**: קורא/כותב מחירים, מטען, כסף, קיבולת, נזק, ימים (שביתת צוות מדלגת ימים).
- **sailing-engine**: קורא מזג אוויר, שעה, מטען/קיבולת, נזק; מפעיל את pirates; כותב נזק/מטען/מיקום/שעה.
- **pirates**: תלוי בספינות משמר (נרכשות במעטפת ההפלגה), מטען, כסף, נזק, קיבולת.
- **scoring-endgame**: קורא הכול; מפעיל את טבלת השיאים.

## סדר מימוש מומלץ

1. time-calendar + market-prices (יסודות המצב)
2. trading + banking + ship-damage-repair (פעולות הנמל)
3. morning-events (מנוע יום)
4. sailing-engine (מנוע הפלגה) ואז pirates
5. scoring-endgame

## רישום סתירות ופערים

- טבלת הסתירות המלאה בין `התפלגות סיכויים.txt` לפיענוח הבינארי: `תיעוד התקדמות.md` §4.
- פערים פתוחים ותוכנית אימות DOSBox: `תיעוד התקדמות.md` §5. כל פער מסומן ⚠️ גם ב־GDD הרלוונטי, עם מקור המילוי.
