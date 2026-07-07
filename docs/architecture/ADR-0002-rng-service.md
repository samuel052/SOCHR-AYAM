# ADR-0002: Seedable Injected RNG with Call-Order Fidelity

## Status

Proposed

## Date

2026-07-07

## Last Verified

2026-07-07

## Decision Makers

Technical Director (agent), pre-approved scope by project owner

## Summary

Every random draw in the original game shapes its probability behavior, so the
remake routes all randomness through one injected `RngService` exposing
`randn(n)` with Turbo Pascal `random(n)` semantics (uniform int `0..n-1`),
seedable and state-serializable; direct `randi()`/`randf()` calls are forbidden
in `src/core/`.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Godot 4.6 |
| **Domain** | Core |
| **Knowledge Risk** | LOW — `RandomNumberGenerator` unchanged since 4.0 |
| **References Consulted** | `docs/engine-reference/godot/breaking-changes.md` (no RNG entries) |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | `RandomNumberGenerator.state` round-trip equality after save/load |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 |
| **Enables** | Golden-seed transcript testing; save/load determinism (ADR-0004) |
| **Blocks** | All engine-module implementation |
| **Ordering Note** | — |

## Context

### Problem Statement

The GDDs define ~40 formulas of the shape `X + step*rand(n)`, plus reroll loops
(morning engine) and layered gates (voyage engine). Testing their distributions,
replaying bugs, and keeping saves fair all require deterministic, injectable
randomness. Scattered `randi()` calls would make distribution tests impossible
and save-scumming semantics accidental.

### Current State

Greenfield.

### Constraints

- Formula notation in all GDDs is `rand(n)` = `0..n-1` — the service must match it 1:1.
- Statistical acceptance criteria (TR-MORN-01/02, TR-SAIL-02, TR-PIR-01) need seeded mass-runs.
- We do NOT attempt to clone Borland's LCG bit-for-bit — fidelity target is the
  *distributions and call structure*, not the original's exact stream. (Recorded
  as an explicit, permanent deviation — the original seed is unobservable anyway.)

### Requirements

- TR-ARCH-003 (single injected stream), TR-END-06 (RNG state in saves), TR-ARCH-010 (instrumentable draws).

## Decision

1. `RngService` (core, RefCounted) wraps Godot's `RandomNumberGenerator`:
   - `randn(n: int) -> int` — uniform `0..n-1`; asserts `n ≥ 1`.
   - `seed(v)`, `state() -> int`, `restore(state)`.
2. Constructor-injected into every engine module. No module creates its own RNG.
3. One stream for gameplay. Tests may inject a scripted/recording double
   (`FakeRng` with a queue of forced values + draw log) — the draw log is how
   TR-ARCH-010 reroll instrumentation and call-order pinning are asserted.
4. UI/presentation randomness (ambient animation jitter) uses a *separate*
   non-serialized RNG in the presentation layer — it must never touch RngService.

### Key Interfaces

```gdscript
class_name RngService extends RefCounted
func randn(n: int) -> int          # 0..n-1, Pascal random(n) semantics
func seed_with(v: int) -> void
func state() -> int
func restore(s: int) -> void
```

### Implementation Guidelines

- CI grep gate: `randi|randf|randomize` under `src/core/` outside `rng_service.gd` fails the build.
- Every formula test uses `FakeRng` for edge values (0, n-1) + seeded statistical runs for distributions.

## Alternatives Considered

### Alternative 1: Reimplement Borland Pascal's exact LCG

- **Pros**: theoretically bit-faithful streams.
- **Cons**: original seeding (timer-based) unobservable; zero player-visible benefit; risk of subtle mismatch anyway.
- **Rejection Reason**: fidelity target is distributions, not bitstreams.

### Alternative 2: `randi() % n` at call sites

- **Pros**: no service layer.
- **Cons**: modulo bias (negligible but real), unseedable per-game, untestable, unserializable.
- **Rejection Reason**: breaks TR-ARCH-003 and TR-END-06.

## Consequences

### Positive

- Deterministic replays, golden-seed tests, honest save/load.
- Distribution tests directly encode the GDD tables (e.g., 30-code weights).

### Negative

- Call-order becomes part of the contract — refactors that reorder draws must update golden transcripts consciously.

### Neutral

- Documented deviation: PRNG algorithm differs from the original binary (distributions identical).

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Accidental draw reordering changes outcomes for a given seed | Medium | Low (fairness unaffected) | Golden-transcript tests fail loudly; changelog note required |

## Validation Criteria

- [ ] Same seed + same command script ⇒ identical full-game outcome (CI test).
- [ ] Save→load mid-game preserves the forward stream exactly.
- [ ] χ² sanity test on `randn(30)` over 10⁶ draws passes.

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| all GDDs | all formulas | `rand(n)` semantics, statistical acceptance criteria | Service matches notation; seeded mass-runs |
| `design/gdd/scoring-endgame.md` | Save | TR-END-06 bit-identical restore incl. RNG | `state()/restore()` |
| `design/gdd/morning-events.md` | Events | TR-MORN-03 reroll instrumentation | FakeRng draw log |

## Related

- ADR-0001 (injection boundary), ADR-0004 (state persisted in saves).
