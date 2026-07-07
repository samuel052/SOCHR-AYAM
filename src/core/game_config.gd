## Typed, fail-fast access to the external JSON config (ADR-0003).
## Core never reads files (ADR-0001): the foundation layer (or tests) parses the
## JSON under assets/data/ and passes the section dictionaries to from_dicts().
## Missing keys are a hard failure naming the exact path — no silent defaults.
class_name GameConfig
extends RefCounted

## section name -> parsed JSON Dictionary (e.g. "economy" -> {...}).
var _sections: Dictionary = {}

const REQUIRED_SECTIONS: Array[String] = [
	"time", "economy", "events", "voyage", "pirates", "ship", "scoring",
]


static func from_dicts(sections: Dictionary) -> GameConfig:
	var cfg := GameConfig.new()
	for name in REQUIRED_SECTIONS:
		assert(sections.has(name), "GameConfig: missing section '%s'" % name)
		cfg._sections[name] = sections[name]
	return cfg


## Fetch a value by "section:dotted.path", e.g. geti("ship:sail_block_damage").
func value(path: String) -> Variant:
	var parts: PackedStringArray = path.split(":")
	assert(parts.size() == 2, "GameConfig path must be 'section:key.path', got '%s'" % path)
	assert(_sections.has(parts[0]), "GameConfig: unknown section '%s'" % parts[0])
	var node: Variant = _sections[parts[0]]
	for key in parts[1].split("."):
		assert(node is Dictionary and (node as Dictionary).has(key),
			"GameConfig: missing key '%s' in path '%s'" % [key, path])
		node = (node as Dictionary)[key]
	return node


func geti(path: String) -> int:
	return int(value(path))


func getf(path: String) -> float:
	return float(value(path))


func getb(path: String) -> bool:
	return bool(value(path))


func gets(path: String) -> String:
	return String(value(path))


func geta(path: String) -> Array:
	return value(path) as Array


func getd(path: String) -> Dictionary:
	return value(path) as Dictionary
