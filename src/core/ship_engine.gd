## Capacity, damage and the repair dock. GDD: design/gdd/ship-damage-repair.md.
class_name ShipEngine
extends RefCounted

var _cfg: GameConfig
var _rng: RngService
var _state: GameState


func _init(cfg: GameConfig, rng: RngService, state: GameState) -> void:
	_cfg = cfg
	_rng = rng
	_state = state


func add_damage(amount: int) -> void:
	assert(amount >= 0)
	_state.damage += amount


func add_capacity(amount: int) -> void:
	assert(amount >= 0)
	_state.capacity += amount


## Damage above the block threshold forbids sailing until repaired (GDD §3.3).
func can_sail() -> bool:
	return _state.damage <= _cfg.geti("ship:sail_block_damage")


## Pay `amount` cash to reduce damage 1:1 (ratio is a config assumption, GDD §4).
## Requires the dock to be open today (roll_dock_open must have been consulted).
func repair(amount: int) -> Result:
	if _state.damage <= 0:
		return Result.failure(&"no_damage")
	if _state.dock_closed_today:
		return Result.failure(&"dock_closed")
	if amount < 1:
		return Result.failure(&"invalid_amount")
	if amount > _state.cash:
		return Result.failure(&"not_enough_cash")
	if not _cfg.getb("ship:repair.partial_allowed") and amount < _state.damage:
		return Result.failure(&"partial_repair_forbidden")
	var reduction: int = Types.idiv(
		amount * _cfg.geti("ship:repair.ratio_num"), _cfg.geti("ship:repair.ratio_den"))
	if reduction > _state.damage:
		return Result.failure(&"overpay", {"max_useful": _state.damage})
	_state.cash -= amount
	_state.damage -= reduction
	return Result.success({"damage": _state.damage, "cash": _state.cash})


## First dock visit of the day rolls closed-ness: 20% closed (GDD §3.5),
## fixed for the rest of the day. A day after a closed day is guaranteed open
## ("וביום שלאחריו הוא יהיה פתוח ב-100% מהמקרים").
func roll_dock_open() -> bool:
	if not _state.dock_rolled_today:
		_state.dock_rolled_today = true
		if _state.dock_closed_yesterday:
			_state.dock_closed_today = false
		else:
			_state.dock_closed_today = (
				_rng.randn(_cfg.geti("ship:repair.dock_closed_one_in")) == 0)
	return not _state.dock_closed_today
