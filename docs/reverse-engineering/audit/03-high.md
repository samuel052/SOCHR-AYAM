# Binary audit: high region `0x8800–0xCC81`

Source: `C:\socher\socher\K.com` (COM load origin `0x0100`). Addresses below are memory addresses. The audit was made directly from the bytes with 16-bit x86 disassembly; length-prefixed Hebrew strings embedded between calls were classified as inline data, not executable instructions.

## Executive findings

The high region is almost entirely Turbo Pascal 3 generated code with inline Pascal strings. There is no large opaque payload in this range. The only substantial static-data islands are the keyboard translation string at `0xC5DA–0xC637`, local screen/resource names embedded in initializers, and small coordinate/routing tables populated at runtime.

The following earlier reconstruction claims are **incorrect**:

1. **Guard price** (`0xA83B–0xA8DF`) is

   ```text
   W = cash + cargoValue                 // bank excluded
   p = 5 * Trunc(W / (200 + Random(100)))
   p = max(p, 75)
   if voyageRisk > 0: p = p + Trunc(p / 3)
   p = Trunc(p / 5) * 5
   ```

   There is one surcharge only, whether the positive risk came from night, a relevant storm, or both. The storm comparisons at `0xA9B2–0xA9D8` select explanatory text; they do not independently apply another surcharge. The remix formula that omitted the leading `×5`, applied a storm-only surcharge, and rounded rather than truncated is not byte-faithful.

2. **Storm cargo versus damage is exclusive** (`0x9F60–0xA081`). If `cargoValue > 10000`, mode `0x8E` loses cargo and control jumps past damage. Otherwise mode `0x90` adds ship damage. It does not do both.

3. **Derelict ship does not award all three goods** (`0xA6BD–0xA7B7`). Goods are tried in order 1..3. Each try consumes `Random(25)` and computes

   ```text
   found = Trunc(((Random(25)+11)/100) *
                 (cash + currentCargoValue) / centerPrice[good])
   ```

   The loop stops at the **first positive** amount; only that good is added. If a computed amount is zero it advances to the next good, so it consumes 1–3 RNG calls. Bank is excluded. The previously implemented three-good grant using a frozen wealth snapshot is wrong.

4. **The route-event roll is consumed even when it cannot dispatch.** `Random(20)+1` is unconditionally consumed at `0xA5A2–0xA5AB`. Only afterward, at `0xA5CC`, does the code test the encounter flag and skip dispatch. This affects authentic RNG replay.

5. **Night tests occur at the midpoint.** The wrapper animates to midpoint before calling the voyage body (`0xAC77–0xACFD`). Consequently the `hour>=16` night bias at `0xA5AE–0xA5C9` and the `hour>16` reef test at `0xA09B–0xA0A8` use midpoint time, not departure time.

6. Fog/strike eligibility (`0xA36B–0xA396`) is exactly `!encounter && hour + duration + duration/2 <= 20`; there is no extra `+2`. `Random(12)` is consumed only when eligible. If it is zero, animation reaches the destination-side midpoint, then `Random(2)` chooses fog (`1`) or strike (`0`), and the ship returns.

7. Travel is blocked when `damage > 1000` (menu code in `0xB770–0xB95x`). Arrival after `20:00` is blocked at `0xB099–0xB11C`. Arrival after `16:00` triggers the night confirmation at `0xB128–0xB174`.

## Procedure map

