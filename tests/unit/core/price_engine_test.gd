# Daily prices + price-change events. GDD: market-prices §3-4 (TR-PRICE-01..04).
class_name PriceEngineTest
extends GdUnitTestSuite


func _engine() -> GameEngine:
	var eng: GameEngine = TestConfig.engine(777)
	eng.new_game()
	return eng


func test_daily_prices_within_original_ranges_and_steps() -> void:
	# TR-PRICE-01: copper 2500-3500/100, olives 350-650/50, wheat 35-70/5
	var eng := _engine()
	for day_run in 30:
		eng.prices.roll_daily_prices(eng.state)
		for port in 3:
			var copper: int = eng.state.price_of(port, Types.Good.COPPER)
			var olives: int = eng.state.price_of(port, Types.Good.OLIVES)
			var wheat: int = eng.state.price_of(port, Types.Good.WHEAT)
			assert_int(copper).is_between(2500, 3500)
			assert_int(copper % 100).is_equal(0)
			assert_int(olives).is_between(350, 650)
			assert_int(olives % 50).is_equal(0)
			assert_int(wheat).is_between(35, 70)
			assert_int(wheat % 5).is_equal(0)


func test_no_duplicate_price_for_same_good_across_ports() -> void:
	# TR-PRICE-02
	var eng := _engine()
	for day_run in 50:
		eng.prices.roll_daily_prices(eng.state)
		for good in Types.GOODS_SCAN_ORDER:
			var seen: Dictionary = {}
			for port in 3:
				var p: int = eng.state.price_of(port, good)
				assert_bool(seen.has(p)).is_false()
				seen[p] = true


func test_price_event_copper_up_range() -> void:
	# TR-PRICE-03: copper up = base + 1100..1500 (steps of 100); base=3000 (fixed_mid)
	var eng := _engine()
	for i in 40:
		var applied: Dictionary = eng.prices.apply_price_event(
			eng.state, Types.Good.COPPER, "up")
		assert_int(int(applied["price"])).is_between(4100, 4500)
		assert_int(int(applied["price"]) % 100).is_equal(0)


func test_price_event_wheat_down_range() -> void:
	# wheat down = base - (15..25); base=50 => 25..35 in steps of 5
	var eng := _engine()
	for i in 40:
		var applied: Dictionary = eng.prices.apply_price_event(
			eng.state, Types.Good.WHEAT, "down")
		assert_int(int(applied["price"])).is_between(25, 35)


func test_price_event_writes_exactly_one_cell() -> void:
	# TR-PRICE-04
	var eng := _engine()
	eng.prices.roll_daily_prices(eng.state)
	var before: Array = eng.state.prices.duplicate(true)
	var applied: Dictionary = eng.prices.apply_price_event(
		eng.state, Types.Good.OLIVES, "up")
	var changed: int = 0
	for port in 3:
		for good in 3:
			if int(before[port][good]) != eng.state.price_of(port, good):
				changed += 1
				assert_int(port).is_equal(int(applied["port"]))
				assert_int(good).is_equal(int(applied["good"]))
	assert_int(changed).is_equal(1)


func test_price_event_edge_values_with_forced_rolls() -> void:
	# Edges via FakeRng: port roll, then delta roll. olives up: 200 + 50*rand(4)
	var pair: Array = TestConfig.engine_with_fake()
	var eng: GameEngine = pair[0]
	var fake: FakeRng = pair[1]
	eng.state.capacity = 100
	fake.push([0, 0])  # port=israel, delta roll=0 -> 500+200=700
	var lo: Dictionary = eng.prices.apply_price_event(eng.state, Types.Good.OLIVES, "up")
	assert_int(int(lo["price"])).is_equal(700)
	fake.push([2, 3])  # port=egypt, delta roll=3 -> 500+200+150=850
	var hi: Dictionary = eng.prices.apply_price_event(eng.state, Types.Good.OLIVES, "up")
	assert_int(int(hi["price"])).is_equal(850)
