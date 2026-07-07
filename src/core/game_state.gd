## The entire mutable game state — plain data, fully serializable (ADR-0001/0004).
## Engines mutate this; UI only ever sees read-only snapshots of it.
class_name GameState
extends RefCounted

var day: int = 1                      # 1..7 (1 = Sunday)
var clock: int = 8                    # hour of day, 8..20
var port: int = Types.Port.ISRAEL
var cash: int = 0
var bank: int = 0
var cargo: Array[int] = [0, 0, 0]     # tons per Types.Good
var capacity: int = 0                 # tons
var damage: int = 0                   # shekels; also the full repair cost
var prices: Array = []                # [port][good] -> int (3x3)
var storm_port: int = Types.NO_STORM  # today's storm port, or NO_STORM
var last_event_family: String = ""    # for the "not like yesterday" rule
var guards: int = 0                   # guard ships hired for the active voyage
var dock_closed_today: bool = false
var dock_rolled_today: bool = false
var dock_closed_yesterday: bool = false  # closed day => guaranteed open next day
var pending: Dictionary = {}          # parked PendingDecision + continuation ctx
var game_over: bool = false


func _init() -> void:
	prices = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]


func cargo_total() -> int:
	return cargo[0] + cargo[1] + cargo[2]


func price_of(at_port: int, good: int) -> int:
	return int(prices[at_port][good])


## Market value of all cargo at the given port's current prices.
func cargo_value(at_port: int) -> int:
	var total: int = 0
	for good in Types.GOODS_SCAN_ORDER:
		total += cargo[good] * price_of(at_port, good)
	return total


## Ship value = cargo at port prices + cash on hand. Bank excluded (תוכנית.txt).
func ship_value(at_port: int) -> int:
	return cargo_value(at_port) + cash


func to_dict() -> Dictionary:
	return {
		"day": day, "clock": clock, "port": port,
		"cash": cash, "bank": bank,
		"cargo": [cargo[0], cargo[1], cargo[2]],
		"capacity": capacity, "damage": damage,
		"prices": prices.duplicate(true),
		"storm_port": storm_port,
		"last_event_family": last_event_family,
		"guards": guards,
		"dock_closed_today": dock_closed_today,
		"dock_rolled_today": dock_rolled_today,
		"dock_closed_yesterday": dock_closed_yesterday,
		"pending": pending.duplicate(true),
		"game_over": game_over,
	}


static func from_dict(d: Dictionary) -> GameState:
	var s := GameState.new()
	s.day = int(d["day"])
	s.clock = int(d["clock"])
	s.port = int(d["port"])
	s.cash = int(d["cash"])
	s.bank = int(d["bank"])
	var c: Array = d["cargo"]
	s.cargo = [int(c[0]), int(c[1]), int(c[2])]
	s.capacity = int(d["capacity"])
	s.damage = int(d["damage"])
	s.prices = []
	for row in (d["prices"] as Array):
		var r: Array = []
		for v in (row as Array):
			r.append(int(v))
		s.prices.append(r)
	s.storm_port = int(d["storm_port"])
	s.last_event_family = String(d["last_event_family"])
	s.guards = int(d["guards"])
	s.dock_closed_today = bool(d["dock_closed_today"])
	s.dock_rolled_today = bool(d["dock_rolled_today"])
	s.dock_closed_yesterday = bool(d["dock_closed_yesterday"])
	s.pending = d["pending"]
	s.game_over = bool(d["game_over"])
	return s
