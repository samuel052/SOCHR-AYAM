# ADR-0007: Screen Management & Navigation Model

## Status

Accepted

## Date

2026-07-07

## Last Verified

2026-07-07

## Decision Makers

Technical Director (agent), continuation approved by project owner ("המשך")

## Summary

The game uses a hub-and-overlay navigation model: the port scene is the
persistent hub; market/bank/repair/voyage are full-screen scenes swapped by a
`ScreenManager`; event cards, warnings and decisions are modal overlays on top
of the current screen, driven by the `decision_required`/`day_started` signals.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Godot 4.6 |
| **Domain** | UI / Core |
| **Knowledge Risk** | LOW-MEDIUM — scene swapping stable; 4.6 dual-focus affects modal focus handling (flagged) |
| **References Consulted** | `docs/engine-reference/godot/modules/ui.md` (dual-focus), `modules/input.md` |
| **Post-Cutoff APIs Used** | None required; dual-focus behavior (4.6) accounted for in modal design |
| **Verification Required** | Modal overlay blocks clicks to the hub beneath it with 4.6 mouse-focus semantics; keyboard shortcuts disabled while a modal is open |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (signals/PendingDecision drive navigation), ADR-0006 (strings) |
| **Enables** | All screen implementation stories; UX specs have a concrete container model |
| **Blocks** | UI epics |
| **Ordering Note** | UX specs (/ux-design) should be written against this model |

## Context

### Problem Statement

The UX spec (`אפיון מסכי משחק.docx`) defines an interactive port hub with
locations (market, bank, repair dock, notice board, pier) plus overlay-style
events (morning cards, warnings, pirate encounter). Screen lifecycle, input
blocking during modals, and mapping PendingDecision kinds to dialogs need one
consistent mechanism, or every screen invents its own.

### Constraints

- Mouse-first (TR-ARCH-009); modal correctness under 4.6 dual-focus.
- Original game structure: one main screen + windows on top — the hub-and-overlay
  model mirrors it naturally (nostalgia preserved).
- UI must never talk to core directly (ADR-0001) — navigation reacts to facade signals.

### Requirements

- UX docx screen list; TR-ARCH-005 (decision routing to dialogs); TR-ARCH-009.

## Decision

1. `ScreenManager` (foundation, Node): owns a `current_screen` slot under a root
   Control; API `replace(screen_id)`, `overlay(dialog_id, ctx) -> awaitable`,
   `close_overlay()`. One `.tscn` per screen/dialog (naming per technical-preferences).
2. Screens: `title`, `port_hub`, `market_buy`, `market_sell`, `bank`, `repair`,
   `voyage_map` (destination+guards), `voyage_anim`, `hiscores`, `settings`, `save_load`.
3. Overlays (modal, input-blocking full-rect barrier): day announcements
   (day/weather/morning-event cards), sail warnings, pirate encounter flow,
   crew negotiation, merchant/expand offers, name entry, confirmations.
4. `DecisionRouter` (feature layer): static map `PendingDecision.kind → dialog scene`;
   listens to `decision_required`, opens the overlay, returns the payload via
   `GameFacade.answer()`. Adding a decision kind = one map entry + one dialog scene.
5. Modal rules: barrier consumes mouse; hub shortcuts disabled while any overlay
   is open (single `is_modal_open` gate — avoids 4.6 dual-focus edge cases).
6. Screen transitions are presentation-only (fade/slide) and never gate game
   logic; logic completes before the transition starts (resolve-then-present).

## Alternatives Considered

### Alternative 1: Single scene with panel visibility toggling

- **Pros**: no manager, trivial.
- **Cons**: one mega-scene, merge conflicts, memory always-loaded, untestable in isolation.
- **Rejection Reason**: 11+ screens make this unmaintainable.

### Alternative 2: Full stack-based navigation (push/pop everywhere)

- **Pros**: generic.
- **Cons**: the game is a hub with depth-1 excursions; a stack invites illegal states (market over voyage).
- **Rejection Reason**: hub-and-overlay matches both the UX spec and the original.

## Consequences

### Positive

- PendingDecision kinds map 1:1 to dialogs — the conversation pattern gets a single UI entry point.
- Screens are independently loadable/testable scenes.

### Negative

- Overlay-over-overlay (pirate fight after failed flee) needs explicit sequencing in DecisionRouter (queue, not nesting).

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Modal not blocking input under dual-focus | Low | High | Barrier + is_modal_open gate; manual test in first playable |
| Decision kinds without a mapped dialog | Medium | Medium | Runtime assert + drift test enumerating enum vs. map |

## Validation Criteria

- [ ] Every PendingDecision kind has a mapped dialog (automated drift check).
- [ ] With a modal open, hub buttons and shortcuts are inert (manual test).
- [ ] Pirate chain (flee-fail → fight) presents sequentially without nesting.

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| UX docx | all screens | Port hub + locations + event overlays | hub-and-overlay model |
| `design/gdd/pirates.md`, `morning-events.md` | decisions | Mid-flow prompts reach the player | DecisionRouter |

## Related

- ADR-0001 (PendingDecision), ADR-0006 (strings in dialogs).
