## Pirate encounter: fight / flee / compromise. GDD: design/gdd/pirates.md.
## Entered from the voyage regular table (1..6 of rand(20)+1).
class_name PirateEngine
extends RefCounted

var _cfg: GameConfig
var _rng: RngService
var _state: GameState
var _ship: ShipEngine


func _init(cfg: GameConfig, rng: RngService, state: GameState, ship: ShipEngine) -> void:
	_cfg = cfg
	_rng = rng
	_state = state
	_ship = ship


## Build the encounter decision (GDD §3.1). Cash-offer gate per GDD §3.6.5.
func make_encounter_decision() -> PendingDecision:
	var fixed_cargo: int = _fixed_cargo_value()
	var cash_allowed: bool = _state.cash > Types.idiv(
		fixed_cargo, _cfg.geti("pirates:compromise.cash_gate_den"))
	return PendingDecision.make(0, Types.DECISION_PIRATE_CHOICE, {
		"guards": _state.guards,
		"cash_offer_allowed": cash_allowed,
	})


## payload: {"action": "fight"|"flee"|"compromise", "offer": {...}}
## Returns event data; on invalid compromise offers returns a failure Result
## so the UI re-prompts without consuming the decision.
func resolve_choice(payload: Dictionary) -> Result:
	match String(payload.get("action", "")):
		"fight":
			return Result.success(_fight())
		"flee":
			return Result.success(_flee())
		"compromise":
			return _compromise(payload.get("offer", {}))
		_:
			return Result.failure(&"unknown_action")


# --- fight (GDD §3.2-3.4) ---

func _fight() -> Dictionary:
	var power: int = _state.guards
	var won: bool = false
	if power > _rng.randn(_cfg.geti("pirates:fight.roll1_die")):
		won = true
	elif power > 0:
		won = _rng.randn(_cfg.geti("pirates:fight.roll2_die")) \
			== _cfg.geti("pirates:fight.roll2_win_value")
	return _fight_won() if won else _fight_lost()


func _fight_won() -> Dictionary:
	var out: Dictionary = {"event": "pirates", "outcome": "won"}
	if _rng.randn(_cfg.geti("pirates:win.capture_die")) == _cfg.geti("pirates:win.capture_win_value"):
		var bonus: int = _cfg.geti("pirates:win.capture_capacity_bonus")
		_ship.add_capacity(bonus)
		out["captured_ship"] = true
		out["capacity_bonus"] = bonus
	else:
		var loot: int = (_rng.randn(_cfg.geti("pirates:win.loot_rolls"))
			+ _cfg.geti("pirates:win.loot_base")) * _cfg.geti("pirates:win.loot_multiple")
		_state.cash += loot
		out["loot"] = loot
	if _rng.randn(_cfg.geti("pirates:win.damage_die")) == _cfg.geti("pirates:win.damage_win_value"):
		var dmg: int = (_rng.randn(_cfg.geti("pirates:win.damage_rolls"))
			+ _cfg.geti("pirates:win.damage_base")) * _cfg.geti("pirates:win.damage_multiple")
		_ship.add_damage(dmg)
		out["damage"] = dmg
	return out


## QQ-01: loss branch not decoded from the binary — numbers from the spec doc,
## all behind config (assets/data/pirates.json "lose").
func _fight_lost() -> Dictionary:
	var out: Dictionary = {"event": "pirates", "outcome": "lost"}
	var steal_cap: int = Types.idiv(_state.cash, _cfg.geti("pirates:lose.steal_fraction_den"))
	var stolen: int = 0
	if steal_cap >= 1:
		stolen = _rng.randn(steal_cap) + 1
	_state.cash -= stolen
	out["stolen"] = stolen
	var money_total: int = _state.cash
	if _cfg.getb("pirates:lose.damage_includes_bank"):
		money_total += _state.bank
	var dmg_min: int = _cfg.geti("pirates:lose.damage_min")
	var dmg_cap: int = Types.idiv(money_total, _cfg.geti("pirates:lose.damage_fraction_den"))
	var dmg: int = dmg_min
	if dmg_cap > dmg_min:
		dmg = _rng.randn(dmg_cap - dmg_min + 1) + dmg_min
	_ship.add_damage(dmg)
	out["damage"] = dmg
	return out


