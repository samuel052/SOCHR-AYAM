# Persistence: save/load round-trip, corruption tolerance, hi-scores, settings.
# GDD: scoring-endgame (TR-END-02/04/06); ADR-0004.
class_name PersistenceTest
extends GdUnitTestSuite

var _dir: String


func before_test() -> void:
	# Isolated temp folder per test so runs never collide.
	_dir = "user://test_persist_%d/" % (Time.get_ticks_usec())


func after_test() -> void:
	var abs: String = ProjectSettings.globalize_path(_dir)
	if DirAccess.dir_exists_absolute(abs):
		for f in DirAccess.get_files_at(abs):
			DirAccess.remove_absolute(abs + "/" + f)
		DirAccess.remove_absolute(abs)


func test_save_then_load_round_trips_payload() -> void:
	# JSON stores numbers as floats; consumers coerce with int() (GameState.from_dict).
	# We assert semantic round-trip, not raw type equality.
	var p := Persistence.new(_dir)
	var payload: Dictionary = {"state": {"day": 3, "cash": 4200}, "rng_state": 99}
	assert_bool(p.save_game(payload).ok).is_true()
	var loaded: Result = p.load_game()
	assert_bool(loaded.ok).is_true()
	var got: Dictionary = loaded.data["payload"]
	assert_int(int(got["rng_state"])).is_equal(99)
	assert_int(int(got["state"]["day"])).is_equal(3)
	assert_int(int(got["state"]["cash"])).is_equal(4200)


func test_load_missing_save_reports_missing() -> void:
	var p := Persistence.new(_dir)
	var r: Result = p.load_game()
	assert_bool(r.ok).is_false()
	assert_str(String(r.error)).is_equal("save_missing")


func test_corrupt_save_reports_missing_not_crash() -> void:
	var p := Persistence.new(_dir)
	var f := FileAccess.open(_dir + "save.json", FileAccess.WRITE)
	f.store_string("{ this is not valid json ")
	f.close()
	var r: Result = p.load_game()
	assert_bool(r.ok).is_false()  # treated as absent, no crash


func test_newer_schema_version_rejected() -> void:
	var p := Persistence.new(_dir)
	var f := FileAccess.open(_dir + "save.json", FileAccess.WRITE)
	f.store_string(JSON.stringify({"schema_version": 999, "payload": {}}))
	f.close()
	var r: Result = p.load_game()
	assert_bool(r.ok).is_false()
	assert_str(String(r.error)).is_equal("save_newer_version")


func test_hiscores_round_trip() -> void:
	var p := Persistence.new(_dir)
	var rows: Array = [{"name": "דנה", "score": 9000, "date": "2026-07-08"}]
	assert_bool(p.store_hiscores(rows).ok).is_true()
	var got: Array = p.load_hiscores()
	assert_int(got.size()).is_equal(1)
	assert_str(String(got[0]["name"])).is_equal("דנה")
	assert_int(int(got[0]["score"])).is_equal(9000)  # JSON floatifies; consumers int()
	assert_str(String(got[0]["date"])).is_equal("2026-07-08")


func test_corrupt_hiscores_returns_empty() -> void:
	var p := Persistence.new(_dir)
	var f := FileAccess.open(_dir + "hiscores.json", FileAccess.WRITE)
	f.store_string("garbage")
	f.close()
	assert_array(p.load_hiscores()).is_empty()


func test_settings_round_trip() -> void:
	var p := Persistence.new(_dir)
	var s: Dictionary = {"fullscreen": true, "music": 0.5, "big_text": false}
	assert_bool(p.store_settings(s).ok).is_true()
	assert_that(p.load_settings()).is_equal(s)


func test_autosave_separate_from_manual() -> void:
	var p := Persistence.new(_dir)
	p.save_game({"tag": "manual"}, false)
	p.save_game({"tag": "auto"}, true)
	assert_str(String(p.load_game(false).data["payload"]["tag"])).is_equal("manual")
	assert_str(String(p.load_game(true).data["payload"]["tag"])).is_equal("auto")
