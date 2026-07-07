## Scripted RNG double for formula edge tests (ADR-0002).
## Queue forced values with push(); every draw is logged for call-order asserts.
## An empty queue falls back to the seeded stream (seed 0) so tests fail loudly
## only when they asserted on the log.
class_name FakeRng
extends RngService

var forced: Array[int] = []
var draw_log: Array[Dictionary] = []


func _init() -> void:
	super._init(0)


func push(values: Array) -> void:
	for v in values:
		forced.append(int(v))


func randn(n: int) -> int:
	var value: int
	if forced.is_empty():
		value = super.randn(n)
	else:
		value = forced.pop_front()
		assert(value >= 0 and value < n,
			"FakeRng forced value %d out of range for randn(%d)" % [value, n])
	draw_log.append({"n": n, "value": value})
	return value
