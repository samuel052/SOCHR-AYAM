# ADR-0001: Pure-Core / Thin-UI Separation with PendingDecision Conversations

## Status

Accepted

## Date

2026-07-07

## Last Verified

2026-07-07

## Decision Makers

Technical Director (agent), pre-approved scope by project owner

## Summary

The remake must reproduce the original game's logic 1:1 while replacing its UI
entirely; we therefore isolate all rules in an engine-free `src/core/` module
(`RefCounted` only) behind a single `GameFacade` autoload, and model every
mid-resolution player prompt (pirates, crew negotiation, offers, warnings) as a
serializable `PendingDecision` object instead of UI callbacks into logic.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Godot 4.6 |
| **Domain** | Core / Scripting |
| **Knowledge Risk** | MEDIUM — uses 4.5 `@abstract` for engine interfaces (post-cutoff, verified) |
| **References Consulted** | `docs/engine-reference/godot/current-best-practices.md`, `breaking-changes.md` |
| **Post-Cutoff APIs Used** | GDScript `@abstract` (4.5) — optional convenience, trivially removable |
| **Verification Required** | Headless instantiation of the full core graph without a SceneTree |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | None |
| **Enables** | ADR-0002 (RNG), ADR-0003 (config), ADR-0004 (persistence) |
| **Blocks** | All implementation epics |
| **Ordering Note** | First ADR to accept; everything builds on this boundary |

## Context

### Problem Statement

The game's value is its faithful logic. If rules leak into UI scripts, fidelity
cannot be proven by tests, DOSBox-verification updates become refactors, and the
logic cannot run headless in CI. Turn-based flow with mid-flow player prompts
(pirate choice, crew negotiation) tempts developers to call UI from logic —
which would make the core untestable.

### Current State

Greenfield. No code exists.

### Constraints

- Godot scene tree is inherently UI-coupled; logic must avoid `Node` entirely.
- Coding standards: dependency injection over singletons; unit-testable public methods.
- Original flow includes prompts *inside* event resolution (fight→flee→fight chains).

### Requirements

- TR-ARCH-001/002: engine-free, formula-per-function core.
- TR-ARCH-005: pause/resume of resolution across player decisions, deterministic.
- TR-ARCH-011: full logic suite runs headless.

## Decision

1. `src/core/` contains only `RefCounted` classes; forbidden imports enforced in
   review: no `Node`, no `SceneTree`, no UI types, no `FileAccess`.
2. `GameFacade` (autoload, `src/foundation/`) is the only API the UI may touch:
   commands in, `Result` + signals out, snapshots are plain data.
3. Any rule point where the original game awaited player input returns a
   `PendingDecision {id, kind, context}`; the engine parks its continuation
   state in `GameState`, the UI answers via `GameFacade.answer(id, payload)`.
4. UI is one-way bound: renders `state_changed(snapshot)`, never mutates state.

### Architecture

```text
ui/*  ──intent──►  GameFacade  ──calls──►  core engines ──► GameState
  ▲                                            │
  └──── signals: state_changed / decision_required / voyage_resolved ◄──┘
```

### Key Interfaces

See "API Boundaries" in `architecture.md` (authoritative signature list).

### Implementation Guidelines

- One core class per GDD system (mapping table in `architecture.md`).
- Each original formula = one pure function with a unit test citing the GDD section.
- PendingDecision context carries everything the UI needs (no core lookups from UI).

## Alternatives Considered

### Alternative 1: Logic in scene scripts (idiomatic small-Godot style)

- **Pros**: fastest start, fewer files.
- **Cons**: untestable headless; fidelity unverifiable; every gap-fix touches UI code.
- **Rejection Reason**: violates the project's core goal (provable 1:1 fidelity).

### Alternative 2: Async/await coroutines for mid-flow prompts

- **Pros**: linear-looking code.
- **Cons**: continuation state hidden in coroutine frames — not serializable, harder to test; couples core to signal sources.
- **Rejection Reason**: PendingDecision keeps state explicit and save-friendly.

## Consequences

### Positive

- Core runs and is tested headless; golden-seed transcripts possible.
- DOSBox-verification updates = config/data changes only.
- UI can be rebuilt and polished freely without touching rules.

### Negative

- More boilerplate (Result objects, snapshots, decision routing).
- Two-step flows (plan→sail) slightly more ceremony than direct calls.

### Neutral

- Facade is a singleton autoload — acceptable at the boundary; core itself stays DI-friendly.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Rule leakage into UI over time | Medium | High | Review checklist + forbidden-import grep in CI |
| PendingDecision sprawl (too many kinds) | Low | Medium | Single enum registry; UX maps kinds→dialogs |

## Validation Criteria

- [ ] Core graph instantiates and plays a scripted full game headless in CI.
- [ ] grep finds no `Node`/`get_tree`/UI imports under `src/core/`.
- [ ] A pirate fight→flee-fail→fight chain resolves via decisions with no UI types in core.

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| all 9 GDDs | all | Acceptance criteria require formula-level unit tests | Engine-free core makes every formula testable headless |
| `design/gdd/pirates.md` | Pirates | Fight/flee/compromise chains with player choice | PendingDecision conversation pattern |
| `design/gdd/morning-events.md` | Morning events | Offers/negotiation prompts inside resolution | Same pattern |

## Related

- ADR-0002, ADR-0003, ADR-0004 build directly on this boundary.
