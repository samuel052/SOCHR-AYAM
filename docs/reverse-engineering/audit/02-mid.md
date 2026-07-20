# Binary audit 02 — memory 0x4500–0x87FF

## Scope and method

This is a byte-grounded audit of `C:\socher\socher\K.com` (SHA-256 `10756C77D923CBB8937FD9D8D91C61B15178D47BF6EB9321196AE51C31789625`; DOS COM origin `0x100`). Therefore `file_offset = memory_address - 0x100`. The range covers file offsets `0x4400–0x86FF`, inclusive.

The audit used 16-bit x86 decoding, Turbo Pascal 3 stack-frame signatures, direct control-flow tracing, validation of every relative `CALL`/`JMP`, and explicit skipping of Pascal length-prefixed strings and six-byte `Real` constants. Existing prose documentation was used only after the byte-level result had been established.

There are no detached static tables and no unexplained padding gaps in this interval. It is executable code throughout, interleaved with:

- 130 Pascal length-prefixed inline strings (including zero-length strings used as output separators);
- 19 embedded six-byte Turbo Pascal `Real` constants;
- immediate coordinate/menu records materialized by `MOV` instructions (these are code, not standalone tables).

The only boundary fragments are `0x4500–0x4501`, the tail of a string begun before the requested range, and `0x852D–0x87FF`, which ends in the middle of the bank procedure. The exact continuous classification is in `02-mid-ranges.csv`.

## Procedure map

| Memory entry | File entry | End in range | Role | Calls/state highlights |
|---|---:|---:|---|---|
| continuation of `0x4480` | `<0x4400` | `0x457A` | day-sign resource loader | string/resource runtime; returns far buffer |
| `0x457B` | `0x447B` | `0x4647` | `.scr` resource loader | filesystem/resource calls below `0x4500` |
| `0x4648` | `0x4548` | `0x46CF` | center-valued cargo total | reads cargo `0x2F8/FA/FC`, centers `0x2D4/D6/D8`; Real arithmetic |
| `0x46D0` | `0x45D0` | `0x4722` | total cargo tons | reads `0x2F8/FA/FC` |
| `0x4723` / nested `0x472A` | `0x4623` / `0x462A` | `0x4882` | Real formatter | uses `Int` `0x1ABA`, `Frac` `0x1AC7`; tail-jump `0x1498` |
| `0x4883` | `0x4783` | `0x4955` | best-cargo selector | argmax of `cargo[i]×center[i]`, constrained by minimum tons |
| `0x4956` | `0x4856` | `0x49EE` | weather display | selects `goodwthr.scr`/`badwthr.scr` |
| `0x49EF` | `0x48EF` | `0x4BED` | status/dashboard renderer | reads port, weather, bank, capacity, damage, prices and cargo |
| `0x4BEE` | `0x4AEE` | `0x4C6C` | key/menu wrapper | refresh key invokes `0x49EF` |
| `0x4C6D` | `0x4B6D` | `0x4CE0` | port name → index | Turkey 1, Israel 2, Egypt 3 |
| `0x4CE1` | `0x4BE1` | `0x4D50` | port index → name | tail-jump `0x1498` |
| `0x4D51` | `0x4C51` | `0x4F58` | coordinate-driven menu engine | Enter/Esc and navigation; no game-state writes |
| `0x4F59` | `0x4E59` | `0x52DD` | Real number editor | validates inclusive bounds; `D` opens status |
| `0x52DE` | `0x51DE` | `0x530E` | integer input wrapper | calls `0x4F59`, then `Trunc` |
| `0x530F` | `0x520F` | `0x5458` | yes/no confirmation | Hebrew and Latin key aliases |
| `0x5459` | `0x5359` | `0x545F` | outer-game trampoline | cross-range jump to `0xB52A` |
| `0x5460` | `0x5360` | `0x56DF` | nested ledger/status renderer | reads day, hour, cash, bank, capacity, damage, prices/cargo |
| `0x56E0` | `0x55E0` | `0x5717` | byte predicate | exact condition is input byte `== 0x1A`; semantic name remains unknown |
| `0x5718` | `0x5618` | `0x5799` | cash affordability validator | rejects proposed amount strictly greater than cash |
| `0x579A` | `0x569A` | `0x5CC8` | negotiation/payment | nested validators `0x57A6`, `0x584C`; strict acceptance comparison |
| `0x5CC9` | `0x5BC9` | `0x5FE4` | shared loss routine | cargo/cash/overload/damage mutations |
| `0x5FE5` | `0x5EE5` | `0x60F3` | daily price engine | exactly nine calls to `Random` |
| `0x60F4` | `0x5FF4` | `0x6165` | weather selector | day 1 clear; otherwise `Random(8)<3`, then random port |
| `0x6166` | `0x6066` | `0x6171` | daily-event trampoline | jumps to `0x64AE` |
| `0x6172` | `0x6072` | `0x64AD` | price-shock helper | writes one of nine price locals in the outer frame |
| `0x64AE` | `0x63AE` | `0x7CE0` | daily-event selector/body | all event handlers and final reroll/commit logic |
| `0x7CE1` | `0x7BE1` | `0x7D7E` | new-day splash | `newday.scr` |
| `0x7D7F` | `0x7C7F` | `0x8111` | ordinary purchase at port | subtracts cash and adds selected cargo only after validation |
| `0x8112` / nested `0x811E` | `0x8012` / `0x801E` | `0x852C` | ordinary cargo sale | outer body begins `0x81BE`; validates tons, adds cash, removes cargo |
| `0x852D` | `0x842D` | beyond `0x87FF` | bank | deposit complete in range; withdrawal continues to `0x893A` |

