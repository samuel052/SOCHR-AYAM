## The single door between UI and core logic (ADR-0001). Autoload singleton.
## UI calls commands here and listens to signals; it never touches core objects.
## All snapshots and results handed to the UI are plain data.
extends Node

signal state_changed(snapshot: Dictionary)
signal day_started(announcements: Dictionary)
signal decision_required(decision: Dictionary)
signal voyage_resolved(result: Dictionary)
signal game_ended(summary: Dictionary)

var _engine: GameEngine
var _persistence: Persistence


func _ready() -> void:
	Strings.install()
	_persistence = Persistence.new()
	var cfg: GameConfig = ConfigLoader.load_default()
	_engine = GameEngine.new(cfg, RngService.new())


## Read-only snapshot of the whole game state as plain data (+ derived fields).
func snapshot() -> Dictionary:
	var s: Dictionary = _engine.state.to_dict()
	s["cargo_total"] = _engine.state.cargo_total()
	s["ship_value"] = _engine.state.ship_value(_engine.state.port)
	s["can_sail"] = _engine.ship.can_sail()
	return s


func has_active_decision() -> bool:
	return _engine.state.pending.has("decision")


func current_decision() -> Dictionary:
	if not has_active_decision():
		return {}
	return _engine.state.pending["decision"]


# --- lifecycle ---

func new_game() -> Result:
	var r: Result = _engine.new_game()
	_autosave()
	_emit_day(r)
	state_changed.emit(snapshot())
	return r


func rest() -> Result:
	var r: Result = _engine.rest()
	if r.data.has("game_over"):
		game_ended.emit(r.data)
	else:
		_autosave()
		_emit_day(r)
	state_changed.emit(snapshot())
	return r


# --- port commands ---

func buy(good: int, qty: int) -> Result:
	return _command(_engine.buy(good, qty))


func sell(good: int, qty: int) -> Result:
	return _command(_engine.sell(good, qty))


func deposit(amount: int) -> Result:
	return _command(_engine.deposit(amount))


func withdraw(amount: int) -> Result:
	return _command(_engine.withdraw(amount))


func repair(amount: int) -> Result:
	return _command(_engine.repair(amount))


# --- voyage ---

func plan_voyage(dest: int) -> Result:
	return _engine.voyage.plan(dest)  # read-only, no state change


func guard_price(dest: int, night: bool) -> int:
	return _engine.voyage.guard_price(dest, night)


func sail(dest: int, guards: int) -> Result:
	var r: Result = _engine.sail(dest, guards)
	if r.ok and r.data.has("decision"):
		decision_required.emit(r.data["decision"].to_dict())
	elif r.ok and r.data.has("result"):
		voyage_resolved.emit(r.data["result"])
		_check_end()
	state_changed.emit(snapshot())
	return r


# --- decisions ---

func answer(decision_id: int, payload: Dictionary) -> Result:
	var r: Result = _engine.answer(decision_id, payload)
	if not r.ok:
		return r  # invalid — decision stays open, UI re-prompts
	if r.data.has("decision"):
		decision_required.emit(r.data["decision"].to_dict())
	elif r.data.has("result"):
		voyage_resolved.emit(r.data["result"])
		_check_end()
	elif r.data.has("day"):
		_emit_day(r)  # crew skip landed on a new day
	state_changed.emit(snapshot())
	return r


# --- save / load ---

func save_game() -> Result:
	if _engine.state.game_over or has_active_decision():
		return Result.failure(&"cannot_save_now")
	return _persistence.save_game(_engine.to_save_dict(), false)


func load_game(autosave: bool = false) -> Result:
	var r: Result = _persistence.load_game(autosave)
	if not r.ok:
		return r
	_engine.load_save_dict(r.data["payload"])
	state_changed.emit(snapshot())
	return r


func has_save() -> bool:
	return _persistence.has_save(false) or _persistence.has_save(true)


func hiscores() -> Array:
	return _persistence.load_hiscores()


func submit_hiscore(name: String) -> Result:
	var rows: Array = _persistence.load_hiscores()
	var row: Dictionary = {
		"name": name if name != "" else Strings.t(&"HISCORES_DEFAULT_NAME"),
		"score": _engine.score.final_score(),
		"date": Time.get_date_string_from_system(),
	}
	rows = _engine.score.insert_score(rows, row)
	return _persistence.store_hiscores(rows)


func qualifies_for_hiscore() -> bool:
	return _engine.score.qualifies(_engine.score.final_score(), _persistence.load_hiscores())


# --- helpers ---

func _command(r: Result) -> Result:
	if r.ok:
		state_changed.emit(snapshot())
		_check_end()
	return r


func _emit_day(r: Result) -> void:
	if not r.data.has("day") or r.data.has("game_over"):
		return
	var announcements: Dictionary = r.data.duplicate()
	# Convert any live PendingDecision to plain data before it crosses the signal.
	if announcements.has("decision"):
		announcements["decision"] = announcements["decision"].to_dict()
	day_started.emit(announcements)
	if announcements.has("decision"):
		decision_required.emit(announcements["decision"])


func _check_end() -> void:
	if _engine.state.game_over:
		game_ended.emit({
			"game_over": true,
			"reason": "stuck",
			"score": _engine.score.final_score(),
		})


func _autosave() -> void:
	if not _engine.state.game_over:
		_persistence.save_game(_engine.to_save_dict(), true)
