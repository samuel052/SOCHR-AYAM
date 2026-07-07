## Deposit/withdraw, one global account, no interest (QQ-10 assumption).
## GDD: design/gdd/banking.md. Bank money is excluded from ship value,
## TotalWealth and theft — the exclusions live at each calculation site.
class_name BankEngine
extends RefCounted

var _state: GameState


func _init(state: GameState) -> void:
	_state = state


func deposit(amount: int) -> Result:
	if amount < 1:
		return Result.failure(&"invalid_amount")
	if amount > _state.cash:
		return Result.failure(&"not_enough_cash")
	_state.cash -= amount
	_state.bank += amount
	return Result.success({"cash": _state.cash, "bank": _state.bank})


func withdraw(amount: int) -> Result:
	if amount < 1:
		return Result.failure(&"invalid_amount")
	if amount > _state.bank:
		return Result.failure(&"not_enough_bank")
	_state.bank -= amount
	_state.cash += amount
	return Result.success({"cash": _state.cash, "bank": _state.bank})
