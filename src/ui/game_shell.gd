## Functional (placeholder-art) game shell that proves the full engine + facade
## are playable inside Godot end to end. Built entirely in code — no fragile
## .tscn authoring — and driven only through the GameFacade autoload (ADR-0001).
## The designed pixel-art screens (design/ux/*) will replace this later.
extends Control

const G := Types.Good
const P := Types.Port

var _hud: RichTextLabel
var _prices: RichTextLabel
var _log: RichTextLabel
var _actions: VBoxContainer
var _modal: PanelContainer


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_build_layout()
	GameFacade.state_changed.connect(_on_state_changed)
	GameFacade.day_started.connect(_on_day_started)
	GameFacade.decision_required.connect(_on_decision_required)
	GameFacade.voyage_resolved.connect(_on_voyage_resolved)
	GameFacade.game_ended.connect(_on_game_ended)
	_show_title()


# --- layout ---

func _build_layout() -> void:
	var root := VBoxContainer.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_theme_constant_override("separation", 6)
	add_child(root)

	_hud = _make_label(root)
	_prices = _make_label(root)

	var mid := HBoxContainer.new()
	mid.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(mid)

	_log = RichTextLabel.new()
	_log.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_log.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_log.scroll_following = true
	_log.bbcode_enabled = true
	mid.add_child(_log)

	_actions = VBoxContainer.new()
	_actions.custom_minimum_size = Vector2(220, 0)
	mid.add_child(_actions)


func _make_label(parent: Node) -> RichTextLabel:
	var l := RichTextLabel.new()
	l.bbcode_enabled = true
	l.fit_content = true
	l.custom_minimum_size = Vector2(0, 40)
	parent.add_child(l)
	return l


# --- title / menus ---

func _show_title() -> void:
	_log.text = "[b]%s[/b]\n\n" % tr(&"GAME_TITLE")
	_clear_actions()
	_add_action(tr(&"BTN_NEW_GAME"), func(): GameFacade.new_game())
	if GameFacade.has_save():
		_add_action(tr(&"BTN_CONTINUE"), func():
			if GameFacade.load_game(false).ok or GameFacade.load_game(true).ok:
				_refresh())


func _rebuild_hub_actions() -> void:
	_clear_actions()
	if GameFacade.has_active_decision():
		return  # decision modal is showing; hub actions hidden
	var snap: Dictionary = GameFacade.snapshot()
	if bool(snap.get("game_over", false)):
		return
	_add_action(tr(&"HUB_BUY"), _open_buy)
	_add_action(tr(&"HUB_SELL"), _open_sell)
	_add_action(tr(&"HUB_SAIL"), _open_sail)
	_add_action(tr(&"HUB_BANK"), _open_bank)
	_add_action(tr(&"HUB_REST"), func(): GameFacade.rest())
	if int(snap.get("damage", 0)) > 0:
		_add_action(tr(&"HUB_REPAIR"), _open_repair)
	_add_action(tr(&"BTN_SAVE"), func():
		var r := GameFacade.save_game()
		_append(tr(&"BTN_SAVED") if r.ok else tr(&"ERR_GENERIC")))


# --- action forms (inline modals) ---

func _open_buy() -> void:
	_good_qty_form(tr(&"MARKET_BUY_TITLE"), func(good, qty):
		_report(GameFacade.buy(good, qty)))


func _open_sell() -> void:
	_good_qty_form(tr(&"MARKET_SELL_TITLE"), func(good, qty):
		_report(GameFacade.sell(good, qty)))


func _open_bank() -> void:
	_amount_form(tr(&"BANK_DEPOSIT"), func(a): _report(GameFacade.deposit(a)))
	# a second button for withdraw is added inside _amount_form via extra


func _open_repair() -> void:
	_amount_form(tr(&"REPAIR_TITLE"), func(a): _report(GameFacade.repair(a)))


