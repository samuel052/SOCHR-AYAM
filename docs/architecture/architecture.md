# Sea Trader Remake (סוחר הים) — Master Architecture

## Document Status

- Version: 1.0
- Last Updated: 2026-07-07
- Engine: Godot 4.6 (Compatibility renderer, Windows desktop export)
- GDDs Covered: time-calendar, market-prices, trading, banking, ship-damage-repair, morning-events, sailing-engine, pirates, scoring-endgame
- ADRs Referenced: ADR-0001…ADR-0005 (created alongside this document)
- Technical Director Sign-Off: 2026-07-07 — APPROVED (self-review, lean mode)
- Lead Programmer Feasibility: skipped — Lean mode
- Authoring note: written autonomously with pre-approval from the user
  ("תמשיך לארכיטקטורה, מקסימום אחר כך נשפץ"); section-by-section approvals batched.

## Engine Knowledge Gap Summary

Engine pinned at **Godot 4.6** (post-cutoff, HIGH risk overall), but this project's
footprint is deliberately narrow: 2D Control-based UI, no physics, no 3D, no networking.

| Domain we touch | Risk | Implication for this project |
|---|---|---|
| UI (Control) | HIGH (4.6 dual-focus) | Mouse focus ≠ keyboard focus in 4.6. We are mouse-first; keyboard shortcuts must be tested separately. Verified against `modules/ui.md`. |
| Rendering | HIGH (D3D12 default on Windows) | We use the **Compatibility (OpenGL)** renderer explicitly → sidesteps the D3D12 change and maximizes old-hardware support. |
| Core / FileAccess | MEDIUM (4.4: `store_*` now returns `bool`) | Save/persistence code must check returned bool. Flagged in ADR-0004. |
| GDScript | MEDIUM (4.5: variadics, `@abstract`) | `@abstract` is available and used for engine interfaces (post-cutoff feature, verified in `current-best-practices.md`). |
| Physics / Navigation / Animation / Networking | — | Not used. |

## Technical Requirements Baseline

Extracted from 9 GDDs. GDD-level acceptance criteria (TR-TIME-xx … TR-END-xx) live in
each GDD; the architecture-level requirements they imply are:

| Req ID | Source | Requirement | Domain |
|--------|--------|-------------|--------|
| TR-ARCH-001 | all GDDs | Game logic 1:1 faithful to original; every formula isolated and unit-testable | Core |
| TR-ARCH-002 | technical-preferences | Logic module has zero scene-tree/UI dependencies (`RefCounted` only) | Core |
| TR-ARCH-003 | all GDDs | All randomness through one injected, seedable RNG service | Core |
| TR-ARCH-004 | all GDDs (⚠️ gaps) | Every tunable + every open-gap resolution behind external config (JSON), no code change to re-tune | Data |
| TR-ARCH-005 | morning-events, sailing-engine, pirates | Mid-resolution player decisions (pirate choice, crew negotiation, merchant offers, sail warnings) — engine must pause and resume deterministically | Core |
| TR-ARCH-006 | scoring-endgame | Full game state (incl. RNG state) serializable: save/load + autosave at day start | Save/Load |
| TR-ARCH-007 | scoring-endgame | Persistent top-10 high-score table across runs | Save/Load |
| TR-ARCH-008 | UX spec (docx) | Hebrew RTL UI everywhere; all strings via translation table | UI |
| TR-ARCH-009 | technical-preferences | Mouse-only play must be possible for 100% of actions | Input |
| TR-ARCH-010 | morning-events §5 | Event-engine reroll loops instrumented with safety counters (test-only assertion) | Core |
| TR-ARCH-011 | coding standards | Headless CI: gdUnit4 suite runs without display, incl. statistical distribution tests | Testing |
| TR-ARCH-012 | project goal | Single-EXE Windows export, offline, no runtime downloads | Platform |

## System Layer Map