| Entry / range | Classification | Purpose and direct effects |
|---|---|---|
| `0x8800–0x893D` | code + inline strings | Tail of bank withdrawal. Valid amount subtracts `[0x2BF]` and adds `[0x2B9]`; zero and overdraw messages. Entry begins below this audit range. |
| `0x8942–0x89B1` | procedure | Capacity/overweight warning predicate. Compares argument with `[0x2AD]`, may show `OVERWGHT`, returns boolean. |
| `0x89B5–0x8AC0` | procedure | Port-to-map coordinate setup and map rendering helper. Calls `0x4C6D`, screen primitives and loaders. |
| `0x8AC4–0x8ACF` | thunk | Establishes frame and jumps to `0xAEA2`. |
| `0x8AD0–0x8D73` | procedure | Map animation. Updates `[0x2B1]` once per 60 ticks (`0x8C40–0x8C48`) and stores current plotted coordinates in caller locals. |
| `0x8D77–0x8D85` | thunk | Voyage-body entry; jumps to `0x9E62`. |
| `0x8D86–0x8D97` | thunk | Pirate encounter entry; jumps to `0x97D8`. |
| `0x8D98–0x8F1E` | procedure | Optional combat damage helper. `Random(n)==0`; damage is `10 * Trunc(((Random(15)+5)/1000) * (cash+cargoValue))`, added to `[0x2B3]`. Bank excluded. The `mov cx,0x14` at `0x8DE7` is a stack-check argument, not a multiplier; the actual multiplier is the pushed 10 at `0x8DC3`, popped before `imul` at `0x8DFD`. Mode argument selects message. |
| `0x8F22–0x97D7` | procedure | Pirate battle and outcome: `Random(4)` ואז `Random(6)` תמיד, capture/treasure/plunder paths, guard effects, cash/cargo/damage mutation. Calls combat-damage helper and low-region cargo helpers. |
| `0x97D8–0x9BDE` | procedure body | Pirate UI and action dispatch: fight, escape, ransom. Reads total cargo, damage, capacity and cash; failed escape/ransom calls battle with disadvantage. |
| `0x9BE2–0x9CA7` | procedure | Overload probability. For total cargo argument: over capacity by `>70→k=1`, `>60→2`, `>40→3`, `>20→4`, `>0→6`; returns `Random(k)==0`. |
| `0x9CAB–0x9D18` | procedure | Special-hazard gate. `k=1+Trunc((damage+399)/400)+2*risk`; consumes **both** `Random(k)` and `Random(2)` unconditionally, then ANDs their Boolean results; true iff first result `>0` and second is `1`. Raw sequence: first call `0x9CE9`, Boolean materialization, second call `0x9CF9`, then `and ax,cx` at `0x9D06`. |
| `0x9D1C–0x9E61` | procedure | Deterministic navigation error. Intended Israel becomes Turkey; all other intended ports become Israel. Adds 4 hours only for origin Egypt and resulting destination Turkey (`0x9E14–0x9E56`). |
| `0x9E62–0xA7EE` | procedure body | Voyage event engine: hazard, storm/reef/damage, overload, fog/strike, unconditional R2 roll, pirates/navigation/derelict/quiet dispatch. Mutates `[0x2CD]`, damage and cargo. |
| `0xA7F2–0xA800` | thunk | Establishes frame and jumps to `0xABB2`. |
| `0xA801–0xABAF` | procedure | Guard offer/purchase. Exact price formula above; reads risk by reference, cash, origin/destination/storm port; obtains number of guards and subtracts `count*price` from cash. |
| `0xABB2–0xAEA1` | procedure body | Executes one voyage: guard offer, route indices/tables, animation to midpoint, calls voyage body, then animates remaining/redirected legs. |
| `0xAEA2–0xB29D` | procedure body | Travel menu/wrapper: choose destination, derive 4/8-hour duration, enforce arrival/night gates, compute risk 0/2/3/4 and call guard/voyage wrapper. |
| `0xB2A1–0xB2AC` | thunk | Repair entry; jumps to `0xB346`. |
| `0xB2AD–0xB343` | procedure | Repair-payment validator: amount must be positive and `<=cash`; returns retry flag. |
| `0xB346–0xB4DE` | procedure body | Repair UI. Validator limits payment only by cash, **not by current damage**. The full entered amount is subtracted from cash and damage; negative damage is then clamped to zero. Therefore overpaying is legal and permanently wastes the excess cash. |
| `0xB4E2–0xB527` | procedure | Bankruptcy predicate: `damage > cash + bank + cargoValue`. |
| `0xB52A–0xBC0F` | large procedure body | New-day and main port-menu loop. Resets hour to 8, prices/weather/morning events; dispatches buy/sell/travel/bank/rest/repair/help; checks dock closure, bank dead gate and damage travel block. Bankruptcy is checked only when leaving the port-menu loop for the day, as detailed below. |
| `0xBC11–0xC4DA` | procedure | Resource and table initializer. Loads SCR/WIN/SGN assets into far pointers `0xA6C–0xB2E`, fills names, center prices, weekday labels, route matrix `0x31F`, and coordinate table `0x368–0x386`. |
| `0xC4DC–0xC5C6` | procedure | Intro and new-game state initialization. Bank/damage/cargo zero; capacity 100; Israel; dock day=`Random(7)+1`; bank-closed day=`Random(7)+1` then overwritten with 0; cash 5000; previous event 0. |
| `0xC5C8–0xC5CE` | thunk | High-score entry; jumps to `0xC7D4`. |
| `0xC5CF–0xC7D1` | procedure + data | Name-entry/editor. Static keyboard/allowed-character tables occupy `0xC5DA–0xC637`; code resumes `0xC639`. |
| `0xC7D4–0xCBAF` | procedure body | `WINNERS.WIN` read/insert/write and score display. Record stride is 27 bytes. |
| `0xCBB2–0xCC81` | program main | Initializes resources/game, runs days 1..7, computes final score `cash+bank`, updates high scores, asks replay, then exits through runtime `0x10C89`. |