## Random calls — complete list in the interval

`Random(n)` returns `0..n-1`. There are 39 calls:

| Addresses | Bound / purpose |
|---|---|
| `0x5C33` | `6`, negotiation demand divisor `+4` |
| `0x5D37` | `21`, cargo loss percentage `20..40` |
| `0x5F33` | `40`, cash-loss divisor `40..79` |
| `0x5F8D` | `30`, damage divisor `50..79` |
| `0x5FFB, 0x604F, 0x60A3` | `11`, copper price rolls for three ports |
| `0x6017, 0x606B, 0x60BF` | `7`, olive price rolls for three ports |
| `0x6033, 0x6087, 0x60DB` | `8`, wheat price rolls for three ports |
| `0x6105` | `8`, storm gate |
| `0x6139` | `3`, storm port |
| `0x64BC` | `30`, raw daily event |
| `0x6748, 0x677B` | `6`, two independent rich-player override gates |
| `0x67C1, 0x6827, 0x688D, 0x68F1, 0x6958, 0x69BD` | `3`, affected port in each price-shock variant |
| `0x67D8, 0x68A0, 0x6908` | `5`, copper/wheat shock magnitude variants |
| `0x683E` | `4`, olive upward magnitude |
| `0x696B, 0x69D0` | `3`, olive/wheat downward magnitude |
| `0x6A50` | `2`, expansion size (`50` or `100`) |
| `0x6A63` | expansion-size bound, expansion price |
| `0x72F6, 0x7511, 0x772C` | `30`, `70`, `14`; merchant-buy offer prices by commodity |
| `0x7930` | `3`, merchant-sell commodity |
| `0x7958` | selected center price, merchant-sell unit price |
| `0x7989` | `Trunc(0.75×cash)+1`, merchant-sell quantity seed |
| `0x7C3B` | `80`, collision damage divisor `150..229` |

The selector also evaluates both rich-player `Random(6)` calls even when the cash comparison is false; the compiler emitted non-short-circuit Boolean evaluation.

## Turbo Pascal Real-library calls

Direct call counts in this exact interval:

