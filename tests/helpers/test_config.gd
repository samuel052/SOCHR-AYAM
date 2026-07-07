## Loads the real assets/data/*.json into a GameConfig for tests.
## File IO lives here (test layer) — core never touches FileAccess (ADR-0001).
class_name TestConfig
extends RefCounted


static func load_real() -> GameConfig:
	var sections: Dictionary = {}
	for name in GameConfig.REQUIRED_SECTIONS:
		var path: String = "res://assets/data/%s.json" % name
		var text: String = FileAccess.get_file_as_string(path)
		assert(text != "", "missing config file: %s" % path)
		var parsed: Variant = JSON.parse_string(text)
		assert(parsed is Dictionary, "invalid JSON in %s" % path)
		sections[name] = parsed
	return GameConfig.from_dicts(sections)


## A ready GameEngine on the real config with a seeded RNG.
static func engine(seed_value: int = 12345) -> GameEngine:
	return GameEngine.new(load_real(), RngService.new(seed_value))


## A GameEngine whose RNG is a FakeRng (returned alongside for scripting).
static func engine_with_fake() -> Array:
	var fake := FakeRng.new()
	var eng := GameEngine.new(load_real(), fake)
	return [eng, fake]
