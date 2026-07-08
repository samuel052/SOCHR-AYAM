## Reads assets/data/*.json from disk and builds a GameConfig (ADR-0003).
## File IO lives in the foundation layer; core never touches FileAccess (ADR-0001).
class_name ConfigLoader
extends RefCounted


static func load_default() -> GameConfig:
	return load_from("res://assets/data")


static func load_from(dir: String) -> GameConfig:
	var sections: Dictionary = {}
	for name in GameConfig.REQUIRED_SECTIONS:
		var path: String = "%s/%s.json" % [dir, name]
		var text: String = FileAccess.get_file_as_string(path)
		assert(text != "", "ConfigLoader: cannot read %s" % path)
		var parsed: Variant = JSON.parse_string(text)
		assert(parsed is Dictionary, "ConfigLoader: invalid JSON in %s" % path)
		sections[name] = parsed
	return GameConfig.from_dicts(sections)