| Routine | Address | Count |
|---|---:|---:|
| load Real | `0x1973` | 107 |
| load embedded constant | `0x1982` | 19 |
| store Real | `0x1993` | 42 |
| add/subtract/multiply/divide | `0x19A6/0x19C1/0x19D0/0x19DF` | `20/9/29/13` |
| compare `=`, `!=`, `>=`, `<=`, `>`, `<` | `0x1A0E/28/42/5C/76/90` | `1/2/6/11/17/5` |
| `Int`, `Frac`, `Round`, `Trunc` | `0x1ABA/0x1AC7/0x1AF6/0x1AFA` | `2/1/1/19` |
| integer → Real | `0x1B2F`, `0x1B38` | `83`, `9` |

Embedded Real byte ranges are:

`4684–4689, 48BB–48C0, 491A–491F, 550A–550F, 552C–5531, 5D2E–5D33, 673B–6740, 676E–6773, 6B92–6B97, 748B–7490, 76A6–76AB, 78C1–78C6, 7973–7978, 7990–7995, 79E3–79E8, 8083–8088, 846C–8471, 849B–84A0, 84CA–84CF`.

The non-unit constants are `10000`, `100000`, `20`, `20000`, `45000`, `0.75`, and `0.25`; the remaining embedded constants are `1.0`.

## State reads and writes

| State | Address | Read/write behavior in this range |
|---|---:|---|
| current port name | `0x281` | read by display, trade and status routines |
| weather/storm port string | `0x2A2` | read by weather/status display |
| ship capacity | `0x2AD` | read broadly; increased at `0x6DEA–0x6DF0` only after expansion confirmation |
| day | `0x2AF` | read by status/weather/events; incremented at `0x717D–0x7183` after failed crew negotiation |
| hour | `0x2B1` | read by status; this byte is hour, not capacity |
| accumulated ship damage | `0x2B3` | read by status; collision adds damage at `0x7C82–0x7C97`; loss mode `0x90` also adds damage |
| cash Real | `0x2B9` | read throughout; mutated by loss, expansion, both trade paths and bank deposit |
| bank Real | `0x2BF` | read by status/expansion/bank; expansion and deposit mutate it |
| previous successful event | `0x2C9` | read by no-repeat gate; written only at `0x7CD4–0x7CD7` after an applicable event finishes |
| keyboard byte | `0x2CB` | used by menu/status wrappers |
| center prices | `0x2D4/0x2D6/0x2D8` | immutable reads in this interval; copper/olive/wheat `3000/500/50` |
| cargo tons | `0x2F8/0x2FA/0x2FC` | read by valuation/status; mutated by loss, expansion payment, merchant events and ordinary trade |
| compiler loop temporary | `0x275` | written/read in expansion loops; not persistent game design state |

Daily market prices themselves live in the outer main frame, not global fixed addresses. The price engine and price-shock helper access them through the saved outer `BP` link.

## Fully resolved mechanics and discrepancies

### Negotiation demand is an unrounded Real

At `0x5C15–0x5C3F`:

```text
demand = (cash + cargoCenterValue) / (Random(6) + 4)
```

There is no `Trunc`, `Round`, `Int`, or conversion between the division and `FStore` at `0x5C3F`. The offer is `cashOffer + q1×3000 + q2×500 + q3×50`. At `0x5C42–0x5C55`, the code calls `F>` (`0x1A76`): acceptance is strictly `offer > demand`, never equality. Bank balance is excluded. Only the accepted branch `0x5C58–0x5CAA` deducts resources.

### Every expansion-payment path, including equality bugs

At `0x6A49–0x6A73`:

```text
size = 50 × (Random(2) + 1)
cost = 10 × (2×size + Random(size))
```

The applicability gate at `0x6A76–0x6AA2` is inclusive: `cost <= cash + bank + cargoCenterValue`. If false, the event-result flag is cleared at `0x6F61–0x6F64`, causing a complete reroll.