func _open_sail() -> void:
	_close_modal()
	var box := _modal_box(tr(&"VOYAGE_TITLE"))
	var snap: Dictionary = GameFacade.snapshot()
	var here: int = int(snap["port"])
	for dest in [P.ISRAEL, P.TURKEY, P.EGYPT]:
		if dest == here:
			continue
		var plan: Result = GameFacade.plan_voyage(dest)
		var d: int = dest
		if not plan.ok:
			box.add_child(_dim_label(_port_name(d) + " — " + tr(&"VOYAGE_TOO_LATE")))
			continue
		var hours: int = int(plan.data["hours"])
		var arr: int = int(plan.data["arrival"])
		var gp: int = int(plan.data["guard_price"])
		var label := tr(&"VOYAGE_OPTION") % [_port_name(d), hours, arr]
		var guards_spin := SpinBox.new()
		guards_spin.min_value = 0
		guards_spin.max_value = 9
		var row := HBoxContainer.new()
		row.add_child(_text(label + "  (" + (tr(&"VOYAGE_GUARDS_PRICE") % _money(gp)) + ")"))
		row.add_child(guards_spin)
		var go := Button.new()
		go.text = tr(&"VOYAGE_SAIL")
		go.pressed.connect(func():
			_close_modal()
			GameFacade.sail(d, int(guards_spin.value)))
		row.add_child(go)
		box.add_child(row)
	_add_cancel(box)


func _good_qty_form(title: String, cb: Callable) -> void:
	_close_modal()
	var box := _modal_box(title)
	var good_pick := OptionButton.new()
	good_pick.add_item(tr(&"GOOD_COPPER"), G.COPPER)
	good_pick.add_item(tr(&"GOOD_OLIVES"), G.OLIVES)
	good_pick.add_item(tr(&"GOOD_WHEAT"), G.WHEAT)
	var qty := SpinBox.new()
	qty.min_value = 1
	qty.max_value = 9999
	box.add_child(good_pick)
	box.add_child(qty)
	var confirm := Button.new()
	confirm.text = tr(&"BTN_EXECUTE")
	confirm.pressed.connect(func():
		cb.call(good_pick.get_selected_id(), int(qty.value))
		_close_modal())
	box.add_child(confirm)
	_add_cancel(box)


func _amount_form(title: String, cb: Callable) -> void:
	_close_modal()
	var box := _modal_box(title)
	var amount := SpinBox.new()
	amount.min_value = 1
	amount.max_value = 999999
	box.add_child(amount)
	if title == tr(&"BANK_DEPOSIT"):
		var withdraw := Button.new()
		withdraw.text = tr(&"BANK_WITHDRAW")
		withdraw.pressed.connect(func():
			_report(GameFacade.withdraw(int(amount.value)))
			_close_modal())
		box.add_child(withdraw)
	var confirm := Button.new()
	confirm.text = tr(&"BTN_EXECUTE")
	confirm.pressed.connect(func():
		cb.call(int(amount.value))
		_close_modal())
	box.add_child(confirm)
	_add_cancel(box)


# --- decisions ---

func _on_decision_required(decision: Dictionary) -> void:
	_close_modal()
	var kind: String = String(decision["kind"])
	var id: int = int(decision["id"])
	var ctx: Dictionary = decision["context"]
	match kind:
		"expand_offer", "merchant_buy", "merchant_sell":
			_accept_decline(id, _describe_offer(kind, ctx))
		"crew_strike":
			_crew_dialog(id)
		"pirate_choice":
			_pirate_dialog(id, ctx)


func _accept_decline(id: int, text: String) -> void:
	var box := _modal_box(text)
	var accept := Button.new()
	accept.text = tr(&"BTN_ACCEPT")
	accept.pressed.connect(func(): GameFacade.answer(id, {"accepted": true}))
	var decline := Button.new()
	decline.text = tr(&"BTN_DECLINE")
	decline.pressed.connect(func(): GameFacade.answer(id, {"accepted": false}))
	box.add_child(accept)
	box.add_child(decline)


func _crew_dialog(id: int) -> void:
	var box := _modal_box(tr(&"EV_CREW_STRIKE") + "\n" + tr(&"EV_CREW_EXPLAIN"))
	var give_up := Button.new()
	give_up.text = tr(&"EV_CREW_GIVE_UP")
	give_up.pressed.connect(func(): GameFacade.answer(id, {"negotiate": false}))
	box.add_child(give_up)
	var negotiate := Button.new()
	negotiate.text = tr(&"EV_CREW_NEGOTIATE")
	negotiate.pressed.connect(func(): _crew_offer(id))
	box.add_child(negotiate)


