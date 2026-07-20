# Technical Preferences — Socher Hayam

This file is authoritative for studio agents. The engine and stack are already configured; do not run engine onboarding.

## Engine & Language

- **Engine**: Custom browser game; no Godot, Unity or Unreal runtime.
- **Language**: JavaScript ES modules, HTML and CSS.
- **Rendering**: Browser DOM, CSS and SVG.
- **Physics**: None. Gameplay simulation is deterministic JavaScript logic under `src/core/`.

## Input & Platform

- **Target Platforms**: Modern desktop and mobile web browsers.
- **Input Methods**: Mouse, keyboard and touch-capable controls.
- **Primary Input**: Pointer/touch interaction.
- **Gamepad Support**: Not currently planned.
- **Touch Support**: Required for the final UX.
- **Platform Notes**: Hebrew RTL is primary; responsive layout and readable numeric state are required.

## Naming Conventions

- **Functions and variables**: `camelCase`.
- **Classes**: `PascalCase`.
- **Constants**: existing exported names and domain conventions; avoid gratuitous renames.
- **Files**: lowercase descriptive names matching the current modules.
- **Events**: explicit domain verbs and outcomes.

## Performance Budgets

- **Target Framerate**: 60 FPS for visual transitions.
- **Simulation**: synchronous actions should be imperceptible to the user.
- **Dependencies**: prefer zero-runtime-dependency browser code unless a dependency is explicitly approved.

## Testing

- **Framework**: Node.js built-in test runner.
- **Required command**: `npm test`.
- **Full consistency gate**: `npm run verify`.
- **Required coverage**: every changed gameplay formula, boundary and event ordering rule needs a regression test.

## Forbidden Patterns

- Changing gameplay formulas or RNG call order for presentation convenience.
- Reading mechanics from `archive/legacy-analysis/`.
- Editing files under `reference/original-game/`.
- Introducing an engine migration without explicit user approval.

## Allowed Libraries / Addons

- No third-party runtime dependency is currently required.
- New dependencies require a concrete benefit and user approval.

## Specialists

- **Gameplay logic**: JavaScript/gameplay programmer with fidelity verification.
- **UI**: Web UI/UX specialist familiar with Hebrew RTL and responsive interaction.
- **Architecture**: General web architecture; engine-specific agents are not applicable.

| File type | Routing |
|---|---|
| `src/core/*.js` | Gameplay programmer + fidelity tests |
| `src/ui/*.js`, `src/index.html`, CSS | Web UI programmer + UX review |
| `src/tests/*.test.js` | QA/gameplay verification |
| `design/**` | Game designer or UX designer |
| `docs/reverse-engineering/**` | Reverse-engineering reviewer |
