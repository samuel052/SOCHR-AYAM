## The voyage engine: envelope checks, guard pricing, and the four-layer
## at-most-one-event resolution. GDD: design/gdd/sailing-engine.md.
class_name VoyageEngine
extends RefCounted

var _cfg: GameConfig
var _rng: RngService
var _state: GameState
var _ship: ShipEngine
var _pirates: PirateEngine


func _init(cfg: GameConfig, rng: RngService, state: GameState,
		ship: ShipEngine, pirates: PirateEngine) -> void:
	_cfg = cfg
	_rng = rng
	_state = state
	_ship = ship
	_pirates = pirates


func travel_hours(from_port: int, to_port: int) -> int:
	assert(from_port != to_port)
	var pair: Array[int] = [from_port, to_port]
	if pair.has(Types.Port.ISRAEL):
		return _cfg.geti("time:travel.israel_egypt") if pair.has(Types.Port.EGYPT) \
			else _cfg.geti("time:travel.israel_turkey")
	return _cfg.geti("time:travel.egypt_turkey")


## Pre-sail plan: times, warnings, guard price (GDD §3.1). Read-only.
func plan(dest: int) -> Result:
	if dest == _state.port:
		return Result.failure(&"same_port")
	if not _ship.can_sail():
		return Result.failure(&"damage_blocks_sailing", {"damage": _state.damage})
	var hours: int = travel_hours(_state.port, dest)
	var arrival: int = _state.clock + hours
	if arrival > _cfg.geti("time:day_end_hour"):
		return Result.failure(&"too_late")
	var night: bool = arrival > _cfg.geti("time:night_hour")
	var overload: bool = _state.cargo_total() > _state.capacity
	return Result.success({
		"dest": dest, "hours": hours, "arrival": arrival,
		"night": night, "overload": overload,
		"guard_price": guard_price(dest, night),
	})


## Guard-ship unit price (GDD §3.1.4 — spec-doc source, config-gated).
func guard_price(dest: int, night: bool) -> int:
	var price: int = Types.idiv(
		_state.ship_value(_state.port) * _cfg.geti("voyage:guards.price_pct_num"),
		_cfg.geti("voyage:guards.price_pct_den"))
	price = maxi(price, _cfg.geti("voyage:guards.min_price"))
	if _state.storm_port == _state.port or _state.storm_port == dest:
		price = Types.idiv(price * _cfg.geti("voyage:guards.storm_mult_num"),
			_cfg.geti("voyage:guards.storm_mult_den"))
	if night:
		price = Types.idiv(price * _cfg.geti("voyage:guards.night_mult_num"),
			_cfg.geti("voyage:guards.night_mult_den"))
	return price


## Depart. Returns either {"result": {...voyage outcome...}} or
## {"decision": PendingDecision} with the voyage parked in state.pending.
func sail(dest: int, guards: int) -> Result:
	var planned: Result = plan(dest)
	if not planned.ok:
		return planned
	if guards < 0:
		return Result.failure(&"invalid_guards")
	var total_guard_cost: int = guards * int(planned.data["guard_price"])
	if total_guard_cost > _state.cash:
		return Result.failure(&"not_enough_cash_for_guards")
	_state.cash -= total_guard_cost
	_state.guards = guards
	var origin: int = _state.port
	var hours: int = int(planned.data["hours"])
	var night: bool = bool(planned.data["night"])
	var event: Dictionary = _resolve_layers(origin, dest, night)
	if event.has("pirate_decision"):
		_state.pending = {
			"voyage": {"origin": origin, "dest": dest, "hours": hours},
		}
		return Result.success({"decision": event["pirate_decision"]})
	return Result.success({"result": _finish(origin, dest, hours, event)})