## Exact voyage/RNG order

For a committed voyage the externally visible RNG order is:

1. Guard price: `Random(100)` (`0xA84F–0xA856`). This is consumed even if the player hires zero guards, because price is calculated before input.
2. Hazard gate: `Random(k)` at `0x9CE9` and `Random(2)` at `0x9CF9` are **both always consumed**; their materialized Boolean values are ANDed at `0x9D06`.
3. If hazard is true and damage was zero: `Random(3)` at `0x9EB0` decides damage-path versus navigation error.
4. Storm/damage/loss helpers then consume their own RNG only on the selected exclusive branch.
5. If no hazard and overloaded: overload `Random(k)` at `0x9C80`; on success loss mode `0x99` consumes any required loss RNG.
6. If no event and fog eligibility holds: `Random(12)` at `0xA39B`; if zero, `Random(2)` at `0xA40F` chooses fog/strike.
7. **Always:** `Random(20)` at `0xA5A2`, even if a prior event set `[0x2CD]`. Dispatch is suppressed afterward when the flag is set.
8. If R2 is 9 or 10 and dispatch is allowed: `Random(25)` once per commodity attempted, stopping at first positive result (maximum three calls).
9. Pirate subflow always consumes `Random(4)` then `Random(6)`, followed by branch-specific calls mapped in `0x8D98–0x9BDE`.

## Integration-critical control flow

### Bankruptcy is not checked after each action

The sole high-region call is `0xBB8D -> 0xB4E1`. The port menu loops back at `0xBB76 -> 0xB6BA` after ordinary actions, trades, repairs and voyages. It reaches the bankruptcy call only after the loop is exited because either menu action `5` (rest/end day) was chosen or Escape (`[0x2CB]==0x1B`) was pressed (`0xBB54–0xBB74`). The test is additionally ANDed with `day < 7` at `0xBB79–0xBB93`. Thus:

```text
repeat port menu
until action == REST or key == ESC
if day < 7 and bankrupt(): force day := 7 and end the game
```

It is **not** checked immediately after damage, a voyage, trade, bank action or repair, and it is skipped on day 7.

### Crew event and the skipped day

The morning-event engine (`0x6166`, called at `0xB650` only when day>1) increments `[0x2AF]` by one at its crew-new-hire path (`0x717D`, also reached after a failed retention offer). Control returns directly to `0xB653`; the high routine does not rerun new-day initialization, prices, weather, or the 08:00 reset. Therefore the increment consumes one calendar-day number immediately while continuing the already initialized morning. When the player later ends that playable day, main increments the day once more. This is the implementation behind “עברו יומיים”: one numbered day is skipped, not a second full port-menu/day simulation.

### Pirate midpoint state and arrival commit

The wrapper animates origin→midpoint first (`0xAC77–0xACCB`), which advances `[0x2B1]`; it then calls the voyage engine at `0xACFD`. During pirate UI/battle:

