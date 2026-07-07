# ADR-0003: External JSON Config with Fidelity-Gap Flags

## Status

Proposed

## Date

2026-07-07

## Last Verified

2026-07-07

## Decision Makers

Technical Director (agent), pre-approved scope by project owner

## Summary

All ~70 tunable values from the GDDs — including every ⚠️ open-gap resolution
(bank-in-score, pirate loss branch, base_mode of price events, etc.) — live in
versioned JSON files under `assets/data/`, loaded once into a typed `GameConfig`;
resolving a DOSBox-verified gap is a data edit plus test update, never a code change.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Godot 4.6 |
| **Domain** | Core / Data |
| **Knowledge Risk** | LOW — `JSON.parse_string`, `FileAccess.get_file_as_string` stable |
| **References Consulted** | `docs/engine-reference/godot/breaking-changes.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | Config loads identically in editor and exported EXE (res:// packing) |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 |
| **Enables** | ADR-0008 (verification harness updates land as data) |
| **Blocks** | Engine-module implementation (modules read GameConfig, not literals) |
| **Ordering Note** | Schema must exist before the first engine module is coded |

## Context

### Problem Statement

Coding standards forbid hardcoded gameplay values. This project adds a stronger
driver: ~10 open questions (QQ-01…QQ-10) will be resolved by DOSBox verification
*after* implementation starts. If those numbers are literals, each resolution is
a refactor + re-review; as config, it is a one-line data change.

### Current State

Greenfield. Tuning-knob tables already enumerated per GDD (section 7 of each).

### Constraints

- Values must be human-diffable (git-reviewable) — favors JSON text over binary `.tres`.
- Config is read-only at runtime (no live tuning UI needed — offline single-player).
- Formula *structure* stays in code (typed, tested); config holds parameters and mode flags, not expressions.

### Requirements

- TR-ARCH-004; every "Tuning Knobs" table across the 9 GDDs; QQ-01…QQ-10 flags.

## Decision

1. `assets/data/` files: `economy.json` (prices, price-events), `events.json`
   (morning engine codes/weights/conditions), `voyage.json` (gates, ladders,
   tables), `pirates.json`, `ship.json`, `time.json`, `scoring.json`.
2. `GameConfig` (core) parses once at boot into typed, immutable properties;
   missing/invalid key ⇒ hard boot failure with the exact key path (fail fast,
   no silent defaults).
3. Fidelity flags use explicit enums, e.g. `price_event.base_mode: "fixed_mid" | "daily_reference"`,
   `score.include_bank: bool` — each flag documents its QQ-ID and default in a
   `_comment` field alongside.
4. `config_version` field; saves record the version they were played on.
5. Schema documented in `assets/data/README.md`; gdUnit4 test validates every
   GDD tuning-knob key exists in config (drift guard).

### Key Interfaces

```gdscript
class_name GameConfig extends RefCounted
static func load_from(dir: String) -> GameConfig   # hard-fails on any missing key
var price_copper_min: int   # …typed accessors per knob, grouped by system
func flag(name: StringName) -> Variant             # fidelity flags, enum-checked
```

### Implementation Guidelines

- Key names mirror the GDD tuning-knob tables 1:1 (e.g. `thieves.money_divisor`).
- No engine module reads JSON directly — only GameConfig.
- When a QQ is resolved: update value + flip flag, update the GDD ⚠️ note, add a regression test citing the verification evidence.

## Alternatives Considered

### Alternative 1: Godot `.tres` resources per system

- **Pros**: editor-inspectable, typed in-engine.
- **Cons**: poor git diffs, editor-coupled review, tempts UI-side loading.
- **Rejection Reason**: reviewability of balance data is paramount here.

### Alternative 2: Constants in GDScript files

- **Pros**: simplest, typed.
- **Cons**: violates coding standards; every verification result is a code change.
- **Rejection Reason**: TR-ARCH-004.

## Consequences

### Positive

- DOSBox verification results land as reviewable one-line diffs.
- Balance data auditable against GDDs automatically (drift test).

### Negative

- Boot-time parse cost (negligible) and a typed-accessor layer to maintain.

### Neutral

- Modders effectively get a data-modding surface (unplanned but harmless).

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Config drifts from GDD tables | Medium | Medium | Drift-guard test enumerates GDD knob keys |
| Silent wrong value (typo'd key) | Low | High | Fail-fast loader, no defaults |

## Validation Criteria

- [ ] Deleting any knob key makes boot fail naming that key.
- [ ] Flipping `score.include_bank` changes final score with zero code diff.
- [ ] Drift-guard test covers 100% of GDD section-7 keys.

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| all 9 GDDs | Tuning Knobs (§7) | Values configurable without code change | JSON + typed GameConfig |
| `design/gdd/banking.md`, `pirates.md`, `market-prices.md`… | ⚠️ gaps | "מוכן להכרעת אימות DOSBox" criteria | Fidelity flags with QQ-IDs |

## Related

- ADR-0001 (config injected into core), future ADR-0008 (verification harness).
