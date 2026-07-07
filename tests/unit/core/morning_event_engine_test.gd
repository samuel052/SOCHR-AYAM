# Morning-event engine. GDD: morning-events (TR-MORN-01..07).
class_name MorningEventEngineTest
extends GdUnitTestSuite


func _engine(seed_value: int = 555) -> GameEngine:
	var eng: GameEngine = TestConfig.engine(seed_value)
	eng.new_game()
	return eng


func _family_of(outcome: Dictionary) -> String:
	if outcome.has("decision"):
		var pd: PendingDecision = outcome["decision"]
		match pd.kind:
			Types.DECISION_EXPAND_OFFER: return "expand"
			Types.DECISION_CREW_STRIKE: return "crew"
			Types.DECISION_MERCHANT_BUY: return "merchant_buy"
			Types.DECISION_MERCHANT_SELL: return "merchant_sell"
		return "unknown"
	return String(outcome["event"])


func test_day_one_has_no_event_and_no_storm() -> void:
	# TR-MORN-01 (first half): asserted via new_game state
	var eng := _engine()
	assert_int(eng.state.day).is_equal(1)
	assert_int(eng.state.storm_port).is_equal(Types.NO_STORM)
	assert_str(eng.state.last_event_family).is_equal("")


func test_storm_chance_is_three_eighths() -> void:
	# TR-MORN-01: rand(8)<3 = 37.5% on days 2+
	var eng := _engine(31337)
	eng.state.day = 2
	var storms: int = 0
	var runs: int = 4000
	for i in runs:
		if eng.morning.roll_weather() != Types.NO_STORM:
			storms += 1
	assert_int(storms).is_between(1350, 1650)  # 1500 ±10%


func test_no_family_repeats_two_days_in_a_row() -> void:
	# TR-MORN-03
	var eng := _engine(2024)
	eng.state.day = 2
	eng.state.cash = 8000
	eng.state.cargo = [3, 10, 50]
	var previous: String = ""
	for i in 300:
		var outcome: Dictionary = eng.morning.roll_event()
		var family: String = _family_of(outcome)
		if previous != "":
			assert_str(family).is_not_equal(previous)
		previous = eng.state.last_event_family
		eng.state.pending = {}


func test_crew_never_on_days_6_and_7() -> void:
	# TR-MORN-04
	var eng := _engine(99)
	eng.state.cash = 8000
	eng.state.cargo = [3, 10, 50]
	for day in [6, 7]:
		eng.state.day = day
		for i in 200:
			eng.state.last_event_family = ""
			var family: String = _family_of(eng.morning.roll_event())
			assert_str(family).is_not_equal("crew")


func test_raw_family_weights_match_30_codes() -> void:
	# TR-MORN-02: with all families feasible and no-repeat disabled effect
	# minimized, observed shares should approximate the raw weights.
	var eng := _engine(77)
	eng.state.day = 3
	var counts: Dictionary = {}
	var runs: int = 3000
	for i in runs:
		# refresh state every roll: fired events mutate cash/cargo (thefts,
		# fishing) and would gradually disqualify families, skewing the counts
		eng.state.cash = 50000
		eng.state.cargo = [5, 20, 90]
		eng.state.damage = 0
		eng.state.last_event_family = ""  # neutralize the no-repeat rule
		var family: String = _family_of(eng.morning.roll_event())
		counts[family] = int(counts.get(family, 0)) + 1
	# price 12/30=40%, expand 6/30=20%, merchant_buy 4/30≈13.3%,
	# crew/thieves/merchant_sell/fishing 2/30≈6.7% each
	assert_int(int(counts.get("price", 0))).is_between(1050, 1350)
	assert_int(int(counts.get("expand", 0))).is_between(480, 720)
	assert_int(int(counts.get("merchant_buy", 0))).is_between(300, 500)
	for family in ["crew", "thieves", "merchant_sell", "fishing"]:
		assert_int(int(counts.get(family, 0))).is_between(120, 280)


func test_thieves_money_formula_edges() -> void:
	# GDD §3.5: stolen = 10 * trunc(cash / (rand(40)+40)); edges rand=0 and 39
	var pair: Array = TestConfig.engine_with_fake()
	var eng: GameEngine = pair[0]
	var fake: FakeRng = pair[1]
	eng.new_game()
	eng.state.cash = 4000
	fake.push([0])  # divisor 40 -> 10*trunc(4000/40)=1000
	var outcome: Dictionary = eng.morning._try_thieves("money")
	assert_int(int(outcome["stolen"])).is_equal(1000)
	assert_int(eng.state.cash).is_equal(3000)
	fake.push([39])  # divisor 79 -> 10*trunc(3000/79)=370
	outcome = eng.morning._try_thieves("money")
	assert_int(int(outcome["stolen"])).is_equal(370)


