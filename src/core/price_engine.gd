## Daily price generation + morning price-change events.
## GDD: design/gdd/market-prices.md. All ranges/formulas from config (ADR-0003).
class_name PriceEngine
extends RefCounted

var _cfg: GameConfig
var _rng: RngService


func _init(cfg: GameConfig, rng: RngService) -> void:
	_cfg = cfg
	_rng = rng


## Roll one price for a good from its {min,max,step} config block.
func roll_single_price(good: int) -> int:
	var block: Dictionary = _cfg.getd("economy:price.%s" % Types.good_key(good))
	var lo: int = int(block["min"])
	var hi: int = int(block["max"])
	var step: int = int(block["step"])
	var slots: int = Types.idiv(hi - lo, step) + 1
	return lo + step * _rng.randn(slots)


## Fill the daily 3x3 price table (GDD market-prices §3.2-3.3).
## Port order Israel->Turkey->Egypt; per good, no two ports share a price —
## a colliding roll is rerolled. `skip` = {port, good} cell already written by a
## morning price event (kept as-is; its out-of-range value cannot collide).
## Note on ordering: we roll dailies after the morning event and preserve the
## event cell — distributionally identical to the original's event-then-fill
## (event values are outside the normal ranges, so uniqueness is unaffected).
func roll_daily_prices(state: GameState, skip: Dictionary = {}) -> void:
	var unique: bool = _cfg.getb("economy:price.unique_across_ports")
	for good in Types.GOODS_SCAN_ORDER:
		var taken: Array[int] = []
		for port in Types.PRICE_ROLL_ORDER:
			if skip.has("port") and int(skip["port"]) == port and int(skip["good"]) == good:
				continue
			var price: int = roll_single_price(good)
			if unique:
				var safety: int = 0
				while taken.has(price):
					price = roll_single_price(good)
					safety += 1
					assert(safety < 1000, "price uniqueness reroll did not converge")
			taken.append(price)
			state.prices[port][good] = price


## Apply a morning price-change event (GDD market-prices §4.2).
## Good and direction come from the event code; the port is rolled here.
## Returns {port, good, dir, price} for the announcement card.
func apply_price_event(state: GameState, good: int, dir: String) -> Dictionary:
	var port: int = _rng.randn(3)
	var base: int = _event_base(state, good)
	var block: Dictionary = _cfg.getd("economy:price_event.%s.%s" % [dir, Types.good_key(good)])
	var offset: int = int(block["offset"])
	var step: int = int(block["step"])
	var rolls: int = int(block["rolls"])
	var delta: int = offset + step * _rng.randn(rolls)
	var price: int = base + delta if dir == "up" else base - delta
	state.prices[port][good] = price
	return {"port": port, "good": good, "dir": dir, "price": price}


## QQ-04: reference value for price events — mode is a fidelity flag (ADR-0003).
func _event_base(state: GameState, good: int) -> int:
	var mode: String = _cfg.gets("economy:price_event.base_mode")
	match mode:
		"fixed_mid":
			return _cfg.geti("economy:price_event.fixed_base.%s" % Types.good_key(good))
		"daily_reference":
			return state.price_of(state.port, good)
		_:
			assert(false, "Unknown price_event.base_mode: %s" % mode)
			return 0