## Apply arrival (port, clock, route changes) after the event is known.
func _finish(origin: int, dest: int, hours: int, event: Dictionary) -> Dictionary:
	var arrival_port: int = dest
	var total_hours: int = hours
	match String(event.get("event", "none")):
		"port_blocked":
			arrival_port = origin
			total_hours = hours * 2  # there and back (GDD §3.9)
		"winds":
			arrival_port = int(event["new_dest"])
			total_hours = hours + int(event["extra_hours"])
	_state.clock += total_hours
	_state.port = arrival_port
	_state.guards = 0
	event["arrival_port"] = arrival_port
	event["arrival_clock"] = _state.clock
	if not event.has("event"):
		event["event"] = "none"  # "הגעת בשלום!!"
	return event


## Called by GameEngine after the pirate decision chain resolves.
func finish_after_pirates(pirate_outcome: Dictionary) -> Dictionary:
	var v: Dictionary = _state.pending["voyage"]
	_state.pending = {}
	return _finish(int(v["origin"]), int(v["dest"]), int(v["hours"]), pirate_outcome)


# --- the four layers (GDD §3.2): at most one event per voyage ---

func _resolve_layers(origin: int, dest: int, night: bool) -> Dictionary:
	# Layer 1: special-risk gate
	var gate_event: Dictionary = _special_risk_gate(origin, dest, night)
	if not gate_event.is_empty():
		return gate_event
	# Layer 2: overload / sinking
	if _state.cargo_total() > _state.capacity:
		var sink: Dictionary = _overload_check(origin)
		if not sink.is_empty():
			return sink
	# Layer 3: destination port blocked (fog / strike)
	if _rng.randn(_cfg.geti("voyage:port_block.one_in")) == 0:
		var fog: bool = _rng.randn(_cfg.geti("voyage:port_block.fog_one_in")) == 0
		return {"event": "port_blocked", "reason": "fog" if fog else "strike"}
	# Layer 4: the regular table, rand(20)+1
	return _regular_table(origin, dest)


## Layer 1 — GDD §3.3. N grows with damage; entry needs two successes.
## `class` semantics are QQ-05; default from config until verified.
func _special_risk_gate(origin: int, dest: int, night: bool) -> Dictionary:
	var klass: int = _cfg.geti("voyage:gate.class_default")
	var div: int = _cfg.geti("voyage:gate.damage_divisor")
	var n: int = 2 * klass + 1 + Types.idiv(_state.damage + div - 1, div)
	if _rng.randn(n) == 0 or _rng.randn(2) != 1:
		return {}
	var storm_exposed: bool = (
		_state.storm_port == origin or _state.storm_port == dest)
	if storm_exposed:
		return _storm(origin)
	if night:
		return _shoal()
	if _state.damage > 0:
		return _worsening_damage()
	return {}  # gate entered but no condition holds — no event


## Storm (GDD §3.4): cargo damage above the value threshold, else ship damage.
func _storm(origin: int) -> Dictionary:
	if _state.cargo_value(origin) > _cfg.geti("voyage:storm.cargo_value_threshold"):
		var min_qty: int = _cfg.geti("voyage:storm.goods_min_qty")
		for good in Types.GOODS_SCAN_ORDER:
			if _state.cargo[good] > min_qty:
				var pct: int = _cfg.geti("voyage:storm.loss_pct_step") \
					* _rng.randn(_cfg.geti("voyage:storm.loss_pct_rolls"))
				var loss: int = clampi(
					Types.idiv(_state.cargo[good] * pct, 100), 1, _state.cargo[good])
				_state.cargo[good] -= loss
				return {"event": "storm", "variant": "cargo", "good": good, "loss": loss}
		# no eligible good — fall through to ship damage (GDD §5 edge case)
	var dmg: int = _general_damage(origin)
	return {"event": "storm", "variant": "ship", "damage": dmg}


func _shoal() -> Dictionary:
	return {"event": "shoal", "damage": _general_damage(_state.port)}


func _worsening_damage() -> Dictionary:
	return {"event": "worsening_damage", "damage": _general_damage(_state.port)}


