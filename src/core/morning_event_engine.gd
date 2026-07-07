## The morning-event engine: one event per day from day 2, chosen by rolling a
## uniform code 1..30, rejecting same-family-as-yesterday or infeasible events,
## and fully rerolling on rejection. GDD: design/gdd/morning-events.md.
class_name MorningEventEngine
extends RefCounted

var _cfg: GameConfig
var _rng: RngService
var _state: GameState
var _prices: PriceEngine
var _ship: ShipEngine


func _init(cfg: GameConfig, rng: RngService, state: GameState,
		prices: PriceEngine, ship: ShipEngine) -> void:
	_cfg = cfg
	_rng = rng
	_state = state
	_prices = prices
	_ship = ship


## Roll today's event (GDD §3.1). Returns a Dictionary:
##   {"event": <family>, ...details}                — immediate events
##   {"decision": PendingDecision}                  — offer/negotiation events
## The caller (GameEngine) records last_event_family and routes decisions.
func roll_event() -> Dictionary:
	assert(_state.day >= 2, "no morning event on day 1")
	var safety_limit: int = _cfg.geti("events:reroll_safety_limit")
	var codes_total: int = _cfg.geti("events:codes_total")
	var no_repeat: bool = _cfg.getb("events:no_repeat_family")
	var attempts: int = 0
	while true:
		attempts += 1
		assert(attempts <= safety_limit, "morning event reroll did not converge")
		var code: int = _rng.randn(codes_total) + 1
		var entry: Dictionary = _map_code(code)
		var family: String = String(entry["family"])
		if no_repeat and family == _state.last_event_family:
			continue
		var outcome: Dictionary = _try_family(entry)
		if outcome.is_empty():
			continue  # infeasible => full reroll (GDD §3.1 rule 5)
		_state.last_event_family = family
		return outcome
	return {}  # unreachable


func _map_code(code: int) -> Dictionary:
	for entry in _cfg.geta("events:code_map"):
		var e: Dictionary = entry
		if code >= int(e["from"]) and code <= int(e["to"]):
			return e
	assert(false, "morning event code %d not mapped" % code)
	return {}


## Returns {} when the family is infeasible under current state.
func _try_family(entry: Dictionary) -> Dictionary:
	match String(entry["family"]):
		"price":
			return _do_price(entry)
		"expand":
			return _try_expand()
		"crew":
			return _try_crew()
		"thieves":
			return _try_thieves(String(entry["variant"]))
		"merchant_buy":
			return _try_merchant_buy()
		"merchant_sell":
			return _try_merchant_sell()
		"fishing":
			return _try_fishing()
		_:
			assert(false, "unknown family %s" % String(entry["family"]))
			return {}


# --- price change (codes 1-12): good+dir fixed by code, port rolled ---

func _do_price(entry: Dictionary) -> Dictionary:
	var good: int = Types.good_from_key(String(entry["good"]))
	var applied: Dictionary = _prices.apply_price_event(_state, good, String(entry["dir"]))
	applied["event"] = "price"
	return applied


# --- expand (codes 13-18): GDD §3.3 ---

func _try_expand() -> Dictionary:
	var options: Array = _cfg.geta("events:expand.delta_options")
	var delta: int = int(options[_rng.randn(options.size())])
	var cost: int = 10 * (2 * delta + _rng.randn(delta))
	var payment: Dictionary = _decompose_payment(cost)
	if payment.is_empty():
		return {}
	var pd := PendingDecision.make(0, Types.DECISION_EXPAND_OFFER,
		{"delta": delta, "cost": cost, "payment": payment})
	return {"decision": pd}


## Try to pay `cost` (GDD §3.3.3 — order is a documented assumption):
## cash only -> single good -> cash + good. Goods valued at current port prices.
func _decompose_payment(cost: int) -> Dictionary:
	if _state.cash >= cost:
		return {"cash": cost}
	for good in Types.GOODS_SCAN_ORDER:
		var price: int = _state.price_of(_state.port, good)
		if price <= 0:
			continue
		var tons: int = Types.cdiv(cost, price)
		if tons <= _state.cargo[good]:
			return {"good": good, "qty": tons}
	for good in Types.GOODS_SCAN_ORDER:
		var price: int = _state.price_of(_state.port, good)
		if price <= 0:
			continue
		var tons: int = mini(_state.cargo[good], Types.idiv(cost, price))
		var remainder: int = cost - tons * price
		if tons > 0 and remainder <= _state.cash:
			return {"good": good, "qty": tons, "cash": remainder}
	return {}