```text
┌───────────────────────────────────────────────────────────────────┐
│ PRESENTATION  src/ui/                                             │
│   PortScreen · MarketScreen(buy/sell) · BankScreen · RepairScreen │
│   VoyageScreen · PirateScreen · NoticeBoard · EventDialogs        │
│   HiScoreScreen · SettingsScreen · SaveLoadScreen · Theme/Audio   │
├───────────────────────────────────────────────────────────────────┤
│ FEATURE       src/game/                                           │
│   GameFlow (day sequence + screen routing)                        │
│   PendingDecision router (engine ⇆ UI conversations)              │
├───────────────────────────────────────────────────────────────────┤
│ CORE          src/core/   ← PURE LOGIC, no Node/scene-tree refs   │
│   GameState · RngService · GameConfig                             │
│   PriceEngine · TradeEngine · BankEngine · ShipEngine             │
│   MorningEventEngine · VoyageEngine · PirateEngine · ScoreEngine  │
├───────────────────────────────────────────────────────────────────┤
│ FOUNDATION    src/foundation/                                     │
│   GameFacade (autoload — the ONLY door between UI and core)       │
│   Persistence (saves, hiscores, settings → user://)               │
│   Strings (Hebrew table, tr()) · ScreenManager                    │
├───────────────────────────────────────────────────────────────────┤
│ PLATFORM      Godot 4.6 · Compatibility renderer · Windows export │
└───────────────────────────────────────────────────────────────────┘
```

GDD system → module mapping:

| GDD | Core module(s) | Presentation |
|---|---|---|
| time-calendar | GameState (clock/day), GameFlow | HUD info bar |
| market-prices | PriceEngine | NoticeBoard, price panel |
| trading | TradeEngine | MarketScreen |
| banking | BankEngine | BankScreen |
| ship-damage-repair | ShipEngine | RepairScreen, ship visuals |
| morning-events | MorningEventEngine | EventDialogs |
| sailing-engine | VoyageEngine | VoyageScreen (map, guards, warnings) |
| pirates | PirateEngine | PirateScreen |
| scoring-endgame | ScoreEngine | HiScoreScreen, end screens |

## Module Ownership

### Core layer (all `RefCounted`, zero engine APIs beyond base types)

| Module | Owns | Exposes | Consumes |
|---|---|---|---|
| GameState | The entire mutable game state: day, clock, port, cash, bank, cargo{3}, capacity, damage, prices[3][3], storm_port, last_event_family, guards_this_voyage, rng_state | Typed getters; `to_dict()/from_dict()` | — |
| RngService | RNG stream + seed | `randn(n)` (= Pascal `random(n)`), `state()/restore()` | — |
| GameConfig | Parsed config (all tuning knobs + ⚠️ fidelity flags) | Typed constant access | JSON data files |
| PriceEngine | Daily price generation, price-change events | `roll_daily_prices()`, `apply_price_event(good,dir)` | GameState, RngService, GameConfig |
| TradeEngine | Buy/sell invariants | `buy(good,qty)`, `sell(good,qty)`, `cargo_value(port)`, `ship_value(port)` | GameState |
| BankEngine | Deposit/withdraw invariants | `deposit(x)`, `withdraw(x)` | GameState |
| ShipEngine | Damage/repair/capacity invariants; dock-open roll | `repair(x)`, `add_damage(x)`, `add_capacity(x)`, `can_sail()`, `roll_dock_open()` | GameState, RngService |
| MorningEventEngine | The 30-code engine + 7 families | `roll_morning() → EventResult\|PendingDecision`, `resolve_decision(...)` | GameState, RngService, PriceEngine, TradeEngine, ShipEngine |
| VoyageEngine | 4-layer voyage resolution; envelope checks; guards pricing | `plan(dest) → VoyagePlan` (warnings, guard price), `sail(plan) → VoyageResult\|PendingDecision` | GameState, RngService, ShipEngine, TradeEngine, PirateEngine |
| PirateEngine | Fight/flee/compromise resolution | `encounter() → PendingDecision`, `choose(action, offer?) → PirateResult\|PendingDecision` | GameState, RngService |
| ScoreEngine | End detection, score calc | `check_game_over()`, `final_score()` | GameState, GameConfig |

### Feature / Foundation layers

