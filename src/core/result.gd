## Uniform command result for all core APIs (ADR-0001).
## Commands either fully apply (ok=true) or fully reject (ok=false, error set).
class_name Result
extends RefCounted

var ok: bool = false
var error: StringName = &""
var data: Dictionary = {}


static func success(payload: Dictionary = {}) -> Result:
	var r := Result.new()
	r.ok = true
	r.data = payload
	return r


static func failure(err: StringName, payload: Dictionary = {}) -> Result:
	var r := Result.new()
	r.ok = false
	r.error = err
	r.data = payload
	return r
