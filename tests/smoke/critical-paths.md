# Smoke Test: Critical Paths

**Purpose**: Run these checks in under 15 minutes before any QA hand-off.
**Run via**: `/smoke-check` (which reads this file)
**Update**: Add new entries when new core systems are implemented.

## Core Stability (always run)

1. Game launches to title screen without crash (once UI exists)
2. New game starts: day 1, 08:00, Israel, 5,000 ש"ח, 100 tons, sea calm
3. Headless test suite passes: unit + integration (`tests/`)

## Core Mechanic (update per sprint)

4. Buy → sail → sell round trip completes and cash changes correctly
5. Morning event appears from day 2 and never repeats a family two days running
6. Pirate encounter offers fight/flee/compromise and resolves per GDD

## Data Integrity

7. Save at port → load restores identical state (cash, cargo, prices, RNG)
8. Hi-score table survives restart; corrupt file does not crash

## Performance

9. 60 FPS steady on target hardware (once UI exists)
10. Memory stable over a full 7-day playthrough