| Module | Owns | Exposes | Consumes | Engine APIs (risk) |
|---|---|---|---|---|
| GameFacade (autoload) | Core object graph lifetime | Command API + typed signals to UI | all core modules | Node autoload (LOW) |
| GameFlow | Day-sequence state machine; screen routing | `advance()` | GameFacade | SceneTree (LOW) |
| Persistence | user:// files: save slot, autosave, hiscores, settings | `save_game()`, `load_game()`, `hiscores` | GameState via facade | FileAccess — ⚠️ 4.4 `store_*` returns `bool`, must be checked (MEDIUM, verified `breaking-changes.md`) |
| Strings | Hebrew strings table | `tr()` keys | Translation CSV | TranslationServer (LOW); CSV plural support is 4.6 (unused — no plurals needed) |
| ScreenManager | Screen stack, transitions | `push/pop/replace` | PackedScene (LOW) |

Dependency direction (strict, enforced in code review):

```text
ui/ ──► GameFacade ──► core/          core/ never imports ui/, game/, foundation/
game/ ─► GameFacade                   foundation/Persistence ─► core/GameState (dict only)
```

## Data Flow

Turn-based command flow — **no per-frame logic**. Three patterns:

### 1. Simple command (buy, sell, deposit, repair…)

```text
UI click → GameFacade.buy(good, qty)
         → TradeEngine.buy() mutates GameState → returns Result(ok|error)
         → GameFacade emits state_changed(snapshot)
         → all bound UI panels refresh from snapshot (one-way binding)
```

Synchronous, single-threaded. UI never mutates state and never computes rules.

### 2. Conversation (PendingDecision) — TR-ARCH-005

Used when the original game pauses for player input mid-resolution:
pirate choice, compromise offer, crew negotiation, merchant/expand accept,
sail warnings (night/overload), high-score name entry.

```text
GameFacade.sail(plan)
  → VoyageEngine … rolls pirates …
  → returns PendingDecision(kind=PIRATE_CHOICE, context={…})
  → GameFacade emits decision_required(pd); engine state is parked
UI shows PirateScreen → player picks "פשרה" + offer
  → GameFacade.answer(pd.id, {action: COMPROMISE, offer: {...}})
  → PirateEngine resolves … may return another PendingDecision (e.g. fight after reject)
  → final VoyageResult → state_changed + voyage_resolved(result)
```

PendingDecision objects are plain data (serializable) → a save mid-decision is
possible but **disallowed by design** (save only at port, like the original).

### 3. Day sequence (GameFlow)

```text
new day: GameFlow.advance()
  → PriceEngine.roll_daily_prices()          (order: IL→TR→EG, uniqueness rule)
  → weather roll (day≥2)                     → announce screens
  → MorningEventEngine.roll_morning() (day≥2)→ event dialog / PendingDecision
  → PortScreen
```

RNG call order within the sequence is part of fidelity and is pinned by tests
(golden-seed transcripts).

### Save/load path

- `Persistence.save_game()`: GameState.to_dict() + RngService.state() + meta → JSON, user://save.json (+ user://autosave.json at each day start).
- Load: validate → GameState.from_dict() → RngService.restore() → GameFlow resumes at port screen.
- Hiscores: separate user://hiscores.json (10 entries), corruption-tolerant (rebuild empty on parse failure — TR-END-04).

### Initialisation order

```text
GameConfig.load() → Strings.load() → Persistence.init()
→ GameFacade builds core graph (RngService(seed), GameState, engines)
→ ScreenManager → title screen
```

## API Boundaries

The single UI-facing contract (`GameFacade`, autoload). UI may call **only** this:

```gdscript
# Commands — return Result{ok: bool, error: StringName, data: Dictionary}
func new_game(seed: int = -1) -> Result
func buy(good: Good, qty: int) -> Result
func sell(good: Good, qty: int) -> Result
func deposit(amount: int) -> Result
func withdraw(amount: int) -> Result
func repair(amount: int) -> Result
func plan_voyage(dest: Port) -> VoyagePlan      # warnings, guard price, times
func sail(dest: Port, guards: int) -> Result    # may park a PendingDecision
func rest() -> Result                           # next day / end game
func answer(decision_id: int, payload: Dictionary) -> Result
func save_game() -> Result
func load_game() -> Result

# Signals (UI subscribes; snapshot = read-only typed view of GameState)
signal state_changed(snapshot: GameSnapshot)
signal day_started(announcements: Array[EventCard])   # day, weather, morning event
signal decision_required(pd: PendingDecision)
signal voyage_resolved(result: VoyageResult)
signal game_ended(summary: EndSummary)
```

