## The core orchestrator: owns the engine graph, the day sequence and the
## command API that GameFacade (foundation) exposes to the UI. Headless-testable
## end to end (ADR-0001). GDDs: time-calendar (sequence), all others via engines.
class_name GameEngine
extends RefCounted

var cfg: GameConfig
var rng: RngService
var state: GameState
var prices: PriceEngine
var trade: TradeEngine
var bank: BankEngine
var ship: ShipEngine
var morning: MorningEventEngine
var pirates: PirateEngine
var voyage: VoyageEngine
var score: ScoreEngine

var _next_decision_id: int = 1


func _init(config: GameConfig, rng_service: RngService) -> void:
	cfg = config
	rng = rng_service
	_build(GameState.new())


func _build(s: GameState) -> void:
	state = s
	prices = PriceEngine.new(cfg, rng)
	trade = TradeEngine.new(state)
	bank = BankEngine.new(state)
	ship = ShipEngine.new(cfg, rng, state)
	morning = MorningEventEngine.new(cfg, rng, state, prices, ship)
	pirates = PirateEngine.new(cfg, rng, state, ship)
	voyage = VoyageEngine.new(cfg, rng, state, ship, pirates)
	score = ScoreEngine.new(cfg, state)


## Start a fresh game (GDD time-calendar §3). Returns the day-1 announcements.
func new_game() -> Result:
	_build(GameState.new())
	state.cash = cfg.geti("scoring:start_cash")
	state.capacity = cfg.geti("ship:start_capacity")
	state.port = Types.Port.ISRAEL
	return _begin_day(1)


## Day-start sequence (GDD morning-events §4): announce -> weather -> event ->
## prices. Daily prices roll after the event, preserving a price-event cell
## (distribution-identical to the original's order — see PriceEngine note).
func _begin_day(day: int) -> Result:
	state.day = day
	state.clock = cfg.geti("time:day_start_hour")
	state.dock_closed_yesterday = state.dock_closed_today
	state.dock_rolled_today = false
	state.dock_closed_today = false
	state.guards = 0
	var announcements: Dictionary = {"day": day}
	state.storm_port = morning.roll_weather()
	announcements["storm_port"] = state.storm_port
	var skip: Dictionary = {}
	if day >= 2:
		var outcome: Dictionary = morning.roll_event()
		if outcome.has("decision"):
			var pd: PendingDecision = outcome["decision"]
			pd.id = _take_decision_id()
			state.pending = {"decision": pd.to_dict()}
			announcements["decision"] = pd
		else:
			announcements["morning_event"] = outcome
			if String(outcome.get("event", "")) == "price":
				skip = {"port": int(outcome["port"]), "good": int(outcome["good"])}
	prices.roll_daily_prices(state, skip)
	return Result.success(announcements)


## "לנוח עד למחרת": advance a day; on the final day, end the game.
func rest() -> Result:
	if state.game_over:
		return Result.failure(&"game_over")
	if not state.pending.is_empty():
		return Result.failure(&"decision_pending")
	if state.day >= cfg.geti("time:days_total"):
		return _end_game("completed")
	return _begin_day(state.day + 1)


## Sail command — delegates to VoyageEngine; parks pirate decisions.
func sail(dest: int, guards: int) -> Result:
	if state.game_over:
		return Result.failure(&"game_over")
	if not state.pending.is_empty():
		return Result.failure(&"decision_pending")
	var r: Result = voyage.sail(dest, guards)
	if r.ok and r.data.has("decision"):
		var pd: PendingDecision = r.data["decision"]
		pd.id = _take_decision_id()
		state.pending["decision"] = pd.to_dict()
	if r.ok and r.data.has("result"):
		_after_state_change()
	return r