- `[0x2B1]` is the midpoint hour.
- `[0x281]` is still the origin/current port.
- `[0x28C]` is the saved origin and `[0x297]` is the intended (or subsequently redirected) destination.

After the pirate routine returns, the wrapper continues from midpoint through any remaining/redirection legs (`0xAD00–0xAE48`). Only after the voyage wrapper completes does the travel menu copy destination into current location (`0xB22A–0xB238`). A pirate encounter itself neither commits arrival nor resets the hour; surviving continues the same voyage from midpoint.

## State map used by this region

| Address | Meaning | High-region access |
|---|---|---|
| `0x281` | current port | travel, guards, map, initialization |
| `0x28C` | voyage origin | wrapper, navigation, map |
| `0x297` | destination | wrapper, navigation, weather relevance |
| `0x2A2` | storm port / blank | hazard and guard explanation |
| `0x2AD` | capacity | overload, escape, capture, initialization |
| `0x2AF` | day | day loop, closures, final-day warning |
| `0x2B1` | hour byte | animation, midpoint/night tests, arrival gates |
| `0x2B3` | damage Real | hazard, combat, repair, bankruptcy |
| `0x2B9` | cash Real | guards, bank, combat, repair, score |
| `0x2BF` | bank Real | bank UI, bankruptcy, final score; excluded from guard/derelict/ordinary voyage damage wealth |
| `0x2C5` | bank-closed day | initialized randomly then zeroed (dead feature) |
| `0x2C7` | voyage risk | 0 day-clear, 2 night, 3 storm, 4 night+storm |
| `0x2C9` | prior daily event | initialized here; used by morning engine below range |
| `0x2CB` | keyboard input byte | guard input loop |
| `0x2CD` | voyage-event flag | gates overload/fog/dispatch |
| `0x2CE` | dock-closed day | one random day 1..7 |
| `0x2D4/6/8` | center prices | initialized 3000/500/50 |
| `0x2F8/FA/FC` | cargo tons | derelict, pirates, init |

## Cross-range calls

Important calls below `0x8800`: `0x0FD1` stack check; `0x10DA` Random; `0x1973–0x1B38` Turbo Pascal Real operations; `0x2DC3/0x2DC6` BGI image capture/placement (file loading itself is at `0x4312+`); `0x41AD–0x41FC` keyboard/pause; `0x4311/0x43BE/0x4480/0x457B` resource loading; `0x4648` cargo value; `0x46D0` total cargo; `0x4C6D/0x4CE1` port conversion; `0x4D51/0x4F59/0x530F` menu/numeric/yes-no input; `0x5718/0x579A` offer validation; `0x5CC9` shared loss; `0x5FE5` price generation; `0x60F4` weather; `0x6166` morning events; `0x7CE1` day display.

Calls above `0xCC81` are compiler/runtime services (`0x10xxx–0x14xxx`): stack checks, strings, screen/keyboard, file I/O, Real arithmetic and program termination. No game-state logic was attributed to them without a direct call-site semantic check.

## Uncertainties and byte-level cautions

- The smart disassembler intentionally skips Pascal strings after string-write calls. Raw linear disassembly would otherwise render Hebrew bytes as false x86 instructions; examples include the apparent garbage around `0x9EE1`, `0xA671`, `0xB455`, and `0xCC51`. These are classified as inline data, not gaps in control flow.
- The audit starts at `0x8800` in the middle of the bank procedure; its true entry is below the assigned range.
- `0x8D98` combat-damage parameter semantics are established from its two call sites, but the exact human label of each numeric mode is UI-only.
- The resource initializer stores far pointers returned by loaders; file extensions are supplied by the loader family and therefore are not always present in the inline basename.
- The coverage CSV is byte-contiguous from `0x8800` through `0xCC81`. The 20 previously omitted short spans were verified byte-for-byte and assigned to their enclosing records: complete `RET imm16` operands and adjacent `PUSH BP` prologue bytes, except `0xC638`, which is the final space byte of the keyboard translation table. `0xCC80–0xCC81` is padding after termination.