The local payment plan then follows this exact order:

1. `cash > cost` (strict) → all cash.
2. Else `bank > cost` (strict) → all bank.
3. Else `(cash + bank) > cost` (strict) → `cashPart=Trunc(cash)`, `bankPart=cost-cashPart`.
4. Else choose the highest center-valued cargo and use cargo, optionally plus one monetary source.

Equality therefore falls through. In particular, `cash == cost` with zero bank, or `bank == cost` with zero cash, enters the cargo path even though that one source is exactly sufficient.

Cargo path:

- If selected cargo value `>= cost`, cargo tons charged are `Round(cost/centerPrice)`. This can round downward and underpay.
- Otherwise all of the selected cargo is planned. The remainder is assigned to cash when `(cash > bank) OR (cash >= cargoValue)`; otherwise to bank.
- The chosen monetary remainder is capped to the available source, but there is no second-source completion pass. Thus the sum of planned cargo+cash+bank can remain below `cost`, yet confirmation still grants the expansion. This is the binary's completion bug, not an interpretation issue.

No persistent state changes while the plan and confirmation screen are being built. On yes at `0x6DE1–0x6E67`, capacity is increased first, then cash, bank and all three cargo deductions are applied. On no, none of those writes happens. The event is still considered completed and its raw event number becomes `prevEvt`.

### Applicability reruns the complete selector

The body begins with `eventApplicable=true` at `0x64B2–0x64B5`. Any handler can clear it. At `0x7CC7–0x7CD1`, false jumps to `0x64B2`, which resets the flag and executes `Random(30)` again at `0x64B9`. It does not merely retry the selected handler.

Known false paths are:

- expansion cannot be afforded (`0x6F61`);
- crew event on day `>=6` (`0x7193`);
- theft produces neither a positive cash loss nor eligible cargo loss (`0x7298`);
- merchant wants to buy but no commodity has more than one ton (`0x7916`);
- merchant wants to sell but computed lot is unaffordable or cash is zero (`0x7C07`);
- collision computes zero damage (`0x7CC0`).

After an applicable event, `prevEvt=rawR` at `0x7CD4–0x7CD7`. A player declining an otherwise valid expansion or merchant offer does not clear applicability; it consumes the event and updates `prevEvt`.

### Selector/no-repeat and rich override

The raw roll is `Random(30)+1`. The code rejects equality with yesterday's exact value and rejects membership in the same pair/category: `1–2`, `3–4`, ..., `29–30`. This is implemented by the Boolean chain `0x64C5–0x672E`; rejection jumps directly back to `0x64B9`.

After passing no-repeat, two independent gates execute:

- `cash > 20000` and `Random(6)==1` → force `R=15`;
- `cash > 45000` and `Random(6)==1` → force `R=15`.

Both random calls are consumed regardless of cash because both sides of each Boolean expression are evaluated. `R=15` is an expansion result and can bypass the no-repeat category test because the override happens after that test.

### Event side effects relative to player choice

- Crew (`0x6F6B–0x719C`): day `>=6` rerolls with no changes. Taking a new crew sets an outer control flag but does not directly increment day here. A failed negotiation increments day exactly once at `0x717D–0x7183` and sets the same control flag. Accepted negotiation deducts only the accepted offer. The displayed “two days” is not matched by `day += 2` in this routine.
- Theft (`0x719D–0x72B7`): mode `0x8B` attempts and immediately deducts cash first: `10×Trunc(cash/(40+Random(40)))`. Only when that result is zero does mode `0x8E` scan cargo in index order and steal `max(1,Trunc(tons×(20+Random(21))/100))` from the first commodity holding more than two tons. There is no player choice; mutation precedes display.
- Merchant buys (`0x72B8–0x791F`): chooses the first eligible commodity in fixed order copper, olives, wheat, requiring more than one ton. On yes it sells the entire holding, adds `offerPrice×tons` to cash, then zeros that cargo slot. On no, no state changes. If no cargo qualifies, reroll.
- Merchant sells (`0x7920–0x7C10`): commodity and offer are generated before choice, but persistent state changes only on yes. Unit price is `5×(center div 10 + Random(center) div 5)`. Lot tons are `5×Trunc(((Random(Trunc(0.75×cash)+1)+0.25×cash)/center/5)+1)`. It is therefore a multiple of five and is driven by cash and center price, not by `maxAffordable = cash/unitPrice`. There is no capacity check. If `unitPrice×tons <= cash` and cash is positive, the offer is shown; yes subtracts cash and adds cargo, no consumes the event. Otherwise reroll.
- Collision (`0x7C11–0x7CC6`): `damageDelta=10×Trunc((cash+cargoCenterValue)/(150+Random(80)))`; if positive, it is added before the result screen. If zero, reroll.

