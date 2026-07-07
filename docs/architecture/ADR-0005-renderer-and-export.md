# ADR-0005: Compatibility Renderer + Windows Single-EXE Export

## Status

Proposed

## Date

2026-07-07

## Last Verified

2026-07-07

## Decision Makers

Technical Director (agent), pre-approved scope by project owner

## Summary

The game targets nostalgic adult players on potentially old Windows machines, so
we pin the **Compatibility (OpenGL 3.3) renderer** — deliberately sidestepping
Godot 4.6's new D3D12-default on Windows — and ship a single Windows x86_64 EXE
with embedded PCK, offline, via Godot export templates.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Godot 4.6 |
| **Domain** | Rendering / Platform |
| **Knowledge Risk** | HIGH — 4.6 changed the Windows default backend to D3D12 (post-cutoff); mitigated by explicitly pinning Compatibility |
| **References Consulted** | `docs/engine-reference/godot/modules/rendering.md`, `breaking-changes.md`, `current-best-practices.md` |
| **Post-Cutoff APIs Used** | None at code level; project settings only |
| **Verification Required** | Exported EXE runs on a machine without D3D12 support; pixel-art nearest filtering renders crisply at non-integer window scales; Hebrew text renders correctly under Compatibility |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | None |
| **Enables** | Art pipeline decisions; release pipeline |
| **Blocks** | Project scaffolding (project.godot must set these before first scene) |
| **Ordering Note** | Renderer choice must precede any shader/VFX work (feature set differs) |

## Context

### Problem Statement

Target hardware is unknown and skews old (audience: players of the 1980s-90s
original). Godot 4.6 defaults to Forward+/D3D12 on Windows — heavier feature
set and driver expectations than this 2D UI game needs. The deliverable is one
offline EXE a non-technical adult can run.

### Current State

Greenfield; no project.godot yet.

### Constraints

- 2D pixel-art UI game: no need for Forward+ features (SSR, TAA, stencil…).
- Performance budget trivially low (turn-based; 60 FPS target).
- No installer infrastructure planned — double-click EXE.

### Requirements

- TR-ARCH-012 (single EXE, offline); technical-preferences rendering choice; UX docx (fullscreen+windowed).

## Decision

1. `project.godot`: renderer = `gl_compatibility` (with `gl_compatibility` also
   as the mobile/fallback method); disable unused 3D features.
2. 2D settings: default texture filter = **Nearest** (pixel-art); viewport
   design resolution 640×360 (16:9, integer-scales to 720p/1080p/4K), stretch
   mode `canvas_items`, aspect `keep` — final numbers may be revised by the art
   bible, recorded here as the working default.
3. Export preset "Windows Desktop": x86_64, embed PCK = on ⇒ single EXE;
   icon + Hebrew product metadata; no console window.
4. Offline guarantee: no HTTPRequest/ENet usage anywhere (review-enforced);
   export excludes network-facing features.
5. Windows only for 1.0 (Linux/macOS trivially possible later; out of scope).

### Implementation Guidelines

- Test on the oldest available GPU/driver combo early (first vertical slice, not at release).
- Keep all rendering effects within the Compatibility feature set (no stencil, no compositor effects).
- CI export job produces the EXE artifact from day one (release-manager owns the pipeline later).

## Alternatives Considered

### Alternative 1: Forward+ / D3D12 (4.6 defaults)

- **Pros**: full feature set, engine default path.
- **Cons**: heavier driver requirements on exactly the old machines we target; features unused by a 2D card-and-panels game.
- **Rejection Reason**: audience hardware risk with zero benefit.

### Alternative 2: EXE + external PCK

- **Pros**: patchable data without re-shipping EXE.
- **Cons**: two files to lose; confusing for non-technical users.
- **Rejection Reason**: single-file simplicity is a project goal; updates re-ship whole EXE.

## Consequences

### Positive

- Broadest old-hardware support (OpenGL 3.3, ~2010+ GPUs).
- One-file distribution; trivial "send to grandpa" story.

### Negative

- No Forward+-only visual features (acceptable: pixel-art direction doesn't want them).
- Embedded PCK means every patch is a full ~50-100 MB re-download (acceptable offline).

### Neutral

- Design-resolution choice (640×360) will be revisited by the art bible; changing it before art production starts is free.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Hebrew/BiDi rendering quirk specific to Compatibility | Low | High | RTL smoke test in first playable build (ADR-0006 will define it) |
| Very old GPU below GL3.3 | Low | Medium | Stated minimum requirement; original DOSBox remains for them 🙂 |

## Validation Criteria

- [ ] Exported single EXE boots on a clean Windows 10 VM with no dev tools.
- [ ] Renderer reported at runtime is Compatibility/OpenGL on all test machines.
- [ ] Pixel-art test scene renders with crisp nearest-neighbor scaling at 720p/1080p/4K.

## GDD Requirements Addressed

Foundational — no single GDD requirement. Enables: the entire Presentation
layer; satisfies the project-level deliverable (Windows offline EXE) and the
technical-preferences rendering/platform rows.

## Related

- ADR-0001 (core unaffected by renderer), future ADR-0006 (RTL strategy tests under this renderer).
