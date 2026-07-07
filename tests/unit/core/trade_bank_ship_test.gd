# Trading, bank and ship invariants. GDDs: trading (TR-TRADE-01..05),
# banking (TR-BANK-01..03), ship-damage-repair (TR-SHIP-01..05).
class_name TradeBankShipTest
extends GdUnitTestSuite


func _engine() -> GameEngine:
	var eng: GameEngine = TestConfig.engine(4242)
	eng.new_game()
	return eng


func test_new_game_start_values() -> void:
	var eng := _engine()
	assert_int(eng.state.cash).is_equal(5000)
	assert_int(eng.state.capacity).is_equal(100)
	assert_int(eng.state.day).is_equal(1)
	assert_int(eng.state.storm_port).is_equal(Types.NO_STORM)  # day 1: always fine


func test_buy_atomic_and_never_negative_cash() -> void:
	var eng := _engine()
	var price: int = eng.state.price_of(eng.state.port, Types.Good.WHEAT)
	var affordable: int = Types.idiv(eng.state.cash, price)
	var r: Result = eng.buy(Types.Good.WHEAT, affordable + 1)
	assert_bool(r.ok).is_false()
	assert_int(eng.state.cargo[Types.Good.WHEAT]).is_equal(0)
	var r2: Result = eng.buy(Types.Good.WHEAT, affordable)
	assert_bool(r2.ok).is_true()
	assert_bool(eng.state.cash >= 0).is_true()


func test_sell_never_oversells() -> void:
	var eng := _engine()
	eng.buy(Types.Good.WHEAT, 10)
	var r: Result = eng.sell(Types.Good.WHEAT, 11)
	assert_bool(r.ok).is_false()
	assert_int(eng.state.cargo[Types.Good.WHEAT]).is_equal(10)


func test_overload_purchase_allowed() -> void:
	# TR-TRADE-03: buying beyond capacity is legal (risk resolves at sea)
	var eng := _engine()
	eng.state.cash = 1000000
	var r: Result = eng.buy(Types.Good.WHEAT, eng.state.capacity + 50)
	assert_bool(r.ok).is_true()
	assert_bool(eng.state.cargo_total() > eng.state.capacity).is_true()


func test_ship_value_excludes_bank() -> void:
	# TR-TRADE-05
	var eng := _engine()
	eng.deposit(3000)
	var v: int = eng.state.ship_value(eng.state.port)
	assert_int(v).is_equal(eng.state.cash)  # no cargo yet


func test_bank_round_trip_conserves_money() -> void:
	# TR-BANK-01
	var eng := _engine()
	var total: int = eng.state.cash + eng.state.bank
	eng.deposit(2000)
	eng.withdraw(500)
	assert_int(eng.state.cash + eng.state.bank).is_equal(total)


func test_bank_rejects_overdraft() -> void:
	var eng := _engine()
	assert_bool(eng.withdraw(1).ok).is_false()
	assert_bool(eng.deposit(999999).ok).is_false()


func test_damage_blocks_sailing_above_1000() -> void:
	# TR-SHIP-01
	var eng := _engine()
	eng.ship.add_damage(1001)
	var r: Result = eng.voyage.plan(Types.Port.EGYPT)
	assert_bool(r.ok).is_false()
	assert_str(String(r.error)).is_equal("damage_blocks_sailing")
	eng.state.dock_rolled_today = true
	eng.state.dock_closed_today = false
	eng.repair(1)
	assert_bool(eng.voyage.plan(Types.Port.EGYPT).ok).is_true()  # damage now 1000


func test_repair_one_to_one_and_bounded() -> void:
	# TR-SHIP-02
	var eng := _engine()
	eng.ship.add_damage(500)
	eng.state.dock_rolled_today = true
	eng.state.dock_closed_today = false
	var r: Result = eng.repair(200)
	assert_bool(r.ok).is_true()
	assert_int(eng.state.damage).is_equal(300)
	assert_bool(eng.repair(301).ok).is_false()  # overpay rejected


func test_dock_open_guaranteed_after_closed_day() -> void:
	# TR-SHIP-04 (second half)
	var eng := _engine()
	eng.state.dock_closed_yesterday = true
	assert_bool(eng.ship.roll_dock_open()).is_true()


func test_dock_closed_roughly_20_percent() -> void:
	# TR-SHIP-04 statistical: fresh roll each day, expect ~20% closed
	var eng := _engine()
	var closed: int = 0
	for i in 2000:
		eng.state.dock_rolled_today = false
		eng.state.dock_closed_yesterday = false
		if not eng.ship.roll_dock_open():
			closed += 1
	assert_int(closed).is_between(320, 480)  # 20% of 2000 = 400 ±20%
