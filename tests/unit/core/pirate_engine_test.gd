# Pirate encounter mechanics. GDD: pirates (TR-PIR-01..06).
class_name PirateEngineTest
extends GdUnitTestSuite


func _engine(seed_value: int = 911) -> GameEngine:
	var eng: GameEngine = TestConfig.engine(seed_value)
	eng.new_game()
	return eng


func test_zero_guards_always_loses_fight() -> void:
	# TR-PIR-01: power 0 => certain loss
	var eng := _engine()
	for i in 50:
		eng.state.guards = 0
		eng.state.cash = 1000
		var out: Dictionary = eng.pirates.resolve_choice({"action": "fight"}).data
		assert_str(String(out["outcome"])).is_equal("lost")


func test_four_guards_always_win_fight() -> void:
	# TR-PIR-01: power 4+ => certain win (roll1 max is 3)
	var eng := _engine()
	for i in 50:
		eng.state.guards = 4
		var out: Dictionary = eng.pirates.resolve_choice({"action": "fight"}).data
		assert_str(String(out["outcome"])).is_equal("won")


func test_one_guard_win_rate_matches_decoded_mechanism() -> void:
	# TR-PIR-01: power 1 => 1/4 + 3/4 * 1/6 = 37.5%
	var eng := _engine(1000)
	var wins: int = 0
	var runs: int = 4000
	for i in runs:
		eng.state.guards = 1
		eng.state.cash = 100000
		eng.state.bank = 0
		eng.state.damage = 0
		if String(eng.pirates.resolve_choice({"action": "fight"}).data["outcome"]) == "won":
			wins += 1
	assert_int(wins).is_between(1350, 1650)  # 1500 ±10%


func test_victory_loot_and_capture_follow_decoded_rolls() -> void:
	# TR-PIR-02 via forced rolls: capture roll==1 -> +50 capacity;
	# else loot=(rand(15)+5)*100; damage 25% (roll==0) of (rand(15)+5)*10.
	var pair: Array = TestConfig.engine_with_fake()
	var eng: GameEngine = pair[0]
	var fake: FakeRng = pair[1]
	eng.new_game()
	eng.state.guards = 4
	var cap_before: int = eng.state.capacity
	# fight roll1=0 (power 4 wins), capture roll=1, damage roll=1 (no damage)
	fake.push([0, 1, 1])
	var captured: Dictionary = eng.pirates.resolve_choice({"action": "fight"}).data
	assert_bool(bool(captured.get("captured_ship", false))).is_true()
	assert_int(eng.state.capacity).is_equal(cap_before + 50)
	# fight roll1=0, capture roll=0 (loot path), loot roll=14 -> 1900,
	# damage roll=0 (damage!), damage value roll=14 -> 190
	eng.state.guards = 4
	var cash_before: int = eng.state.cash
	fake.push([0, 0, 14, 0, 14])
	var looted: Dictionary = eng.pirates.resolve_choice({"action": "fight"}).data
	assert_int(int(looted["loot"])).is_equal(1900)
	assert_int(eng.state.cash).is_equal(cash_before + 1900)
	assert_int(int(looted["damage"])).is_equal(190)


func test_flee_succeeds_for_empty_undamaged_ship() -> void:
	# TR-PIR-03: empty+undamaged => escape_n=capacity/30+1 rolls>0 possible,
	# damage check dmg_n=1 => rand(1)==0 always succeeds once past stage 1.
	var pair: Array = TestConfig.engine_with_fake()
	var eng: GameEngine = pair[0]
	var fake: FakeRng = pair[1]
	eng.new_game()
	eng.state.cargo = [0, 0, 0]
	eng.state.damage = 0
	fake.push([1, 0])  # stage1 roll != 0 passes; stage2 rand(1)=0 succeeds
	var out: Dictionary = eng.pirates.resolve_choice({"action": "flee"}).data
	assert_str(String(out["outcome"])).is_equal("fled")


func test_flee_blocked_above_81_percent_load_goes_to_fight() -> void:
	# TR-PIR-03: cargo > 81% capacity => immediate fail => fight
	var eng := _engine()
	eng.state.capacity = 100
	eng.state.cargo = [0, 0, 82]
	eng.state.guards = 4  # wins the forced fight deterministically
	var out: Dictionary = eng.pirates.resolve_choice({"action": "flee"}).data
	assert_str(String(out["flee_failed"])).is_equal("heavy")
	assert_str(String(out["outcome"])).is_equal("won")


func test_compromise_uses_fixed_values_and_strict_superiority() -> void:
	# TR-PIR-04: fixed values 3000/500/50; equality rejected -> fight
	var pair: Array = TestConfig.engine_with_fake()
	var eng: GameEngine = pair[0]
	var fake: FakeRng = pair[1]
	eng.new_game()
	eng.state.cash = 9000
	eng.state.cargo = [1, 0, 0]  # fixed cargo value 3000
	eng.state.guards = 4
	# demand divisor roll 2 -> divisor 6 -> demand=(3000+9000)/6=2000
	# offer of exactly 2000 (cash) is rejected -> fight (guards 4 => win, rolls consumed)
	fake.push([2, 0, 1, 1])  # demand roll; fight roll1; capture=1; win-damage=1
	var rejected: Dictionary = eng.pirates.resolve_choice(
		{"action": "compromise", "offer": {"cash": 2000}}).data
	assert_bool(bool(rejected.get("compromise_rejected", false))).is_true()
	assert_int(eng.state.cash).is_equal(9000)  # rejected offer charges nothing
	# offer 2001 > demand 2000 is accepted and charged
	fake.push([2])
	var accepted: Dictionary = eng.pirates.resolve_choice(
		{"action": "compromise", "offer": {"cash": 2001}}).data
	assert_str(String(accepted["outcome"])).is_equal("compromise_accepted")
	assert_int(eng.state.cash).is_equal(9000 - 2001)


func test_compromise_over_ownership_is_invalid_and_reprompts() -> void:
	var eng := _engine()
	eng.state.cargo = [0, 0, 0]
	var r: Result = eng.pirates.resolve_choice(
		{"action": "compromise", "offer": {"copper": 5}})
	assert_bool(r.ok).is_false()
	assert_str(String(r.error)).is_equal("offer_exceeds_cargo")


func test_loss_branch_steals_and_damages_within_config_bounds() -> void:
	# TR-PIR-06 (QQ-01 fill): steal 1..cash/5; damage 100..(cash+bank)/2
	var eng := _engine(37)
	for i in 200:
		eng.state.guards = 0
		eng.state.cash = 5000
		eng.state.bank = 5000
		eng.state.damage = 0
		var out: Dictionary = eng.pirates.resolve_choice({"action": "fight"}).data
		assert_int(int(out["stolen"])).is_between(1, 1000)
		assert_int(int(out["damage"])).is_between(100, Types.idiv(eng.state.cash + eng.state.bank, 2))
