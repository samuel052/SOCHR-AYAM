# Voyage engine: envelope, layers, damage mechanism, winds table.
# GDD: sailing-engine (TR-SAIL-01..08), time-calendar (TR-TIME-02/03/06).
class_name VoyageEngineTest
extends GdUnitTestSuite


func _engine(seed_value: int = 314) -> GameEngine:
	var eng: GameEngine = TestConfig.engine(seed_value)
	eng.new_game()
	return eng


func test_travel_hours_match_original() -> void:
	var eng := _engine()
	assert_int(eng.voyage.travel_hours(Types.Port.ISRAEL, Types.Port.EGYPT)).is_equal(4)
	assert_int(eng.voyage.travel_hours(Types.Port.ISRAEL, Types.Port.TURKEY)).is_equal(4)
	assert_int(eng.voyage.travel_hours(Types.Port.EGYPT, Types.Port.TURKEY)).is_equal(8)


func test_too_late_departure_blocked() -> void:
	# TR-TIME-03: arrival past 20:00 is forbidden
	var eng := _engine()
	eng.state.clock = 17
	var r: Result = eng.voyage.plan(Types.Port.EGYPT)  # 17+4=21 > 20
	assert_bool(r.ok).is_false()
	assert_str(String(r.error)).is_equal("too_late")


func test_night_flag_when_arrival_after_16() -> void:
	# TR-TIME-04 (assumption: arrival strictly after 16:00)
	var eng := _engine()
	eng.state.clock = 13
	var r: Result = eng.voyage.plan(Types.Port.EGYPT)  # arrive 17
	assert_bool(bool(r.data["night"])).is_true()
	eng.state.clock = 12
	var r2: Result = eng.voyage.plan(Types.Port.EGYPT)  # arrive 16 sharp
	assert_bool(bool(r2.data["night"])).is_false()


func test_general_damage_minimum_75_and_multiple_of_5() -> void:
	# TR-SAIL-04: min 75 for an undamaged ship; result multiple of 5
	var pair: Array = TestConfig.engine_with_fake()
	var eng: GameEngine = pair[0]
	var fake: FakeRng = pair[1]
	eng.new_game()
	eng.state.cash = 100  # tiny value => raw damage below minimum
	eng.state.cargo = [0, 0, 0]
	eng.state.damage = 0
	fake.push([0])  # divisor 200
	var dmg: int = eng.voyage._general_damage(Types.Port.ISRAEL)
	assert_int(dmg).is_equal(75)


func test_general_damage_repeat_bonus_third() -> void:
	# TR-SAIL-04: already-damaged ship takes +1/3, rounded to 5s
	var pair: Array = TestConfig.engine_with_fake()
	var eng: GameEngine = pair[0]
	var fake: FakeRng = pair[1]
	eng.new_game()
	eng.state.cash = 30000
	eng.state.cargo = [0, 0, 0]
	eng.state.damage = 10
	fake.push([0])  # divisor 200 -> base dmg 5*trunc(30000/200)=750; +250; =1000
	var dmg: int = eng.voyage._general_damage(Types.Port.ISRAEL)
	assert_int(dmg).is_equal(1000)
	assert_int(eng.state.damage).is_equal(1010)


func test_overload_certain_sinking_above_70() -> void:
	# TR-SAIL-05: over > 70 sinks with certainty and jettisons 1..half
	var eng := _engine()
	eng.state.capacity = 100
	eng.state.cargo = [0, 0, 180]  # over = 80
	var out: Dictionary = eng.voyage._overload_check(Types.Port.ISRAEL)
	assert_str(String(out["event"])).is_equal("overload")
	assert_int(int(out["thrown"])).is_between(1, 90)
	assert_int(eng.state.cargo[Types.Good.WHEAT]).is_between(90, 179)