func _crew_offer(id: int) -> void:
	_close_modal()
	var box := _modal_box(tr(&"EV_CREW_OFFER_TITLE"))
	var cash := _labeled_spin(box, tr(&"HUB_BANK"), 0, 999999)
	var cu := _labeled_spin(box, tr(&"GOOD_COPPER"), 0, 9999)
	var ol := _labeled_spin(box, tr(&"GOOD_OLIVES"), 0, 9999)
	var wh := _labeled_spin(box, tr(&"GOOD_WHEAT"), 0, 9999)
	var offer := Button.new()
	offer.text = tr(&"BTN_ACCEPT")
	offer.pressed.connect(func():
		var r := GameFacade.answer(id, {"negotiate": true, "offer": {
			"cash": int(cash.value), "copper": int(cu.value),
			"olives": int(ol.value), "wheat": int(wh.value)}})
		if not r.ok:
			_append("[color=red]" + tr(&"ERR_OFFER_TOO_MUCH") + "[/color]"))
	box.add_child(offer)


func _pirate_dialog(id: int, ctx: Dictionary) -> void:
	var box := _modal_box(tr(&"PIRATES_WHAT_DO"))
	var fight := Button.new()
	fight.text = tr(&"PIRATES_FIGHT")
	fight.pressed.connect(func(): GameFacade.answer(id, {"action": "fight"}))
	var flee := Button.new()
	flee.text = tr(&"PIRATES_FLEE")
	flee.pressed.connect(func(): GameFacade.answer(id, {"action": "flee"}))
	var comp := Button.new()
	comp.text = tr(&"PIRATES_COMPROMISE")
	comp.pressed.connect(func(): _pirate_offer(id, bool(ctx.get("cash_offer_allowed", true))))
	box.add_child(fight)
	box.add_child(flee)
	box.add_child(comp)


func _pirate_offer(id: int, cash_allowed: bool) -> void:
	_close_modal()
	var box := _modal_box(tr(&"PIRATES_OFFER_TITLE"))
	var cash := _labeled_spin(box, tr(&"HUB_BANK"), 0, 999999)
	if not cash_allowed:
		cash.editable = false
		box.add_child(_dim_label(tr(&"PIRATES_CASH_LOCKED")))
	var cu := _labeled_spin(box, tr(&"GOOD_COPPER"), 0, 9999)
	var ol := _labeled_spin(box, tr(&"GOOD_OLIVES"), 0, 9999)
	var wh := _labeled_spin(box, tr(&"GOOD_WHEAT"), 0, 9999)
	var offer := Button.new()
	offer.text = tr(&"BTN_ACCEPT")
	offer.pressed.connect(func():
		var r := GameFacade.answer(id, {"action": "compromise", "offer": {
			"cash": int(cash.value), "copper": int(cu.value),
			"olives": int(ol.value), "wheat": int(wh.value)}})
		if not r.ok:
			_append("[color=red]" + tr(&"ERR_OFFER_TOO_MUCH") + "[/color]"))
	box.add_child(offer)


# --- signal handlers ---

func _on_state_changed(_snap: Dictionary) -> void:
	_refresh()


func _on_day_started(a: Dictionary) -> void:
	_append("\n[b]— %s —[/b]" % _day_name(int(a["day"])))
	var storm: int = int(a.get("storm_port", Types.NO_STORM))
	_append(tr(&"HUD_WEATHER_GOOD") if storm == Types.NO_STORM
		else tr(&"HUD_WEATHER_STORM") % _port_name(storm))
	if a.has("morning_event"):
		_append(_describe_morning(a["morning_event"]))
	if not GameFacade.has_active_decision():
		_rebuild_hub_actions()


func _on_voyage_resolved(result: Dictionary) -> void:
	_append(_describe_voyage(result))
	_rebuild_hub_actions()


func _on_game_ended(summary: Dictionary) -> void:
	_close_modal()
	var title: String = tr(&"END_TITLE_DONE") if String(summary.get("reason", "")) == "completed" \
		else tr(&"END_TITLE_STUCK")
	_append("\n[b]%s[/b]  %s" % [title, tr(&"END_SCORE") % _money(int(summary["score"]))])
	_clear_actions()
	if GameFacade.qualifies_for_hiscore():
		_add_action(tr(&"HISCORES_ENTER_NAME"), func():
			GameFacade.submit_hiscore(tr(&"HISCORES_DEFAULT_NAME"))
			_show_hiscores())
	else:
		_show_hiscores()
	_add_action(tr(&"BTN_NEW_GAME"), func(): GameFacade.new_game())


func _show_hiscores() -> void:
	_append("\n[b]%s[/b]" % tr(&"HISCORES_TITLE"))
	var rows: Array = GameFacade.hiscores()
	if rows.is_empty():
		_append(tr(&"HISCORES_EMPTY"))
	for i in rows.size():
		var r: Dictionary = rows[i]
		_append("%d. %s — %s" % [i + 1, String(r["name"]), _money(int(r["score"]))])


