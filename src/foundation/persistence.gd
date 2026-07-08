## Durable storage for saves, autosave, hi-scores and settings (ADR-0004).
## JSON under user://, atomic writes (tmp + rename), corruption-tolerant reads.
## Foundation layer — FileAccess allowed here, never in core (ADR-0001).
class_name Persistence
extends RefCounted

const SCHEMA_VERSION := 1

const SAVE_PATH := "user://save.json"
const AUTOSAVE_PATH := "user://autosave.json"
const HISCORES_PATH := "user://hiscores.json"
const SETTINGS_PATH := "user://settings.json"

# Allow tests to redirect user:// to an isolated subfolder.
var _base: String = "user://"


func _init(base_dir: String = "user://") -> void:
	_base = base_dir
	if not DirAccess.dir_exists_absolute(ProjectSettings.globalize_path(_base)):
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(_base))


func _path(name: String) -> String:
	return _base + name


## Atomic text write: write *.tmp, verify the store_* bool (4.4 semantics),
## then rename over the target so a crash never leaves a half-written file.
func _write_json(path: String, data: Dictionary) -> Result:
	var tmp: String = path + ".tmp"
	var file := FileAccess.open(tmp, FileAccess.WRITE)
	if file == null:
		return Result.failure(&"write_open_failed", {"path": tmp})
	var ok: bool = file.store_string(JSON.stringify(data, "\t"))
	file.close()
	if not ok:
		return Result.failure(&"write_failed", {"path": tmp})
	var err: int = DirAccess.rename_absolute(
		ProjectSettings.globalize_path(tmp), ProjectSettings.globalize_path(path))
	if err != OK:
		return Result.failure(&"rename_failed", {"err": err})
	return Result.success()


## Returns parsed dict, or {} on any failure (missing / corrupt).
func _read_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var text: String = FileAccess.get_file_as_string(path)
	if text == "":
		return {}
	var parsed: Variant = JSON.parse_string(text)
	if parsed is Dictionary:
		return parsed
	return {}


# --- game saves ---

func save_game(engine_payload: Dictionary, autosave: bool = false) -> Result:
	var wrapped: Dictionary = {
		"schema_version": SCHEMA_VERSION,
		"timestamp": Time.get_unix_time_from_system(),
		"payload": engine_payload,
	}
	return _write_json(_path("autosave.json" if autosave else "save.json"), wrapped)


## Returns {ok, payload} or {ok:false, error}. Rejects newer schema versions.
func load_game(autosave: bool = false) -> Result:
	var wrapped: Dictionary = _read_json(_path("autosave.json" if autosave else "save.json"))
	if wrapped.is_empty():
		return Result.failure(&"save_missing")
	if int(wrapped.get("schema_version", 0)) > SCHEMA_VERSION:
		return Result.failure(&"save_newer_version")
	if not wrapped.has("payload"):
		return Result.failure(&"save_corrupt")
	return Result.success({"payload": wrapped["payload"]})


func has_save(autosave: bool = false) -> bool:
	return FileAccess.file_exists(_path("autosave.json" if autosave else "save.json"))


# --- hi-scores ---

## Returns the stored rows, or [] on any failure (rebuild-empty policy, TR-END-04).
func load_hiscores() -> Array:
	var data: Dictionary = _read_json(_path("hiscores.json"))
	var rows: Variant = data.get("rows", [])
	if rows is Array:
		return rows
	return []


func store_hiscores(rows: Array) -> Result:
	return _write_json(_path("hiscores.json"), {"rows": rows})


# --- settings ---

func load_settings() -> Dictionary:
	return _read_json(_path("settings.json"))


func store_settings(settings: Dictionary) -> Result:
	return _write_json(_path("settings.json"), settings)