## Cross-range control flow

Outbound direct jumps:

- `0x47D2`, `0x4880`, `0x4D4E` → runtime tail `0x1498`;
- `0x545D` → outer body `0xB52A`;
- from the audited bank prefix: `0x8763/0x876B → 0x893A`, `0x8780 → 0x88F2`, `0x87DF → 0x88E2`, `0x87F5 → 0x8891`.

Principal inbound calls from outside the interval, verified from relative-call bytes:

- `0x457B` from `0xBDDB, 0xBE51, 0xBF23, 0xBF9C, 0xC1AA, 0xC258, 0xC30F, 0xC382, 0xC555, 0xC5C4, 0xC709, 0xC784, 0xC908`;
- `0x4648` from `0x8DF0, 0x90A0, 0x90E3, 0x96C8, 0x9F69, 0xA6F5, 0xA83E, 0xB50E`;
- `0x46D0` from `0xACED, 0xB9AF`;
- `0x4723` from `0x8B43`; `0x4883` from `0x9385`; `0x4956` from `0xB632`;
- `0x4C6D` from `0x89D7, 0xA3D3, 0xAC34, 0xAC4E, 0xAD14, 0xAF5B, 0xAFB1`;
- `0x4CE1` from `0xB051`; `0x4D51` from `0x988F, 0xAFD3, 0xAFFE, 0xB02E, 0xB7C1`;
- `0x4F59` from `0xAA9E, 0xB3A0`; `0x530F` from `0x8984, 0xB160, 0xCC6E`; `0x5459` from `0xCBD0`;
- `0x5460` from `0x97CE, 0x9B7B, 0xA006, 0xA362, 0xA7C6, 0xB6D7`;
- `0x5718` from `0xAAD4`; `0x579A` from `0x9B28`; `0x5CC9` from `0x9F8E, 0xA020, 0xA098, 0xA2FF`;
- `0x5FE5/0x60F4/0x6166` from `0xB549/0xB629/0xB650`;
- `0x7CE1` from `0xB552`; `0x7D7F` from `0xB7FC,0xB82D,0xB845`; `0x8112` from `0xB87D,0xB8AB,0xB8D8`; `0x852D` from `0xBA2B`.

The following is the **complete unique target set for direct outbound `CALL`s** from this interval. The number in parentheses is the number of verified call sites in `0x4500–0x87FF`:

```text
0213(4) 0371(3) 037F(24) 059C(2) 05C3(2) 05F7(3) 06C6(2)
0DA4(2) 0DAA(83) 0E12(21) 0E2B(3) 0E87(2) 0F31(4) 0FD1(128)
101B(1) 1022(85) 10DA(39) 11CC(70) 11E5(117) 11FB(13)
123D(45) 127A(7) 12AA(2) 12FD(73) 137E(1) 1483(3)
14FC(25) 150E(7) 1515(24) 15E1(25)
1973(107) 1982(19) 1993(42) 19A6(20) 19C1(9) 19D0(29) 19DF(13)
1A0E(1) 1A28(2) 1A42(6) 1A5C(11) 1A76(17) 1A90(5)
1ABA(2) 1AC7(1) 1AF6(1) 1AFA(19) 1B2F(83) 1B38(9)
253B(3) 2558(79) 2762(3) 289D(8) 28B9(20) 28EE(2)
2926(44) 295D(8) 2975(29) 29C4(1) 2A0E(2) 2B07(1)
2B75(1) 2B83(2) 2DBA(4) 2DC3(2) 2DC6(31)
41AD(4) 41B0(10) 41FC(14) 4311(4) 4480(1)
```