# --- rendering helpers ---

func _refresh() -> void:
	var s: Dictionary = GameFacade.snapshot()
	var ship: String
	var dmg: int = int(s["damage"])
	if dmg <= 0:
		ship = tr(&"HUD_SHIP_OK")
	elif dmg > 1000:
		ship = tr(&"HUD_SHIP_BLOCKED") % _money(dmg)
	else:
		ship = tr(&"HUD_SHIP_DAMAGED") % _money(dmg)
	_hud.text = "%s | %s %02d:00 | %s | %s | %s | %s" % [
		_port_name(int(s["port"])), _day_name(int(s["day"])), int(s["clock"]),
		ship, tr(&"HUD_CARGO") % [int(s["cargo_total"]), int(s["capacity"])],
		tr(&"HUD_CASH") % _money(int(s["cash"])), tr(&"HUD_BANK") % _money(int(s["bank"]))]
	_prices.text = _price_board(s)
	if not GameFacade.has_active_decision() and not bool(s.get("game_over", false)):
		_rebuild_hub_actions()


func _price_board(s: Dictionary) -> String:
	var prices: Array = s["prices"]
	var out: String = ""
	for port in [P.ISRAEL, P.TURKEY, P.EGYPT]:
		out += "[b]%s[/b] " % _port_name(port)
		for good in [G.COPPER, G.OLIVES, G.WHEAT]:
			out += "%s:%d  " % [_good_name(good), int(prices[port][good])]
		out += " | "
	return out


func _describe_offer(kind: String, ctx: Dictionary) -> String:
	match kind:
		"expand_offer":
			var pay: Dictionary = ctx["payment"]
			var pay_text: String
			if pay.has("cash") and pay.has("good"):
				pay_text = tr(&"EV_EXPAND_PAY_MIXED") % [int(pay["qty"]), _good_name(int(pay["good"])), _money(int(pay["cash"]))]
			elif pay.has("good"):
				pay_text = tr(&"EV_EXPAND_PAY_GOODS") % [int(pay["qty"]), _good_name(int(pay["good"]))]
			else:
				pay_text = tr(&"EV_EXPAND_PAY_CASH") % _money(int(pay["cash"]))
			return (tr(&"EV_EXPAND_OFFER") % int(ctx["delta"])) + "\n" + pay_text
		"merchant_buy":
			return tr(&"EV_MERCHANT_BUY") % [_good_name(int(ctx["good"])), int(ctx["qty"]),
				_money(int(ctx["unit_price"])), _money(int(ctx["total"]))]
		"merchant_sell":
			return tr(&"EV_MERCHANT_SELL") % [int(ctx["qty"]), _good_name(int(ctx["good"])),
				_money(int(ctx["unit_price"])), _money(int(ctx["total"]))]
	return ""


func _describe_morning(ev: Dictionary) -> String:
	match String(ev.get("event", "")):
		"price":
			var key := &"EV_PRICE_UP" if String(ev["dir"]) == "up" else &"EV_PRICE_DOWN"
			return tr(key) % [_good_name(int(ev["good"])), _port_name(int(ev["port"])), _money(int(ev["price"]))]
		"thieves":
			if String(ev["variant"]) == "money":
				return tr(&"EV_THIEVES_MONEY") % _money(int(ev["stolen"]))
			return tr(&"EV_THIEVES_GOODS") % [int(ev["qty"]), _good_name(int(ev["good"]))]
		"fishing":
			return tr(&"EV_FISHING") % _money(int(ev["damage"]))
	return ""


func _describe_voyage(r: Dictionary) -> String:
	match String(r.get("event", "none")):
		"none": return tr(&"VOYAGE_ARRIVED_SAFE")
		"storm":
			if String(r.get("variant", "")) == "cargo":
				return tr(&"VOYAGE_EV_STORM_CARGO") % [int(r["loss"]), _good_name(int(r["good"]))]
			return tr(&"VOYAGE_EV_STORM_SHIP") % _money(int(r["damage"]))
		"shoal": return tr(&"VOYAGE_EV_SHOAL") % _money(int(r["damage"]))
		"worsening_damage": return tr(&"VOYAGE_EV_WORSE") % _money(int(r["damage"]))
		"overload": return tr(&"VOYAGE_EV_OVERLOAD") % [int(r["thrown"]), _good_name(int(r["good"]))]
		"port_blocked":
			return tr(&"VOYAGE_EV_FOG") if String(r["reason"]) == "fog" else tr(&"VOYAGE_EV_STRIKE")
		"winds":
			return tr(&"VOYAGE_EV_WINDS") % [_port_name(int(r["new_dest"])), _port_name(int(r["original_dest"]))]
		"deserted": return tr(&"VOYAGE_EV_DESERTED") % [int(r["qty"]), _good_name(int(r["good"]))]
		"pirates": return _describe_pirates(r)
	return ""


