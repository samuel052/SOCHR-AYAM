## Single injected randomness source for all core logic (ADR-0002).
## `randn(n)` follows Turbo Pascal `random(n)` semantics: uniform int in 0..n-1.
## Direct randi()/randf() calls are forbidden anywhere else under src/core/.
class_name RngService
extends RefCounted

var _rng := RandomNumberGenerator.new()


func _init(seed_value: int = -1) -> void:
	if seed_value >= 0:
		_rng.seed = seed_value
	else:
		_rng.randomize()


## Uniform integer in [0, n-1]. n must be >= 1 (randn(1) always returns 0).
func randn(n: int) -> int:
	assert(n >= 1, "randn requires n >= 1, got %d" % n)
	return _rng.randi_range(0, n - 1)


func seed_with(v: int) -> void:
	_rng.seed = v


## Serializable stream position — stored in saves (ADR-0004, TR-END-06).
func get_state() -> int:
	return _rng.state


func restore_state(s: int) -> void:
	_rng.state = s
