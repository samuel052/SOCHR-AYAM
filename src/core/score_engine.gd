## End-of-game detection, final score and the top-10 table logic.
## GDD: design/gdd/scoring-endgame.md. Score composition is QQ-02 (config flag).
class_name ScoreEngine
extends RefCounted

var _cfg: GameConfig
var _state: GameState


func _init(cfg: GameConfig, state: GameState) -> void:
	_cfg = cfg
	_state = state


## Final score: cash, plus bank when the QQ-02 flag says so (default true).
func final_score() -> int:
	var score: int = _state.cash
	if _cfg.getb("scoring:score.include_bank"):
		score += _state.bank
	if _cfg.getb("scoring:score.include_cargo"):
		score += _state.cargo_value(_state.port)
	return score


## "No way to continue" (GDD §3.2, criterion unverified — pragmatic check):
## sailing is blocked by damage AND everything the player could liquidate
## (cash + bank + cargo at current port) cannot repair back to the sail limit.
func is_stuck() -> bool:
	var block: int = _cfg.geti("ship:sail_block_damage")
	if _state.damage <= block:
		return false
	var needed: int = _state.damage - block
	var liquid: int = _state.cash + _state.bank + _state.cargo_value(_state.port)
	return liquid < needed


## True when `score` earns a slot in the (sorted, descending) top-10 table.
func qualifies(score: int, table: Array) -> bool:
	if table.size() < _cfg.geti("scoring:hiscore_slots"):
		return true
	return score > int(table[table.size() - 1]["score"])


## Insert a row and trim to the slot count. Equal scores: newest on top
## (GDD §3.6 assumption). Returns the new table.
func insert_score(table: Array, row: Dictionary) -> Array:
	var result: Array = table.duplicate(true)
	var inserted: bool = false
	for i in result.size():
		if int(row["score"]) >= int(result[i]["score"]):
			result.insert(i, row)
			inserted = true
			break
	if not inserted:
		result.append(row)
	var slots: int = _cfg.geti("scoring:hiscore_slots")
	while result.size() > slots:
		result.pop_back()
	return result
