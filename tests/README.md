# Test Infrastructure

**Engine**: Godot 4.6
**Test Framework**: gdUnit4
**CI**: `.github/workflows/tests.yml`
**Setup date**: 2026-07-07

## Directory Layout

```
tests/
  unit/           # Isolated unit tests (formulas, state machines, logic)
  integration/    # Cross-system and save/load tests
  smoke/          # Critical path test list for /smoke-check gate
  evidence/       # Screenshot logs and manual test sign-off records
  helpers/        # FakeRng, config loading, factories
```

## Running Tests

```bash
# Headless (CI and local):
godot --headless -s res://addons/gdUnit4/bin/GdUnitCmdTool.gd -a tests/unit -a tests/integration

# Or in-editor via the GdUnit4 panel.
```

## Installing GdUnit4

1. Open Godot → AssetLib → search "GdUnit4" → Download & Install
2. Enable the plugin: Project → Project Settings → Plugins → GdUnit4 ✓
3. Restart the editor. Verify: `res://addons/gdUnit4/` exists.

CI installs gdUnit4 automatically via `MikeSchulze/gdUnit4-action`.

## Test Naming

- **Files**: `[system]_[feature]_test.gd`
- **Functions**: `test_[scenario]_[expected]`
- **Example**: `price_engine_test.gd` → `test_daily_prices_within_original_ranges()`

## Project-Specific Rules

- **All randomness via injected RNG** (ADR-0002): formula edge tests use
  `tests/helpers/fake_rng.gd` (scripted values); distribution tests use a
  seeded `RngService` with fixed seeds.
- **Config from real data files**: `tests/helpers/config_loader.gd` loads
  `assets/data/*.json` so tests validate the shipped values (drift guard).
- **Fidelity citations**: every formula test cites its GDD section in a comment.

## Story Type → Test Evidence

| Story Type | Required Evidence | Location |
|---|---|---|
| Logic | Automated unit test — must pass | `tests/unit/[system]/` |
| Integration | Integration test OR playtest doc | `tests/integration/[system]/` |
| Visual/Feel | Screenshot + lead sign-off | `tests/evidence/` |
| UI | Manual walkthrough OR interaction test | `tests/evidence/` |
| Config/Data | Smoke check pass | `production/qa/smoke-*.md` |

## CI

Tests run automatically on every push to `main`/`claude/**` and on every pull
request. A failed test suite blocks merging.
