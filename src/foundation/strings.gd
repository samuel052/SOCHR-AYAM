## Loads the Hebrew strings table (assets/strings/he.csv) into the
## TranslationServer at runtime, so node.tr(key) works without relying on the
## editor import pipeline (ADR-0006). Foundation layer — file IO allowed.
class_name Strings
extends RefCounted


static func install(csv_path: String = "res://assets/strings/he.csv") -> void:
	var file := FileAccess.open(csv_path, FileAccess.READ)
	if file == null:
		push_error("Strings: cannot open %s" % csv_path)
		return
	var header: PackedStringArray = file.get_csv_line()
	assert(header.size() >= 2 and header[0] == "keys", "bad strings CSV header")
	var translation := Translation.new()
	translation.locale = "he"
	while not file.eof_reached():
		var row: PackedStringArray = file.get_csv_line()
		if row.size() >= 2 and row[0] != "":
			translation.add_message(StringName(row[0]), row[1])
	TranslationServer.add_translation(translation)
	TranslationServer.set_locale("he")


## Convenience for non-Node callers (Nodes should use tr()).
static func t(key: StringName) -> String:
	return TranslationServer.translate(key)
