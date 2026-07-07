# Technical Preferences

<!-- Populated by /setup-engine. Updated as the user makes decisions throughout development. -->
<!-- All agents reference this file for project-specific standards and conventions. -->

## Engine & Language

- **Engine**: Godot 4.6 (pinned 2026-02-12; see `docs/engine-reference/godot/VERSION.md`)
- **Language**: GDScript with static typing (every var/param/return typed)
- **Rendering**: 2D, **Compatibility renderer (OpenGL)** — widest support on older Windows machines (target audience: adults on modest PCs); pixel-art with nearest-neighbor filtering
- **Physics**: Not used (turn-based game, no physics simulation)

## Input & Platform

- **Target Platforms**: Windows desktop (x86_64), offline single-player
- **Input Methods**: Mouse (primary), Keyboard (shortcuts + text/number entry)
- **Primary Input**: Mouse — every game action must be fully playable with mouse only
- **Gamepad Support**: None
- **Touch Support**: None
- **Platform Notes**: Hebrew RTL UI throughout (Godot 4 TextServer BiDi). Windowed + fullscreen. No network access at runtime.

## Naming Conventions

- **Classes**: PascalCase (`class_name TradeEngine`)
- **Variables**: snake_case; private prefixed `_`
- **Signals/Events**: snake_case, past tense (`voyage_resolved`, `price_changed`)
- **Files**: snake_case (`trade_engine.gd`, `main_port_screen.tscn`)
- **Scenes/Prefabs**: snake_case `.tscn`, one scene per screen/component
- **Constants**: CONSTANT_CASE; enums PascalCase with CONSTANT_CASE members

## Performance Budgets

- **Target Framerate**: 60 FPS
- **Frame Budget**: 16.6 ms (trivially met; no per-frame simulation)
- **Draw Calls**: < 100 per screen
- **Memory Ceiling**: < 512 MB

## Testing

- **Framework**: gdUnit4 (headless via `godot --headless --script tests/gdunit4_runner.gd`)
- **Minimum Coverage**: 100% of game-logic formulas (every formula from the reverse-engineering docs gets at least one unit test; RNG injected/seeded for determinism)
- **Required Tests**: Balance formulas, event-engine distributions (statistical tests with fixed seeds), game-state transitions

## Forbidden Patterns

- **No game logic in UI scripts.** All rules/formulas/RNG live in the pure logic module (`src/core/`), which must not reference the scene tree, `Node`, or any UI type (use `RefCounted`).
- **No direct `randi()`/`randf()` in logic code.** All randomness flows through an injected RNG service (seedable for tests and replays).
- **No hardcoded balance values.** Every tunable number lives in external config (`assets/data/*.json` or `.tres`), loaded at startup — per coding standards.
- **No deviation from original-game formulas without an approved ADR.** Source of truth: binary reverse-engineering docs; gaps filled per the decisions log in `תיעוד התקדמות.md`.
- **No hardcoded UI strings.** All player-facing text goes through a strings table (Hebrew now, translatable later).

## Allowed Libraries / Addons

- gdUnit4 (testing only)
- [Add others via ADR approval]

## Architecture Decisions Log

- [ADRs to be created in the architecture phase — use /architecture-decision]

## Engine Specialists

- **Primary**: godot-specialist
- **Language/Code Specialist**: godot-gdscript-specialist
- **Shader Specialist**: godot-shader-specialist
- **UI Specialist**: ui-programmer (consulting godot-specialist for Control/RTL specifics)
- **Additional Specialists**: —
- **Routing Notes**: Logic-module code review always goes through godot-gdscript-specialist; RTL/BiDi UI questions go to godot-specialist.

### File Extension Routing

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (`.gd`) | godot-gdscript-specialist |
| Shader / material files (`.gdshader`, `.tres` materials) | godot-shader-specialist |
| UI / screen files (Control scenes, theme `.tres`) | ui-programmer |
| Scene / prefab / level files (`.tscn`) | godot-specialist |
| Native extension / plugin files | godot-gdextension-specialist |
| General architecture review | godot-specialist (Primary) |