## Player accepted the expand offer: charge the payment, grow the ship.
func resolve_expand(context: Dictionary, accepted: bool) -> Result:
	if not accepted:
		return Result.success({"declined": true})
	var payment: Dictionary = context["payment"]
	if payment.has("cash"):
		_state.cash -= int(payment["cash"])
	if payment.has("good"):
		_state.cargo[int(payment["good"])] -= int(payment["qty"])
	_ship.add_capacity(int(context["delta"]))
	assert(_state.cash >= 0 and _state.cargo.min() >= 0, "expand payment went negative")
	return Result.success({"capacity": _state.capacity})


# --- crew strike (codes 19-20, days 2-5 only): GDD §3.4 ---

func _try_crew() -> Dictionary:
	if _state.day < _cfg.geti("events:crew.day_min") or _state.day > _cfg.geti("events:crew.day_max"):
		return {}
	var pd := PendingDecision.make(0, Types.DECISION_CREW_STRIKE, {
		"cash": _state.cash,
		"cargo": [_state.cargo[0], _state.cargo[1], _state.cargo[2]],
	})
	return {"decision": pd}


## payload: {"negotiate": bool, "offer": {cash, copper, olives, wheat}}
## Returns data with "skip_days": 0 (deal), 1 (refused), 2 (failed negotiation).
func resolve_crew(payload: Dictionary) -> Result:
	if not bool(payload.get("negotiate", false)):
		return Result.success({"skip_days": _cfg.geti("time:crew_skip.refusal_days")})
	var offer: Dictionary = payload.get("offer", {})
	var offer_cash: int = maxi(0, int(offer.get("cash", 0)))
	var offer_qty: Array[int] = []
	for good in Types.GOODS_SCAN_ORDER:
		offer_qty.append(maxi(0, int(offer.get(Types.good_key(good), 0))))
	if offer_cash > _state.cash:
		return Result.failure(&"offer_exceeds_cash")
	for good in Types.GOODS_SCAN_ORDER:
		if offer_qty[good] > _state.cargo[good]:
			return Result.failure(&"offer_exceeds_cargo")
	var offer_value: int = offer_cash
	for good in Types.GOODS_SCAN_ORDER:
		offer_value += offer_qty[good] * _state.price_of(_state.port, good)
	var total_wealth: int = _state.cash + _state.cargo_value(_state.port)
	var divisor: int = _rng.randn(_cfg.geti("events:crew.divisor_rolls")) \
		+ _cfg.geti("events:crew.divisor_base")
	var threshold: int = Types.idiv(total_wealth, divisor)
	if offer_value > threshold:  # strictly greater (GDD §3.4.5)
		_state.cash -= offer_cash
		for good in Types.GOODS_SCAN_ORDER:
			_state.cargo[good] -= offer_qty[good]
		return Result.success({"skip_days": 0, "accepted": true})
	return Result.success({
		"skip_days": _cfg.geti("time:crew_skip.failed_negotiation_days"),
		"accepted": false,
	})


# --- thieves (codes 21-22): GDD §3.5 ---

func _try_thieves(variant: String) -> Dictionary:
	if variant == "money":
		if _state.cash <= 0:
			return {}
		var divisor: int = _rng.randn(_cfg.geti("events:thieves.money_divisor_rolls")) \
			+ _cfg.geti("events:thieves.money_divisor_base")
		var stolen: int = _cfg.geti("events:thieves.money_multiple") \
			* Types.idiv(_state.cash, divisor)
		if stolen <= 0:
			return {}
		_state.cash -= stolen
		return {"event": "thieves", "variant": "money", "stolen": stolen}
	# goods: first good in fixed scan order with more than goods_min_qty tons
	var min_qty: int = _cfg.geti("events:thieves.goods_min_qty")
	for good in Types.GOODS_SCAN_ORDER:
		if _state.cargo[good] > min_qty:
			var pct: int = _cfg.geti("events:thieves.goods_pct_step") \
				* _rng.randn(_cfg.geti("events:thieves.goods_pct_rolls"))
			var qty: int = Types.idiv(_state.cargo[good] * pct, 100)
			qty = clampi(qty, 1, _state.cargo[good])
			_state.cargo[good] -= qty
			return {"event": "thieves", "variant": "goods", "good": good, "qty": qty}
	return {}