func test_thieves_goods_clamps_to_min_one_ton() -> void:
	# GDD §3.5: pct roll 0 => calculated 0 => clamp to 1
	var pair: Array = TestConfig.engine_with_fake()
	var eng: GameEngine = pair[0]
	var fake: FakeRng = pair[1]
	eng.new_game()
	eng.state.cargo = [3, 0, 0]
	fake.push([0])
	var outcome: Dictionary = eng.morning._try_thieves("goods")
	assert_int(int(outcome["qty"])).is_equal(1)
	assert_int(eng.state.cargo[Types.Good.COPPER]).is_equal(2)


func test_expand_cost_formula_bounds() -> void:
	# GDD §3.3: delta=50 => 1000..1490; delta=100 => 2000..2990 (multiples of 10)
	var pair: Array = TestConfig.engine_with_fake()
	var eng: GameEngine = pair[0]
	var fake: FakeRng = pair[1]
	eng.new_game()
	eng.state.cash = 100000
	fake.push([0, 0])  # delta option 0 (=50), cost roll 0 -> 1000
	var low: Dictionary = eng.morning._try_expand()
	var pd_low: PendingDecision = low["decision"]
	assert_int(int(pd_low.context["cost"])).is_equal(1000)
	fake.push([1, 99])  # delta option 1 (=100), cost roll 99 -> 10*(200+99)=2990
	var high: Dictionary = eng.morning._try_expand()
	var pd_high: PendingDecision = high["decision"]
	assert_int(int(pd_high.context["cost"])).is_equal(2990)


func test_crew_negotiation_strictly_greater_than_threshold() -> void:
	# GDD §3.4: OfferValue must be > TotalWealth/divisor; equality fails.
	var pair: Array = TestConfig.engine_with_fake()
	var eng: GameEngine = pair[0]
	var fake: FakeRng = pair[1]
	eng.new_game()
	eng.state.cash = 4000
	eng.state.cargo = [0, 0, 0]
	# divisor roll 0 -> divisor 4 -> threshold 1000; offering exactly 1000 fails
	fake.push([0])
	var equal_offer: Result = eng.morning.resolve_crew(
		{"negotiate": true, "offer": {"cash": 1000}})
	assert_bool(bool(equal_offer.data["accepted"])).is_false()
	assert_int(int(equal_offer.data["skip_days"])).is_equal(2)
	assert_int(eng.state.cash).is_equal(4000)  # failed talks charge nothing
	fake.push([0])
	var winning_offer: Result = eng.morning.resolve_crew(
		{"negotiate": true, "offer": {"cash": 1001}})
	assert_bool(bool(winning_offer.data["accepted"])).is_true()
	assert_int(eng.state.cash).is_equal(2999)


func test_merchant_buy_takes_whole_stock_by_scan_order() -> void:
	# GDD §3.6: first good with >1 ton in copper->olives->wheat order; whole qty
	var eng := _engine(6)
	eng.state.cargo = [0, 2, 80]  # olives first eligible
	var outcome: Dictionary = eng.morning._try_merchant_buy()
	var pd: PendingDecision = outcome["decision"]
	assert_int(int(pd.context["good"])).is_equal(Types.Good.OLIVES)
	assert_int(int(pd.context["qty"])).is_equal(2)
	eng.morning.resolve_merchant_buy(pd.context, true)
	assert_int(eng.state.cargo[Types.Good.OLIVES]).is_equal(0)


func test_fishing_damage_formula() -> void:
	# GDD §3.8: damage = 10*trunc((cash+cargo_value)/(rand(80)+150))
	var pair: Array = TestConfig.engine_with_fake()
	var eng: GameEngine = pair[0]
	var fake: FakeRng = pair[1]
	eng.new_game()
	eng.state.cash = 15000
	eng.state.cargo = [0, 0, 0]
	fake.push([0])  # divisor 150 -> 10*trunc(15000/150) = 1000
	var outcome: Dictionary = eng.morning._try_fishing()
	assert_int(int(outcome["damage"])).is_equal(1000)
	assert_int(eng.state.damage).is_equal(1000)


func test_declining_offers_changes_nothing() -> void:
	# TR-MORN-07
	var eng := _engine(8)
	eng.state.cargo = [5, 0, 0]
	var before: Dictionary = eng.state.to_dict()
	var outcome: Dictionary = eng.morning._try_merchant_buy()
	var pd: PendingDecision = outcome["decision"]
	eng.morning.resolve_merchant_buy(pd.context, false)
	assert_that(eng.state.to_dict()).is_equal(before)
