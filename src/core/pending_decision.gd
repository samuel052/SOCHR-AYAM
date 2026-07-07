## A parked player decision inside an engine resolution (ADR-0001).
## Plain serializable data: the UI renders `context`, answers via GameEngine.answer().
class_name PendingDecision
extends RefCounted

var id: int = 0
var kind: StringName = &""
var context: Dictionary = {}


static func make(decision_id: int, decision_kind: StringName, ctx: Dictionary) -> PendingDecision:
	var pd := PendingDecision.new()
	pd.id = decision_id
	pd.kind = decision_kind
	pd.context = ctx
	return pd


func to_dict() -> Dictionary:
	return {"id": id, "kind": String(kind), "context": context}


static func from_dict(d: Dictionary) -> PendingDecision:
	return make(int(d["id"]), StringName(String(d["kind"])), d["context"])