## The shared damage mechanism (GDD §3.7): min 75, +1/3 if already damaged,
## rounded to multiples of 5. Value basis: cash + cargo at origin prices.
func _general_damage(origin: int) -> int:
	var total_value: int = _state.cash + _state.cargo_value(origin)
	var divisor: int = _rng.randn(_cfg.geti("voyage:damage.divisor_rolls")) \
		+ _cfg.geti("voyage:damage.divisor_base")
	var round_to: int = _cfg.geti("voyage:damage.round_to")
	var dmg: int = round_to * Types.idiv(total_value, divisor)
	dmg = maxi(dmg, _cfg.geti("voyage:damage.min_damage"))
	if _state.damage > 0:
		dmg += Types.idiv(dmg, _cfg.geti("voyage:damage.repeat_bonus_divisor"))
	dmg = round_to * Types.idiv(dmg, round_to)
	_ship.add_damage(dmg)
	return dmg


## Layer 2 — overload sinking ladder (GDD §3.8).
func _overload_check(origin: int) -> Dictionary:
	var over: int = _state.cargo_total() - _state.capacity
	var one_in: int = 1  # certain above the last rung
	for rung in _cfg.geta("voyage:overload.ladder"):
		var r: Dictionary = rung
		if over <= int(r["over_max"]):
			one_in = int(r["one_in"])
			break
	if one_in > 1 and _rng.randn(one_in) != 0:
		return {}
	# jettison: highest-total-value good, 1..half its quantity (QQ-07 fill)
	var pick: int = Types.Good.COPPER
	var best_value: int = -1
	for good in Types.GOODS_SCAN_ORDER:
		var v: int = _state.cargo[good] * _state.price_of(origin, good)
		if v > best_value:
			best_value = v
			pick = good
	var half: int = maxi(1, Types.idiv(_state.cargo[pick], 2))
	var thrown: int = clampi(_rng.randn(half) + 1, 1, _state.cargo[pick])
	_state.cargo[pick] -= thrown
	return {"event": "overload", "good": pick, "thrown": thrown}


## Layer 4 — rand(20)+1 (GDD §3.10).
func _regular_table(origin: int, dest: int) -> Dictionary:
	var n: int = _rng.randn(_cfg.geti("voyage:regular_table.die")) + 1
	if n <= _cfg.geti("voyage:regular_table.pirates_max"):
		return {"pirate_decision": _pirates.make_encounter_decision()}
	if n == _cfg.geti("voyage:regular_table.winds_value"):
		return _winds(origin, dest)
	if n >= _cfg.geti("voyage:regular_table.deserted_min") \
			and n <= _cfg.geti("voyage:regular_table.deserted_max"):
		return _deserted(origin, dest)
	return {"event": "none"}


## Winds / navigation error (GDD §3.11): Israel-bound => Turkey, else Israel.
## +4h only on the Egypt->Israel route diverted to Turkey.
func _winds(origin: int, dest: int) -> Dictionary:
	var new_dest: int = Types.Port.TURKEY if dest == Types.Port.ISRAEL else Types.Port.ISRAEL
	var extra: int = 0
	if origin == Types.Port.EGYPT and new_dest == Types.Port.TURKEY:
		extra = _cfg.geti("voyage:winds.extra_hours_egypt_israel")
	return {"event": "winds", "new_dest": new_dest, "extra_hours": extra,
		"original_dest": dest}


## Deserted ship (GDD §3.12 — QQ-07 fill from the spec doc).
func _deserted(origin: int, dest: int) -> Dictionary:
	var good: int = _rng.randn(3)
	var total: int = _state.ship_value(origin)
	var value_min: int = _cfg.geti("voyage:deserted.value_min")
	var value: int = value_min
	if total > value_min:
		value = _rng.randn(total - value_min + 1) + value_min
	var qty: int = Types.cdiv(value, _state.price_of(dest, good))
	_state.cargo[good] += qty
	return {"event": "deserted", "good": good, "qty": qty}
