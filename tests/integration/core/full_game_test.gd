# End-to-end headless runs: determinism (golden seed), save/load round-trip,
# and a scripted week. GDD: TR-ARCH-001/003/006, TR-END-06, ADR-0001/0002/0004.
class_name FullGameTest
extends GdUnitTestSuite


## Stable stringification for transcripts: strips live objects (PendingDecision
## references print instance IDs, which differ between runs by design).
func _stable(data: Dictionary) -> String:
	var clean: Dictionary = data.duplicate(true)
	clean.erase("decision")
	return str(clean)


## Plays a scripted, decision-answering week and returns a transcript string.
func _play_scripted_week(seed_value: int) -> String:
	var eng: GameEngine = TestConfig.engine(seed_value)
	var transcript: String = ""
	var r: Result = eng.new_game()
	transcript += "day1:%s;" % str(r.data.get("storm_port"))
	var safety: int = 0
	while not eng.state.game_over:
		safety += 1
		assert(safety < 200, "scripted game did not terminate")
		# answer any pending decision by declining / refusing / fighting
		if eng.state.pending.has("decision"):
			var pd: PendingDecision = PendingDecision.from_dict(eng.state.pending["decision"])
			var payload: Dictionary = {"accepted": false}
			if pd.kind == Types.DECISION_CREW_STRIKE:
				payload = {"negotiate": false}
			elif pd.kind == Types.DECISION_PIRATE_CHOICE:
				payload = {"action": "fight"}
			var answered: Result = eng.answer(pd.id, payload)
			transcript += "ans(%s):%s;" % [String(pd.kind), _stable(answered.data)]
			continue
		# simple strategy: buy wheat, sail to Egypt if possible, else rest
		if eng.state.cargo_total() == 0 and eng.state.cash > 0:
			var price: int = eng.state.price_of(eng.state.port, Types.Good.WHEAT)
			var qty: int = mini(Types.idiv(eng.state.cash, price), eng.state.capacity)
			if qty > 0:
				eng.buy(Types.Good.WHEAT, qty)
		var dest: int = Types.Port.EGYPT if eng.state.port != Types.Port.EGYPT else Types.Port.ISRAEL
		var sailed: Result = eng.sail(dest, 0)
		if sailed.ok and sailed.data.has("result"):
			transcript += "sail:%s;" % _stable(sailed.data["result"])
			if eng.state.cargo[Types.Good.WHEAT] > 0:
				eng.sell(Types.Good.WHEAT, eng.state.cargo[Types.Good.WHEAT])
		elif sailed.ok:
			continue  # pirate decision pending
		else:
			var rested: Result = eng.rest()
			transcript += "rest:%s;" % _stable(rested.data)
	transcript += "score:%d" % eng.score.final_score()
	return transcript


func test_golden_seed_full_game_is_deterministic() -> void:
	# TR-ARCH-003: same seed + same commands => identical outcome
	var first: String = _play_scripted_week(20260707)
	var second: String = _play_scripted_week(20260707)
	assert_str(second).is_equal(first)


func test_different_seeds_diverge() -> void:
	var a: String = _play_scripted_week(1)
	var b: String = _play_scripted_week(2)
	assert_str(a).is_not_equal(b)


func test_save_load_round_trip_preserves_state_and_stream() -> void:
	# TR-END-06: save -> load restores state and the RNG stream exactly
	var eng: GameEngine = TestConfig.engine(555)
	eng.new_game()
	if eng.state.pending.has("decision"):
		var pd: PendingDecision = PendingDecision.from_dict(eng.state.pending["decision"])
		eng.answer(pd.id, {"accepted": false, "negotiate": false, "action": "fight"})
	eng.buy(Types.Good.OLIVES, 3)
	var saved: Dictionary = eng.to_save_dict()
	var expected_state: Dictionary = eng.state.to_dict()
	var expected_rolls: Array[int] = []
	for i in 20:
		expected_rolls.append(eng.rng.randn(1000))
	var restored: GameEngine = TestConfig.engine(1)  # different seed on purpose
	restored.load_save_dict(saved)
	assert_that(restored.state.to_dict()).is_equal(expected_state)
	for i in 20:
		assert_int(restored.rng.randn(1000)).is_equal(expected_rolls[i])


func test_rest_through_seven_days_ends_game() -> void:
	# TR-TIME-01 / TR-END-01: resting every day ends after day 7
	var eng: GameEngine = TestConfig.engine(31415)
	eng.new_game()
	var safety: int = 0
	while not eng.state.game_over:
		safety += 1
		assert(safety < 40, "week did not terminate")
		if eng.state.pending.has("decision"):
			var pd: PendingDecision = PendingDecision.from_dict(eng.state.pending["decision"])
			var payload: Dictionary = {"accepted": false}
			if pd.kind == Types.DECISION_CREW_STRIKE:
				payload = {"negotiate": false}
			elif pd.kind == Types.DECISION_PIRATE_CHOICE:
				payload = {"action": "fight"}
			eng.answer(pd.id, payload)
			continue
		var r: Result = eng.rest()
		if r.data.has("game_over"):
			assert_str(String(r.data["reason"])).is_equal("completed")
			assert_int(int(r.data["score"])).is_equal(eng.state.cash + eng.state.bank)
	assert_bool(eng.state.game_over).is_true()
	assert_bool(eng.state.day <= 7).is_true()
