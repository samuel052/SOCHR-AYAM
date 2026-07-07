## Shared enums, constants and integer-math helpers for the core logic module.
## Pure RefCounted namespace — no scene-tree or engine-node references (ADR-0001).
class_name Types
extends RefCounted

## Goods, in the original game's fixed scan order (copper -> olives -> wheat).
enum Good { COPPER = 0, OLIVES = 1, WHEAT = 2 }

## Ports. Daily price generation order is Israel -> Turkey -> Egypt (GDD market-prices §3.3).
enum Port { ISRAEL = 0, TURKEY = 1, EGYPT = 2 }

const GOODS_SCAN_ORDER: Array[int] = [Good.COPPER, Good.OLIVES, Good.WHEAT]
const GOOD_KEYS: Array[String] = ["copper", "olives", "wheat"]
const PORT_KEYS: Array[String] = ["israel", "turkey", "egypt"]
const PRICE_ROLL_ORDER: Array[int] = [Port.ISRAEL, Port.TURKEY, Port.EGYPT]

## PendingDecision kinds (ADR-0001 conversation pattern).
const DECISION_EXPAND_OFFER := &"expand_offer"
const DECISION_CREW_STRIKE := &"crew_strike"
const DECISION_MERCHANT_BUY := &"merchant_buy"
const DECISION_MERCHANT_SELL := &"merchant_sell"
const DECISION_PIRATE_CHOICE := &"pirate_choice"

const NO_STORM := -1


static func good_key(good: int) -> String:
	return GOOD_KEYS[good]


static func good_from_key(key: String) -> int:
	var idx: int = GOOD_KEYS.find(key)
	assert(idx >= 0, "Unknown good key: %s" % key)
	return idx


## Truncating integer division (Pascal `div` semantics for non-negative operands).
static func idiv(a: int, b: int) -> int:
	assert(b != 0, "idiv by zero")
	@warning_ignore("integer_division")
	var q: int = a / b
	return q


## Ceiling integer division for non-negative operands.
static func cdiv(a: int, b: int) -> int:
	return idiv(a + b - 1, b)