func _describe_pirates(r: Dictionary) -> String:
	var out: String = ""
	if r.has("flee_failed"):
		match String(r["flee_failed"]):
			"heavy": out += tr(&"PIRATES_FLEE_HEAVY") + " "
			"damaged": out += tr(&"PIRATES_FLEE_DAMAGED") + " "
			"outrun": out += tr(&"PIRATES_FLEE_OUTRUN") + " "
	match String(r["outcome"]):
		"won":
			out += (tr(&"PIRATES_WON_CAPTURE") % int(r.get("capacity_bonus", 50))) if r.has("captured_ship") \
				else (tr(&"PIRATES_WON_LOOT") % _money(int(r.get("loot", 0))))
			if r.has("damage"):
				out += " " + tr(&"PIRATES_BATTLE_DAMAGE") % _money(int(r["damage"]))
		"lost":
			out += tr(&"PIRATES_LOST") % [_money(int(r["stolen"])), _money(int(r["damage"]))]
		"fled": out += tr(&"PIRATES_FLED")
		"compromise_accepted": out += tr(&"PIRATES_COMPROMISE_OK")
	return out


func _report(r: Result) -> void:
	if not r.ok:
		_append("[color=red]%s[/color]" % _error_text(r.error))


func _error_text(err: StringName) -> String:
	match err:
		&"not_enough_cash", &"not_enough_cash_for_guards": return tr(&"ERR_NOT_ENOUGH_CASH")
		&"not_enough_cargo": return tr(&"ERR_NOT_ENOUGH_CARGO")
		_: return tr(&"ERR_GENERIC")


# --- small ui utilities ---

func _add_action(text: String, cb: Callable) -> void:
	var b := Button.new()
	b.text = text
	b.pressed.connect(cb)
	_actions.add_child(b)


func _clear_actions() -> void:
	for c in _actions.get_children():
		c.queue_free()


func _modal_box(title: String) -> VBoxContainer:
	_close_modal()
	_modal = PanelContainer.new()
	_modal.set_anchors_preset(Control.PRESET_CENTER)
	var vb := VBoxContainer.new()
	_modal.add_child(vb)
	vb.add_child(_text(title))
	add_child(_modal)
	return vb


func _close_modal() -> void:
	if is_instance_valid(_modal):
		_modal.queue_free()
	_modal = null


func _add_cancel(box: VBoxContainer) -> void:
	var c := Button.new()
	c.text = tr(&"BTN_CANCEL")
	c.pressed.connect(_close_modal)
	box.add_child(c)


func _labeled_spin(box: VBoxContainer, label: String, lo: int, hi: int) -> SpinBox:
	var row := HBoxContainer.new()
	row.add_child(_text(label))
	var s := SpinBox.new()
	s.min_value = lo
	s.max_value = hi
	row.add_child(s)
	box.add_child(row)
	return s


func _text(t: String) -> Label:
	var l := Label.new()
	l.text = t
	return l


func _dim_label(t: String) -> Label:
	var l := _text(t)
	l.modulate = Color(1, 1, 1, 0.5)
	return l


func _append(line: String) -> void:
	_log.append_text("\n" + line)


# --- name/format helpers ---

func _port_name(port: int) -> String:
	return [tr(&"PORT_ISRAEL"), tr(&"PORT_TURKEY"), tr(&"PORT_EGYPT")][port]


func _good_name(good: int) -> String:
	return [tr(&"GOOD_COPPER"), tr(&"GOOD_OLIVES"), tr(&"GOOD_WHEAT")][good]


func _day_name(day: int) -> String:
	return tr(StringName("HUD_DAY_%d" % day))


func _money(amount: int) -> String:
	var s: String = str(absi(amount))
	var out: String = ""
	var count: int = 0
	for i in range(s.length() - 1, -1, -1):
		out = s[i] + out
		count += 1
		if count % 3 == 0 and i > 0:
			out = "," + out
	if amount < 0:
		out = "-" + out
	return out + " " + tr(&"SHEKEL")
