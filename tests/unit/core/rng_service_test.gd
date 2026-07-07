# RNG service: Pascal random(n) semantics, determinism, state round-trip.
# GDD refs: ADR-0002; TR-END-06.
class_name RngServiceTest
extends GdUnitTestSuite


func test_randn_stays_in_range() -> void:
	var rng := RngService.new(42)
	for i in 1000:
		var v: int = rng.randn(30)
		assert_int(v).is_between(0, 29)


func test_randn_of_one_is_always_zero() -> void:
	var rng := RngService.new(7)
	for i in 20:
		assert_int(rng.randn(1)).is_equal(0)


func test_same_seed_same_stream() -> void:
	var a := RngService.new(99)
	var b := RngService.new(99)
	for i in 100:
		assert_int(a.randn(1000)).is_equal(b.randn(1000))


func test_state_round_trip_preserves_stream() -> void:
	var rng := RngService.new(5)
	rng.randn(10)
	var saved: int = rng.get_state()
	var expected: Array[int] = []
	for i in 10:
		expected.append(rng.randn(100))
	rng.restore_state(saved)
	for i in 10:
		assert_int(rng.randn(100)).is_equal(expected[i])


func test_randn_distribution_covers_all_values() -> void:
	var rng := RngService.new(1234)
	var seen: Dictionary = {}
	for i in 3000:
		seen[rng.randn(30)] = true
	assert_int(seen.size()).is_equal(30)