Invariants callers must respect:
- UI never holds references into core objects — only snapshots/results (plain data).
- One PendingDecision open at a time; `answer()` with a stale id is an error.
- All amounts are ints (shekels/tons); the facade validates before delegating.

Guarantees the core makes:
- Any command either fully applies or fully rejects (atomicity — TR-TRADE-01).
- After every mutation exactly one `state_changed` fires.
- Same seed + same command script ⇒ identical outcomes (determinism — TR-ARCH-003).

## ADR Audit

No pre-existing ADRs (`docs/architecture/` contained only the TR registry).
Created in this session, all `Proposed` until user review:

| ADR | Title | Engine Compat | GDD Linkage | Conflicts |
|---|---|---|---|---|
| ADR-0001 | Pure-core / thin-UI separation + PendingDecision pattern | ✅ | ✅ all GDDs | None |
| ADR-0002 | Seedable injected RNG with call-order fidelity | ✅ | ✅ all formulas | None |
| ADR-0003 | External JSON config incl. fidelity-gap flags | ✅ | ✅ all ⚠️ items | None |
| ADR-0004 | Persistence: JSON in user:// (saves, autosave, hiscores) | ✅ (FileAccess 4.4 note) | ✅ scoring-endgame | None |
| ADR-0005 | Compatibility renderer + Windows single-EXE export | ✅ | ✅ platform goal | None |

Traceability: TR-ARCH-001…012 all covered by ADR-0001…0005 (see each ADR's
"GDD Requirements Addressed"). Per-GDD acceptance criteria trace to modules via
the System Layer Map table. `/architecture-review` will build the full matrix.

## Required ADRs (not yet written)

**Should have before the relevant system is built:**
- ADR-0006 Strings & RTL strategy (translation CSV, fonts, BiDi testing) — before UI work
- ADR-0007 Screen management & navigation model (stack vs. hub) — before UI work
- ADR-0008 Original-game verification harness (DOSBox protocol → config updates) — before closing ⚠️ gaps

**Can defer to implementation:**
- Audio bus layout & music strategy
- VFX/shader approach for sea/weather states

## Architecture Principles

1. **Fidelity first**: the original engine's behavior is the spec. Deviations are config-gated and ADR-approved, never ad-hoc.
2. **Pure core, thin shell**: every rule lives in `src/core/` (RefCounted, engine-free); UI renders snapshots and forwards intents.
3. **Determinism everywhere**: one seedable RNG stream, pinned call order, golden-seed transcript tests.
4. **Data over code**: all numbers in JSON config; resolving a ⚠️ gap after DOSBox verification = data edit, not refactor.
5. **RTL-native**: Hebrew is the primary language, not a translation afterthought — layout mirroring and BiDi are tested from the first screen.

## Open Questions

| ID | Summary | Priority | Resolution Path |
|----|---------|----------|-----------------|
| QQ-01 | Pirate **loss** branch numbers (steal/damage) — filled from spec doc | High | DOSBox verification → `pirates.lose.*` config |
| QQ-02 | Final score: cash only or cash+bank | High | DOSBox → `score.include_bank` |
| QQ-03 | Daily price routine (ranges/uniqueness) unverified in binary | High | DOSBox statistical sampling → `price.*` |
| QQ-04 | `base_*` of morning price events (fixed vs. reference) | High | DOSBox → `price_event.base_mode` |
| QQ-05 | `class` variable in voyage risk gate | Medium | DOSBox → `gate.n_formula` |
| QQ-06 | Fog/strike branch probability | Medium | DOSBox → `port_block_chance` |
| QQ-07 | Overload jettison + deserted-ship algorithms | Medium | DOSBox → config |
| QQ-08 | Merchant-sells quantity formula | Medium | DOSBox → config |
| QQ-09 | Crew-strike day-skip counts (1/2 vs 2/3) | Medium | DOSBox → `skip_days_*` |
| QQ-10 | Bank: interest? inclusion in pirate damage caps | Low | DOSBox → `bank.*` flags |
