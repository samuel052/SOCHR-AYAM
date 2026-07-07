# ADR-0004: Persistence — JSON in user:// for Saves, Autosave, Hi-Scores, Settings

## Status

Accepted

## Date

2026-07-07

## Last Verified

2026-07-07

## Decision Makers

Technical Director (agent), pre-approved scope by project owner

## Summary

Game saves (1 manual slot + day-start autosave), the persistent top-10 hi-score
table, and settings are stored as JSON files under `user://` written by a single
`Persistence` foundation module; save payload = `GameState.to_dict()` + RNG state
+ meta, restored bit-identically (TR-END-06). FileAccess `store_*` bool returns
(4.4 change) are checked on every write.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Godot 4.6 |
| **Domain** | Core / Save-Load |
| **Knowledge Risk** | MEDIUM — FileAccess `store_*` return `bool` since 4.4 (post-cutoff-adjacent, verified) |
| **References Consulted** | `docs/engine-reference/godot/breaking-changes.md` (4.3→4.4 table) |
| **Post-Cutoff APIs Used** | `FileAccess.store_string` bool return handling |
| **Verification Required** | user:// path behavior on Windows export; write-failure path (read-only dir) shows graceful error |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (state as plain data), ADR-0002 (RNG state), ADR-0003 (config_version stamp) |
| **Enables** | Save/Load screens; hi-score feature |
| **Blocks** | scoring-endgame implementation |
| **Ordering Note** | Schema versioning decided here applies from the first save ever written |

## Context

### Problem Statement

The approved modern additions (save/load, settings) plus the original's
persistent hi-score table need durable storage that survives updates, tolerates
corruption (TR-END-04), and preserves determinism (TR-END-06: RNG state must
round-trip, preventing reroll-scumming via save/load).

### Current State

Greenfield.

### Constraints

- Offline desktop; no cloud. Windows-first (user:// → %APPDATA%/Godot/app_userdata/<name>).
- Save only at port (design rule from ADR-0001 — no mid-decision saves).
- Original had no saves; fidelity is unaffected by this ADR (pure addition).

### Requirements

- TR-ARCH-006/007, TR-END-02/04/06; autosave at day start (scoring-endgame §3.7).

## Decision

1. Files: `user://save.json` (manual slot), `user://autosave.json` (written at
   each day start), `user://hiscores.json`, `user://settings.json`.
2. Save payload: `{schema_version, config_version, timestamp, state: GameState.to_dict(), rng_state}`.
3. Writes are atomic: write `*.tmp`, verify `store_string()` returned `true`,
   then rename over the target. Read failures/corruption ⇒ file treated as
   absent (hi-scores rebuilt empty; saves reported unloadable) — never a crash.
4. `schema_version` gate: loader migrates or politely rejects newer/unknown versions.
5. Hi-scores: array of ≤10 `{name, score, date}`, maintained sorted by ScoreEngine
   rules; Persistence only stores/loads.

### Key Interfaces

```gdscript
class_name Persistence extends Node   # foundation layer (may use FileAccess)
func save_game(payload: Dictionary, slot: StringName) -> Result
func load_game(slot: StringName) -> Result   # data or {error: SAVE_MISSING|CORRUPT|NEWER_VERSION}
func load_hiscores() -> Array[Dictionary]    # [] on any failure
func store_hiscores(rows: Array[Dictionary]) -> Result
```

### Implementation Guidelines

- Check every `store_*` bool (4.4 semantics) — a `false` aborts and surfaces `Result.error`.
- No `store_var`/binary — JSON text for debuggability and versioned diffs in bug reports.
- Settings kept trivial (volume, fullscreen, language-ready flag).

## Alternatives Considered

### Alternative 1: `ConfigFile` API

- **Pros**: built-in sections, simple.
- **Cons**: INI format awkward for nested state (cargo dict, prices matrix); weaker corruption story.
- **Rejection Reason**: nested game state fits JSON naturally.

### Alternative 2: Binary `store_var` snapshots

- **Pros**: fastest, smallest.
- **Cons**: opaque in bug reports, version-fragile, encourages saving live objects instead of plain dicts.
- **Rejection Reason**: debuggability and schema control win; sizes are tiny anyway.

## Consequences

### Positive

- Honest saves (RNG round-trip) close the save-scum loophole by design.
- Corruption tolerance satisfies TR-END-04 with a rebuild-empty policy.

### Negative

- JSON is user-editable → trivially cheatable hi-scores. Accepted: offline
  single-player, family audience; not a threat model we defend (documented).

### Neutral

- Autosave gives an implicit "continue" feature; UX decides how it surfaces.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Schema evolves mid-development, old saves break | High (dev-time) | Low | schema_version + dev policy: migrations only after 1.0 |
| Disk-full/permission write failures | Low | Medium | Atomic tmp+rename, surfaced Result errors |

## Validation Criteria

- [ ] Save→load→save produces byte-identical second save (fixed timestamp) — TR-END-06.
- [ ] Truncated/garbled hiscores.json boots to an empty table without crash — TR-END-04.
- [ ] Kill-process during save never leaves a corrupt primary file (tmp+rename).

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| `design/gdd/scoring-endgame.md` | Hi-scores | TR-END-02/03/04 persistent tolerant top-10 | hiscores.json + rebuild-empty policy |
| `design/gdd/scoring-endgame.md` | Save (approved addition) | TR-END-06 bit-identical restore incl. RNG | payload schema + RNG state |

## Related

- ADR-0001 (plain-data state), ADR-0002 (RNG state), ADR-0003 (config_version).