# --- merchant buys from you (codes 23-26): GDD §3.6 ---

func _try_merchant_buy() -> Dictionary:
	var min_qty: int = _cfg.geti("events:merchant_buy.min_qty")
	for good in Types.GOODS_SCAN_ORDER:
		if _state.cargo[good] > min_qty:
			var dev: Dictionary = _cfg.getd("events:merchant_buy.deviation.%s" % Types.good_key(good))
			var unit_price: int = _state.price_of(_state.port, good) \
				+ int(dev["step"]) * _rng.randn(int(dev["rolls"])) + int(dev["offset"])
			var qty: int = _state.cargo[good]  # always the whole stock
			var pd := PendingDecision.make(0, Types.DECISION_MERCHANT_BUY,
				{"good": good, "qty": qty, "unit_price": unit_price, "total": qty * unit_price})
			return {"decision": pd}
	return {}


func resolve_merchant_buy(context: Dictionary, accepted: bool) -> Result:
	if not accepted:
		return Result.success({"declined": true})
	var good: int = int(context["good"])
	_state.cash += int(context["total"])
	_state.cargo[good] = 0
	return Result.success({"cash": _state.cash})


# --- merchant sells to you (codes 27-28): GDD §3.7, quantity is QQ-08 fill ---

func _try_merchant_sell() -> Dictionary:
	var good: int = _rng.randn(3)
	var p: int = _state.price_of(_state.port, good)
	var unit_price: int = 5 * (Types.idiv(p, 10) + Types.idiv(_rng.randn(p), 5))
	if unit_price <= 0:
		return {}
	var step: int = _cfg.geti("events:merchant_sell.qty_step")
	var max_steps: int = Types.idiv(Types.idiv(_state.cash, unit_price), step)
	if max_steps < 1:
		return {}  # unaffordable => reroll (GDD §3.7.4)
	var qty: int = step * (_rng.randn(max_steps) + 1)
	var pd := PendingDecision.make(0, Types.DECISION_MERCHANT_SELL,
		{"good": good, "qty": qty, "unit_price": unit_price, "total": qty * unit_price})
	return {"decision": pd}


func resolve_merchant_sell(context: Dictionary, accepted: bool) -> Result:
	if not accepted:
		return Result.success({"declined": true})
	var total: int = int(context["total"])
	if total > _state.cash:
		return Result.failure(&"not_enough_cash")
	_state.cash -= total
	_state.cargo[int(context["good"])] += int(context["qty"])
	return Result.success({"cash": _state.cash})


# --- fishing-boat collision (codes 29-30): GDD §3.8 ---

func _try_fishing() -> Dictionary:
	var total_value: int = _state.cash + _state.cargo_value(_state.port)
	var divisor: int = _rng.randn(_cfg.geti("events:fishing.divisor_rolls")) \
		+ _cfg.geti("events:fishing.divisor_base")
	var dmg: int = _cfg.geti("events:fishing.multiple") * Types.idiv(total_value, divisor)
	if dmg <= 0:
		return {}
	_ship.add_damage(dmg)
	return {"event": "fishing", "damage": dmg}


# --- weather (part of the day-start sequence): GDD §3.9 ---

func roll_weather() -> int:
	if _state.day == 1:
		return Types.NO_STORM
	var num: int = _cfg.geti("events:weather.storm_numerator")
	var den: int = _cfg.geti("events:weather.storm_denominator")
	if _rng.randn(den) < num:
		return _rng.randn(3)
	return Types.NO_STORM
