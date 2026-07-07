# ADR-0008: Original-Game Verification Harness (DOSBox Protocol)

## Status

Accepted

## Date

2026-07-07

## Last Verified

2026-07-07

## Decision Makers

Technical Director (agent), continuation approved by project owner ("המשך")

## Summary

Open fidelity gaps (QQ-01…QQ-10) are closed by observing the original `K.com`
running in DOSBox under a written per-question protocol; findings land as
`assets/data/` config edits + GDD ⚠️-note updates + a dated evidence log in
`docs/verification/`, each with a regression test citing the evidence.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | N/A (tooling: DOSBox 0.74+ / DOSBox-X; target: original DOS binary) |
| **Domain** | Core (fidelity) |
| **Knowledge Risk** | LOW |
| **References Consulted** | `רימיקס לסוחר הים/socher1/` (K.com + resources), פיענוח docs |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | — (this ADR *is* the verification mechanism) |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0003 (findings land as config edits) |
| **Enables** | Closing QQ-01…QQ-10; final fidelity sign-off |
| **Blocks** | Nothing (implementation proceeds with flagged defaults) |
| **Ordering Note** | High-priority QQs (01–04) should be verified before Polish phase |

## Context

### Problem Statement

Ten open questions remain where the binary reverse-engineering didn't reach a
verdict and the early spec (`התפלגות סיכויים.txt`) may be wrong. Guessing wrong
silently would violate the project's core promise. The original binary runs in
DOSBox — direct observation is available and decisive for behavioral questions;
statistical questions need repeated sampling.

### Constraints

- DOSBox interaction is manual/semi-automated (keystroke macros); Hebrew DOS
  drivers (`HEBREW.COM` etc.) must load — use the provided `Socher.bat`.
- Some questions are statistical (QQ-03 price ranges) — need dozens of samples;
  some are single-observation (QQ-02 score composition).
- The remake's RNG differs by design (ADR-0002) — comparisons are behavioral/
  distributional, never seed-by-seed.

### Requirements

- QQ-01…QQ-10 (architecture.md Open Questions); GDD ⚠️ acceptance criteria.

## Decision

1. `docs/verification/protocol.md` — one section per QQ: setup, exact steps,
   what to record, decision rule (e.g. QQ-02: finish a game with cash X in bank,
   Y on hand; recorded score tells the composition).
2. `docs/verification/evidence/QQ-NN-[date].md` — raw observations (screenshots
   from DOSBox, tallies), conclusion, config diff applied.
3. Each closed QQ produces, in one commit: config value change + flag flip,
   GDD ⚠️ note replaced with "אומת ב-DOSBox [date]", regression test naming the
   evidence file, `תיעוד התקדמות.md` log row.
4. Priority order: QQ-01 (pirate loss), QQ-02 (score), QQ-03 (daily prices),
   QQ-04 (price-event base) — before Polish; the rest opportunistically.
5. Execution environment: any machine with DOSBox + the repo's `socher1/`
   folder (works in this cloud session — dosbox installed — and on the owner's
   PC; owner gameplay observations count as evidence when documented).

## Alternatives Considered

### Alternative 1: Deeper static reverse-engineering of K.com

- **Pros**: could yield exact formulas incl. RNG usage.
- **Cons**: high effort, specialist work, already hit diminishing returns in prior sessions.
- **Rejection Reason**: observation answers the open questions faster and verifiably.

### Alternative 2: Ship with spec-doc defaults, no verification

- **Pros**: zero effort.
- **Cons**: known contradictions between spec doc and binary make silent wrongness likely.
- **Rejection Reason**: violates fidelity-first principle.

## Consequences

### Positive

- Every fidelity assumption becomes either verified or explicitly documented.
- Config-gated design (ADR-0003) makes each finding a one-line change.

### Negative

- Manual observation time (est. 2–4 hours total across QQs).

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Rare branches (pirate loss with 0 cash) hard to reproduce | Medium | Low | Accept spec-doc fallback with permanent ⚠️ note |
| DOSBox timing/Hebrew driver quirks | Low | Low | Use bundled Socher.bat; DOSBox-X as fallback |

## Validation Criteria

- [ ] protocol.md covers all ten QQs with decision rules.
- [ ] QQ-01…QQ-04 closed (evidence + config + test) before Polish gate.
- [ ] No GDD retains an unreferenced ⚠️ (each points to a QQ or a dated verification).

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| all GDDs with ⚠️ | fidelity | "לאימות DOSBox" acceptance criteria | Written protocol + evidence trail |
| `design/gdd/pirates.md` | Pirates | TR-PIR-06 loss branch behind config | QQ-01 protocol closes it |

## Related

- ADR-0002 (why comparisons are distributional), ADR-0003 (findings as data).
