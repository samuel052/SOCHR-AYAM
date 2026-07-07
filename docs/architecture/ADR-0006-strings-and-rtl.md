# ADR-0006: Hebrew Strings Table & RTL Strategy

## Status

Accepted

## Date

2026-07-07

## Last Verified

2026-07-07

## Decision Makers

Technical Director (agent), continuation approved by project owner ("המשך")

## Summary

All player-facing text lives in one translation CSV keyed by StringName and
rendered through Godot's `tr()`; the UI is authored RTL-first (Hebrew) using
Godot 4's TextServer BiDi, with a pixel-font fallback plan and an RTL smoke-test
scene that gates every UI milestone.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Godot 4.6 |
| **Domain** | UI / Localization |
| **Knowledge Risk** | MEDIUM — 4.6 added CSV plural/context columns (unused); TextServer BiDi stable since 4.0 |
| **References Consulted** | `docs/engine-reference/godot/modules/ui.md`, `breaking-changes.md` (Localization rows) |
| **Post-Cutoff APIs Used** | None (plural CSV support deliberately unused — no plural strings needed) |
| **Verification Required** | Hebrew shaping + mixed Hebrew/digits (e.g. "3,300 שקל") renders correctly under the Compatibility renderer with the chosen pixel font |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0005 (renderer determines text rendering path) |
| **Enables** | All Presentation-layer work; future English localization |
| **Blocks** | UI implementation epics |
| **Ordering Note** | Font selection must precede art-bible typography section |

## Context

### Problem Statement

The game is Hebrew-first (RTL) — a minority path in game UI toolkits. Hardcoded
strings would block future translation and scatter BiDi bugs; the original's
texts (from screenshots/resources) must be preserved verbatim where reused.

### Constraints

- technical-preferences: no hardcoded UI strings; Hebrew now, translatable later.
- Numbers inside Hebrew sentences (prices, tons, hours) — classic BiDi trap.
- Pixel-art aesthetic needs a Hebrew-capable pixel font (limited options).

### Requirements

- TR-ARCH-008; UX docx (all screens Hebrew); original message texts preserved.

## Decision

1. `assets/strings/he.csv` — Godot translation CSV (`keys,he` columns; en column
   added later). Keys are semantic StringNames (`PIRATES_FLEE_FAILED_HEAVY`).
2. Original game messages are transcribed 1:1 from the screenshots/פיענוח docs
   into the table, tagged `# original` in a comment column; new-UI strings tagged `# remake`.
3. All Control text set via `tr()`; `internationalization/rendering/root_node_layout_direction = RTL`;
   per-control `layout_direction` left at inherit.
4. Numbers formatted via a single `Format.gd` helper (thousands separators,
   shekel suffix) to keep BiDi behavior consistent in one place.
5. Font: primary candidate — a Hebrew-capable pixel font validated in the art
   bible phase; fallback — Noto Sans Hebrew with pixel-snap. Decision recorded
   as an art-bible TODO, not a blocker (theme swap is cheap).
6. RTL smoke-test scene (`tests/manual/rtl_smoke.tscn`): every label archetype +
   mixed digits/Hebrew + punctuation; screenshot-compared per UI milestone.

## Alternatives Considered

### Alternative 1: Hardcoded Hebrew literals in scenes

- **Pros**: fastest.
- **Cons**: violates standards; untranslatable; unauditable against original texts.
- **Rejection Reason**: technical-preferences forbids it.

### Alternative 2: gettext (.po) pipeline

- **Pros**: industry standard, plural handling.
- **Cons**: heavier tooling; 4.6 CSV covers our needs (no plurals in game texts); CSV diffs nicely in git.
- **Rejection Reason**: overkill for ~150 strings.

## Consequences

### Positive

- Original texts auditable line-by-line against the source screenshots.
- English version later = one CSV column, zero code.

### Negative

- Discipline cost: every new UI element must route through the table (review-enforced).

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Pixel font lacks Hebrew glyph coverage | Medium | Medium | Fallback font path decided up front; art bible validates early |
| BiDi mis-order in number-heavy lines | Medium | Medium | Format.gd helper + RTL smoke scene per milestone |

## Validation Criteria

- [ ] CI grep: no user-visible string literals in `src/ui/` scripts/scenes (allowlist for debug).
- [ ] RTL smoke scene renders correctly at first playable.
- [ ] Every `# original` string matches its screenshot source (spot audit).

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| all GDDs (מסכים/הודעות) | Presentation | Original message texts preserved | `# original` tagged table entries |
| technical-preferences | UI | No hardcoded strings; RTL throughout | tr() + RTL root layout |

## Related

- ADR-0005 (renderer), ADR-0007 (screens consume the table).