## Answer the open PendingDecision (ADR-0001). Routes by kind.
func answer(decision_id: int, payload: Dictionary) -> Result:
	if not state.pending.has("decision"):
		return Result.failure(&"no_pending_decision")
	var pd: PendingDecision = PendingDecision.from_dict(state.pending["decision"])
	if pd.id != decision_id:
		return Result.failure(&"stale_decision_id")
	match pd.kind:
		Types.DECISION_EXPAND_OFFER:
			return _close(morning.resolve_expand(pd.context, bool(payload.get("accepted", false))))
		Types.DECISION_MERCHANT_BUY:
			return _close(morning.resolve_merchant_buy(pd.context, bool(payload.get("accepted", false))))
		Types.DECISION_MERCHANT_SELL:
			return _close(morning.resolve_merchant_sell(pd.context, bool(payload.get("accepted", false))))
		Types.DECISION_CREW_STRIKE:
			return _resolve_crew(payload)
		Types.DECISION_PIRATE_CHOICE:
			return _resolve_pirates(payload)
		_:
			return Result.failure(&"unknown_decision_kind")


## Close the open decision when its resolution succeeded; a failed resolution
## (invalid offer) keeps it open so the UI can re-prompt.
func _close(r: Result) -> Result:
	if r.ok:
		state.pending = {}
	return r


func _resolve_crew(payload: Dictionary) -> Result:
	var r: Result = morning.resolve_crew(payload)
	if not r.ok:
		return r  # invalid offer — decision stays open for a corrected answer
	state.pending = {}
	var skip_days: int = int(r.data["skip_days"])
	if skip_days > 0:
		# current day is lost (plus one more on failed negotiation)
		var target: int = state.day + skip_days
		if target > cfg.geti("time:days_total"):
			return _end_game("crew_strike_out_of_days")
		var day_result: Result = _begin_day(target)
		day_result.data["skipped_to_day"] = target
		return day_result
	return r


func _resolve_pirates(payload: Dictionary) -> Result:
	var r: Result = pirates.resolve_choice(payload)
	if not r.ok:
		return r  # invalid compromise offer — re-prompt
	state.pending.erase("decision")
	var outcome: Dictionary = voyage.finish_after_pirates(r.data)
	_after_state_change()
	return Result.success({"result": outcome})


## Port commands — thin, validated delegates. All are blocked while the game
## is over or a decision is pending (the original's modal morning events).
func buy(good: int, qty: int) -> Result:
	var gate: Result = _command_gate()
	return trade.buy(good, qty) if gate.ok else gate


func sell(good: int, qty: int) -> Result:
	var gate: Result = _command_gate()
	return trade.sell(good, qty) if gate.ok else gate


func deposit(amount: int) -> Result:
	var gate: Result = _command_gate()
	return bank.deposit(amount) if gate.ok else gate


func withdraw(amount: int) -> Result:
	var gate: Result = _command_gate()
	return bank.withdraw(amount) if gate.ok else gate


func repair(amount: int) -> Result:
	var gate: Result = _command_gate()
	if not gate.ok:
		return gate
	if not ship.roll_dock_open():
		return Result.failure(&"dock_closed")
	return ship.repair(amount)


func _command_gate() -> Result:
	if state.game_over:
		return Result.failure(&"game_over")
	if not state.pending.is_empty():
		return Result.failure(&"decision_pending")
	return Result.success()


func _after_state_change() -> void:
	if score.is_stuck():
		_end_game("stuck")


func _end_game(reason: String) -> Result:
	state.game_over = true
	return Result.success({
		"game_over": true,
		"reason": reason,
		"score": score.final_score(),
	})


func _take_decision_id() -> int:
	var id: int = _next_decision_id
	_next_decision_id += 1
	return id


## Full serializable payload for saves (ADR-0004).
func to_save_dict() -> Dictionary:
	return {"state": state.to_dict(), "rng_state": rng.get_state(),
		"next_decision_id": _next_decision_id}


func load_save_dict(d: Dictionary) -> void:
	_build(GameState.from_dict(d["state"]))
	rng.restore_state(int(d["rng_state"]))
	_next_decision_id = int(d["next_decision_id"])
