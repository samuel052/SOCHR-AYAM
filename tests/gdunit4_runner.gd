# GdUnit4 test entry point — invoked by CI and /smoke-check.
# Usage: godot --headless --script tests/gdunit4_runner.gd
# (CI uses MikeSchulze/gdUnit4-action, which installs the addon and runs the
# suites directly; this script is the local convenience wrapper.)
extends SceneTree


func _init() -> void:
	if not FileAccess.file_exists("res://addons/gdUnit4/bin/GdUnitCmdTool.gd"):
		push_error("GdUnit4 not found. Install via AssetLib into res://addons/gdUnit4/.")
		quit(1)
		return
	var args: PackedStringArray = [
		"--headless", "-s", "res://addons/gdUnit4/bin/GdUnitCmdTool.gd",
		"-a", "tests/unit", "-a", "tests/integration", "--continue",
	]
	var exit_code: int = OS.execute(OS.get_executable_path(), args)
	quit(exit_code)