# --- flee (GDD §3.5): failure falls through to a fight ---

func _flee() -> Dictionary:
	var block_pct: int = _cfg.geti("pirates:flee.block_pct")
	var div: int = _cfg.geti("pirates:flee.divisor")
	var cargo: int = _state.cargo_total()
	# early rejection: cargo strictly above 81% of capacity
	if cargo * 100 > block_pct * _state.capacity:
		return _flee_failed()
	var escape_n: int = maxi(1,
		Types.idiv(_state.capacity, div) - Types.idiv(cargo, div) + 1)
	if _rng.randn(escape_n) == 0:
		return _flee_failed()
	var dmg_n: int = Types.idiv(_state.damage, div) + 1
	if _rng.randn(dmg_n) == 0:
		return {"event": "pirates", "outcome": "fled"}
	return _flee_failed()


func _flee_failed() -> Dictionary:
	var reason: String
	if _state.cargo_total() > 0:
		reason = "heavy"       # "ספינתך כבדה מדי, ולא הצליחה לברוח"
	elif _state.damage > 0:
		reason = "damaged"     # "לא הצלחת לברוח עקב הנזק שבספינתך"
	else:
		reason = "outrun"      # "ספינת הפיראטים המהירה הצליחה להשיג את ספינתך"
	var fight_result: Dictionary = _fight()
	fight_result["flee_failed"] = reason
	return fight_result


# --- compromise (GDD §3.6): fixed values, strict superiority, reject => fight ---

func _compromise(offer: Dictionary) -> Result:
	var fixed: Dictionary = _cfg.getd("pirates:compromise.fixed_values")
	var offer_cash: int = maxi(0, int(offer.get("cash", 0)))
	var cash_allowed: bool = _state.cash > Types.idiv(
		_fixed_cargo_value(), _cfg.geti("pirates:compromise.cash_gate_den"))
	if not cash_allowed:
		offer_cash = 0  # cash component locked (GDD §3.6.5)
	var qty: Array[int] = []
	for good in Types.GOODS_SCAN_ORDER:
		qty.append(maxi(0, int(offer.get(Types.good_key(good), 0))))
	if offer_cash > _state.cash:
		return Result.failure(&"offer_exceeds_cash")
	for good in Types.GOODS_SCAN_ORDER:
		if qty[good] > _state.cargo[good]:
			return Result.failure(&"offer_exceeds_cargo")
	var offer_value: int = offer_cash
	for good in Types.GOODS_SCAN_ORDER:
		offer_value += qty[good] * int(fixed[Types.good_key(good)])
	var demand: int = Types.idiv(
		_fixed_cargo_value() + _state.cash,
		_rng.randn(_cfg.geti("pirates:compromise.demand_divisor_rolls"))
			+ _cfg.geti("pirates:compromise.demand_divisor_base"))
	if offer_value > demand:  # strictly greater — equality is rejected
		_state.cash -= offer_cash
		for good in Types.GOODS_SCAN_ORDER:
			_state.cargo[good] -= qty[good]
		return Result.success({"event": "pirates", "outcome": "compromise_accepted",
			"paid_cash": offer_cash, "paid_goods": qty})
	var fight_result: Dictionary = _fight()
	fight_result["compromise_rejected"] = true
	return Result.success(fight_result)


## Cargo valued at the pirates' fixed negotiation values (not market prices!).
func _fixed_cargo_value() -> int:
	var fixed: Dictionary = _cfg.getd("pirates:compromise.fixed_values")
	var total: int = 0
	for good in Types.GOODS_SCAN_ORDER:
		total += _state.cargo[good] * int(fixed[Types.good_key(good)])
	return total
