# Game Config Schema (`assets/data/`)

External JSON config per **ADR-0003**. All tunable game values — and every
open-gap resolution flag (QQ-01…QQ-10) — live here, loaded once at boot into a
typed `GameConfig` (core). Resolving a DOSBox-verified gap is a data edit here
plus a test update — never a code change.

## Files

| File | Owns | Source of truth |
|------|------|-----------------|
| `time.json` | days, hours, travel times, crew-skip days | GDD time-calendar |
| `economy.json` | daily price ranges, price-change formulas | GDD market-prices |
| `events.json` | 30-code map, family weights, morning formulas | GDD morning-events |
| `voyage.json` | risk gate, storm/damage, overload ladder, tables, winds, deserted, guards | GDD sailing-engine |
| `pirates.json` | fight/win/lose/flee/compromise | GDD pirates |
| `ship.json` | capacity, repair, dock | GDD ship-damage-repair |
| `scoring.json` | start cash, score composition, hi-score slots | GDD scoring-endgame |

## Conventions

- `_comment` fields document fidelity flags and QQ-IDs; ignored by the loader.
- Keys mirror the GDD "Tuning Knobs" tables 1:1 (e.g. `thieves.money_divisor`).
- `rand(n)` in formulas = uniform int `0..n-1` (Pascal `random(n)`; see RngService).
- Missing keys are a hard boot failure naming the exact path — no silent defaults.

## Fidelity flags (QQ — pending DOSBox verification, ADR-0008)

| Flag | File | Default | Alternative |
|------|------|---------|-------------|
| `price_event.base_mode` | economy | `fixed_mid` | `daily_reference` |
| `score.include_bank` | scoring | `true` | `false` |
| `pirates.lose.*` | pirates | spec-doc values | verified values |
| `crew_skip.*` | time | `1`/`2` | `2`/`3` (per תוכנית.txt) |
| `port_block.*`, `gate.class_default` | voyage | working defaults | verified |