func test_overload_ladder_low_band_is_one_in_six() -> void:
	# TR-SAIL-05 statistical: over<=20 => 1/6
	var eng := _engine(2718)
	var sank: int = 0
	var runs: int = 3000
	for i in runs:
		eng.state.capacity = 100
		eng.state.cargo = [0, 0, 110]  # over = 10
		if not eng.voyage._overload_check(Types.Port.ISRAEL).is_empty():
			sank += 1
	assert_int(sank).is_between(400, 600)  # 500 ±20%


func test_winds_redirect_table_covers_all_routes() -> void:
	# TR-SAIL-06: Israel-bound => Turkey; otherwise => Israel;
	# +4h only for Egypt->Israel diverted to Turkey.
	var eng := _engine()
	var cases: Array = [
		# [origin, dest, expected_new_dest, expected_extra]
		[Types.Port.EGYPT, Types.Port.ISRAEL, Types.Port.TURKEY, 4],
		[Types.Port.TURKEY, Types.Port.ISRAEL, Types.Port.TURKEY, 0],
		[Types.Port.ISRAEL, Types.Port.EGYPT, Types.Port.ISRAEL, 0],
		[Types.Port.ISRAEL, Types.Port.TURKEY, Types.Port.ISRAEL, 0],
		[Types.Port.EGYPT, Types.Port.TURKEY, Types.Port.ISRAEL, 0],
		[Types.Port.TURKEY, Types.Port.EGYPT, Types.Port.ISRAEL, 0],
	]
	for c in cases:
		var out: Dictionary = eng.voyage._winds(int(c[0]), int(c[1]))
		assert_int(int(out["new_dest"])).is_equal(int(c[2]))
		assert_int(int(out["extra_hours"])).is_equal(int(c[3]))


func test_port_block_returns_to_origin_with_double_time() -> void:
	# TR-SAIL-07
	var eng := _engine()
	var origin: int = eng.state.port
	var out: Dictionary = eng.voyage._finish(origin, Types.Port.EGYPT, 4,
		{"event": "port_blocked", "reason": "fog"})
	assert_int(int(out["arrival_port"])).is_equal(origin)
	assert_int(eng.state.clock).is_equal(8 + 8)


func test_deserted_ship_quantity_rounds_up() -> void:
	# GDD sailing §3.12 (QQ-07 fill): qty = ceil(value / dest price)
	var pair: Array = TestConfig.engine_with_fake()
	var eng: GameEngine = pair[0]
	var fake: FakeRng = pair[1]
	eng.new_game()
	eng.state.cash = 5000
	eng.state.cargo = [0, 0, 0]
	eng.state.prices[Types.Port.EGYPT][Types.Good.COPPER] = 3000
	# good roll=0 (copper), value roll=0 -> value=100 -> ceil(100/3000)=1
	fake.push([0, 0])
	var out: Dictionary = eng.voyage._deserted(Types.Port.ISRAEL, Types.Port.EGYPT)
	assert_int(int(out["qty"])).is_equal(1)
	assert_int(eng.state.cargo[Types.Good.COPPER]).is_equal(1)


func test_regular_table_distribution() -> void:
	# TR-SAIL-02: pirates 30%, winds 5%, deserted 10%, safe 55%
	var eng := _engine(161803)
	var counts: Dictionary = {"pirates": 0, "winds": 0, "deserted": 0, "none": 0}
	var runs: int = 6000
	for i in runs:
		eng.state.cash = 5000
		eng.state.cargo = [0, 0, 0]
		var out: Dictionary = eng.voyage._regular_table(Types.Port.ISRAEL, Types.Port.EGYPT)
		if out.has("pirate_decision"):
			counts["pirates"] += 1
		else:
			var key: String = String(out["event"])
			counts[key] = int(counts.get(key, 0)) + 1
	assert_int(int(counts["pirates"])).is_between(1620, 1980)   # 1800 ±10%
	assert_int(int(counts["winds"])).is_between(210, 390)       # 300 ±30%
	assert_int(int(counts["deserted"])).is_between(480, 720)    # 600 ±20%
	assert_int(int(counts["none"])).is_between(2970, 3630)      # 3300 ±10%