Thus every direct outbound call goes below `0x4500`; there are no direct outbound calls above `0x87FF`. `0x10DA` is `Random`; `0x1973–0x1B38` are the Real-library calls itemized above. The remaining targets are runtime/UI, strings, input, graphics and resource loading. No indirect jump table was found in this interval.

## Inline-string byte ranges

These ranges include the Pascal length byte and payload. `0x4500–0x4501` is the separately noted tail fragment.

```text
451F-4527 459E-45A2 45C5-45CE 45EC-45F4 4980-498C 49B5-49C0 4A80-4A83 4A9D-4AA8 4AF7-4AFB 4B4C-4B50 4B63-4B67 4B75-4B7C
4C7E-4C84 4CA0-4CA5 4CC1-4CC6 4CFB-4D01 4D1A-4D1F 4D38-4D3D 525B 526B-526F 5280-5291 5407-5409 5416-5418 54D5-54D8
5747 5750-5765 5804 580D-5820 58A1 58AA-58BD 5927-5934 5942-5949 5955 595E 59E4-59F1 59FF-5A06 5A12 5A1B 5A8F-5A9C 5AAA-5AB1 5ABD 5AC6
5B50-5B65 5B6E 5B77 6197-619D 61AE-61B4 6236-623D 625C-6262 6293-629B 6327-632D 634C-6352 6383-638B 6417-641D 643C-6442 6473-647B
6CF2-6CF6 6D78-6D7C 6DAE-6DB5 6E8E-6E9C 6EE0-6EF2 6F05-6F0A 6F13 6F2C-6F43 6F4C 6F55 708B-7093 709C-70B1 70BA 70F6-710A 7113 711C
7135-7145 714E-7163 716C-7174 71FB-7200 7279-727E 7337-7350 736D-7371 737F-7391 73B1-73BE 73CC-73D6 73F6-7400 740E-7411 743A-7459 74C2-74CA
7552-756B 7588-758C 759A-75AC 75CC-75D9 75E7-75F1 7611-761B 7629-762C 7655-7674 76DD-76E5 776D-7786 77A3-77A7 77B5-77C7 77E7-77F4
7802-780C 782C-7836 7844-7847 7870-788F 78F8-7900 7A74 7A9B-7AA0 7AB1-7AC6 7AEF-7AF8 7B06-7B0C 7B35-7B51 7BDA-7BEE 7C6B-7C76
7D0D-7D10 7D39-7D43 7DBE-7DD0 7DD9-7DE4 7DED 7FC7-7FD9 7FF3-7FF8 8004 8156-8167 8170-8175 820E-8223 82E4-82E9 83E3-83E8 8400-8406 841F
85DF-85F2 86D3-86E9 8722-8739
```

## Remaining uncertainty

There is no unresolved game-mechanics ambiguity inside this interval. Two naming uncertainties remain and are explicitly non-mechanical:

- the higher-level semantic label for predicate `0x56E0`. Its mechanics are nevertheless exact: bytes `8A 46 04 32 E4 3D 1A 00 74 03` at `0x56EC–0x56F5` load the byte argument, zero-extend it, compare it with `0x001A`, and take the true branch on equality;
- the original Pascal source names of UI/resource helpers and outer-frame locals.

No byte range is left unclassified, and no formula above depends on those names.
