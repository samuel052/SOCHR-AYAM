## Buy/sell at the current port's prices. GDD: design/gdd/trading.md.
## Overload purchases are allowed by design (risk is resolved at sail time).
class_name TradeEngine
extends RefCounted

var _state: GameState


func _init(state: GameState) -> void:
	_state = state


## Buy qty tons at the current port. Only cash constrains the purchase (TR-TRADE-03).
func buy(good: int, qty: int) -> Result:
	if qty < 1:
		return Result.failure(&"invalid_quantity")
	var cost: int = qty * _state.price_of(_state.port, good)
	if cost > _state.cash:
		return Result.failure(&"not_enough_cash", {"cost": cost, "cash": _state.cash})
	_state.cash -= cost
	_state.cargo[good] += qty
	return Result.success({"good": good, "qty": qty, "cost": cost})


func sell(good: int, qty: int) -> Result:
	if qty < 1:
		return Result.failure(&"invalid_quantity")
	if qty > _state.cargo[good]:
		return Result.failure(&"not_enough_cargo", {"have": _state.cargo[good]})
	var revenue: int = qty * _state.price_of(_state.port, good)
	_state.cargo[good] -= qty
	_state.cash += revenue
	return Result.success({"good": good, "qty": qty, "revenue": revenue})


func max_buy(good: int) -> int:
	return Types.idiv(_state.cash, _state.price_of(_state.port, good))
