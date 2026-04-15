from __future__ import annotations

import math
import random
import threading
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from heapq import heappop, heappush
from typing import Dict, List, Tuple


GridPoint = Tuple[int, int]


@dataclass
class ZoneSnapshot:
    zone_id: str
    row: int
    col: int
    density_level: str
    density_score: int
    timestamp: str


class CrowdSimulator:
    def __init__(self, rows: int = 5, cols: int = 5) -> None:
        self.rows = rows
        self.cols = cols
        self._lock = threading.RLock()
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._tick = 0
        self._density: Dict[str, int] = {}
        self._timestamp = self._now()
        self._scenario = "normal"
        self._seed_state()

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1)

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "generated_at": self._timestamp,
                "zones": [self._zone_payload(zone_id, density) for zone_id, density in self._density.items()],
                "queues": list(self._queue_state.values()),
                "high_density_zones": self._high_density_zone_count(),
            }

    def heatmap(self) -> list[dict]:
        with self._lock:
            return [self._zone_payload(zone_id, density) for zone_id, density in sorted(self._density.items())]

    def queue_time(self, stall_id: str) -> dict:
        with self._lock:
            queue = self._queue_state.get(stall_id)
            if queue is None:
                queue = self._queue_for_stall(stall_id)
                self._queue_state[stall_id] = queue
            return queue

    def route(self, start: str, end: str) -> dict:
        with self._lock:
            start_point = self._resolve_point(start)
            end_point = self._resolve_point(end)
            path = self._dijkstra(start_point, end_point)
            route_points = [self._point_to_zone(point) for point in path]
            total_risk = sum(self._density[zone_id] for zone_id in route_points)
            return {
                "start": start,
                "end": end,
                "path": route_points,
                "steps": len(route_points),
                "estimated_minutes": max(2, int(round(len(route_points) * 0.75 + total_risk / 250))),
                "avoidance_score": round(max(0.0, 100 - total_risk / max(1, len(route_points))), 2),
            }

    def alerts(self) -> list[dict]:
        with self._lock:
            alerts: list[dict] = []
            hot_zones = sorted(
                (self._zone_payload(zone_id, density) for zone_id, density in self._density.items()),
                key=lambda zone: zone["density_score"],
                reverse=True,
            )
            for zone in hot_zones[:3]:
                if zone["density_score"] >= 72:
                    alerts.append(
                        {
                            "type": "crowd-warning",
                            "title": f"{zone['zone_id']} is congested",
                            "message": "Redirect attendees away from this area.",
                            "severity": "high" if zone["density_score"] >= 85 else "medium",
                        }
                    )
            if self._queue_state:
                longest_queue = max(self._queue_state.values(), key=lambda item: item["wait_time_minutes"])
                if longest_queue["wait_time_minutes"] >= 9:
                    alerts.append(
                        {
                            "type": "queue-warning",
                            "title": f"{longest_queue['stall_id']} is experiencing a long wait",
                            "message": "Suggest nearby alternatives with shorter queues.",
                            "severity": "medium",
                        }
                    )
            if not alerts:
                alerts.append(
                    {
                        "type": "status",
                        "title": "Crowd flow is stable",
                        "message": "No immediate intervention required.",
                        "severity": "low",
                    }
                )
            return alerts

    def venue_map(self, phase: str) -> dict:
        with self._lock:
            return {
                "phase": self._normalize_phase(phase),
                "generated_at": self._timestamp,
                "gates": [self._node_payload(node) for node in self._venue_catalog("gate")],
                "parking": [self._node_payload(node) for node in self._venue_catalog("parking")],
                "exits": [self._node_payload(node) for node in self._venue_catalog("exit")],
                "concourse": [self._node_payload(node) for node in self._venue_catalog("concourse")],
                "notes": self._phase_notes(phase),
            }

    def journey(self, phase: str, origin: str, destination: str) -> dict:
        with self._lock:
            normalized_phase = self._normalize_phase(phase)
            normalized_origin = origin.strip().lower()
            normalized_destination = destination.strip().lower()
            start_point = self._resolve_point(normalized_origin)
            end_point = self._resolve_point(normalized_destination, phase=normalized_phase)
            route = self.route(origin, destination)
            anchor_nodes = self._venue_catalog("gate") if normalized_phase in {"arrival", "halftime"} else self._venue_catalog("exit")
            ranked_anchors = sorted((self._node_payload(node) for node in anchor_nodes), key=lambda node: node["density_score"])
            recommended_anchor = ranked_anchors[0] if ranked_anchors else None
            alternate_anchor = ranked_anchors[1] if len(ranked_anchors) > 1 else None
            anchor_point = (
                (recommended_anchor["row"], recommended_anchor["col"]) if recommended_anchor and normalized_phase == "departure" else end_point
            )
            queue_zone = self._point_to_zone(anchor_point)
            queue_time = self._queue_time_for_zone(queue_zone)

            advice = self._journey_advice(normalized_phase, normalized_origin, normalized_destination)

            return {
                "phase": normalized_phase,
                "origin": normalized_origin,
                "destination": normalized_destination,
                "start_point": {"row": start_point[0], "col": start_point[1]},
                "end_point": {"row": end_point[0], "col": end_point[1]},
                "recommended_anchor": recommended_anchor["node_id"] if recommended_anchor else None,
                "alternate_anchor": alternate_anchor["node_id"] if alternate_anchor else None,
                "queue_zone": queue_zone,
                "queue_wait_minutes": queue_time,
                "route": route,
                "advice": advice,
            }

    def staff_actions(self, phase: str) -> dict:
        with self._lock:
            normalized_phase = self._normalize_phase(phase)
            hottest_zones = sorted(self._density.items(), key=lambda item: item[1], reverse=True)[:4]
            queue_items = sorted(self._queue_state.values(), key=lambda item: item["wait_time_minutes"], reverse=True)
            actions: list[dict] = []

            for zone_id, density in hottest_zones:
                if density >= 78:
                    actions.append(
                        {
                            "priority": "high",
                            "area": zone_id,
                            "instruction": f"Deploy stewards to {zone_id} and divert foot traffic.",
                            "rationale": f"Density is {density}, which is above the intervention threshold.",
                        }
                    )

            if queue_items:
                highest_queue = queue_items[0]
                if highest_queue["wait_time_minutes"] >= 8:
                    actions.append(
                        {
                            "priority": "medium",
                            "area": highest_queue["stall_id"],
                            "instruction": f"Open a secondary service point for {highest_queue['stall_id']}.",
                            "rationale": f"Projected wait is {highest_queue['wait_time_minutes']} minutes.",
                        }
                    )

            phase_action_map = {
                "arrival": "Hold one extra gate open and push arrival guidance to attendees.",
                "in-venue": "Refresh concourse signage and keep route suggestions live.",
                "halftime": "Increase food and restroom staffing before the break window.",
                "departure": "Stagger exit lanes and post transport recommendations.",
            }
            actions.append(
                {
                    "priority": "medium",
                    "area": normalized_phase,
                    "instruction": phase_action_map.get(normalized_phase, "Monitor venue conditions and keep guidance live."),
                    "rationale": "Phase-specific control helps prevent predictable congestion spikes.",
                }
            )

            return {
                "phase": normalized_phase,
                "generated_at": self._timestamp,
                "actions": actions,
            }

    def resilience_status(self) -> dict:
        with self._lock:
            signal_score = 92 if self._tick % 6 not in {4, 5} else 74
            if self._scenario == "emergency-mode":
                signal_score = 68
            elif self._scenario == "optimize-crowd":
                signal_score = 96
            cache_window_minutes = 15
            fallback_mode = "cached venue map and last-known routes"
            if self._scenario == "emergency-mode":
                fallback_mode = "emergency broadcast and cached evacuation paths"
            return {
                "generated_at": self._timestamp,
                "offline_ready": True,
                "signal_quality": "strong" if signal_score >= 85 else "degraded",
                "signal_score": signal_score,
                "cache_window_minutes": cache_window_minutes,
                "fallback_mode": fallback_mode,
                "last_sync": self._timestamp,
            }

    def organizer_summary(self) -> dict:
        with self._lock:
            zones = sorted(self._density.items(), key=lambda item: item[1], reverse=True)
            queue_items = sorted(self._queue_state.values(), key=lambda item: item["wait_time_minutes"], reverse=True)
            top_zone_ids = [zone_id for zone_id, _ in zones[:3]]
            top_queue_ids = [item["stall_id"] for item in queue_items[:2]]
            interventions = []

            for zone_id, density in zones[:3]:
                if density >= 72:
                    interventions.append(
                        {
                            "type": "reroute",
                            "target": zone_id,
                            "message": f"Redirect traffic away from {zone_id}; density is at {density}.",
                        }
                    )

            for queue in queue_items[:2]:
                if queue["wait_time_minutes"] >= 8:
                    interventions.append(
                        {
                            "type": "queue-shift",
                            "target": queue["stall_id"],
                            "message": f"Promote alternative {queue['alternative']} for {queue['stall_id']}.",
                        }
                    )

            if not interventions:
                interventions.append(
                    {
                        "type": "status",
                        "target": "operations",
                        "message": "No interventions required right now; monitor the highest-density zones.",
                    }
                )

            return {
                "generated_at": self._timestamp,
                "avg_density": round(sum(self._density.values()) / max(1, len(self._density)), 1),
                "highest_density_zones": top_zone_ids,
                "longest_queues": top_queue_ids,
                "interventions": interventions,
                "high_density_zone_count": self._high_density_zone_count(),
            }

    def demo_control(self, action: str) -> dict:
        with self._lock:
            normalized_action = self._normalize_demo_action(action)
            before = self._scenario_metrics()
            self._scenario = normalized_action
            self._apply_demo_action(normalized_action)
            self._timestamp = self._now()
            self._queue_state = self._build_queue_state()
            after = self._scenario_metrics()
            return {
                "mode": normalized_action,
                "generated_at": self._timestamp,
                "title": self._demo_title(normalized_action),
                "message": self._demo_message(normalized_action),
                "affected_zones": self._demo_targets(normalized_action),
                "before": before,
                "after": after,
                "alerts": self.alerts(),
                "journey": self.journey("in-venue", "concourse-a", "seat-block"),
            }

    def _loop(self) -> None:
        while not self._stop_event.wait(1.5):
            self._advance_state()

    def _seed_state(self) -> None:
        for row in range(self.rows):
            for col in range(self.cols):
                zone_id = self._zone_id(row, col)
                self._density[zone_id] = random.randint(18, 72)
        self._queue_state = self._build_queue_state()

    def _advance_state(self) -> None:
        with self._lock:
            self._tick += 1
            for zone_id, current_density in list(self._density.items()):
                row, col = self._parse_zone(zone_id)
                wave = math.sin((self._tick + row * 1.7 + col * 0.9) / 2.8)
                drift = int(round(wave * 6 + random.randint(-4, 4)))
                self._density[zone_id] = self._clamp(current_density + drift, 6, 96)
            self._timestamp = self._now()
            self._queue_state = self._build_queue_state()

    def _build_queue_state(self) -> dict[str, dict]:
        stalls = ["stall-1", "stall-2", "stall-3", "restroom-1", "restroom-2"]
        queue_state: dict[str, dict] = {}
        for index, stall_id in enumerate(stalls):
            anchor_zone = self._point_to_zone((index % self.rows, (index * 2) % self.cols))
            anchor_density = self._density[anchor_zone]
            wait_time = max(1, int(round(1 + anchor_density / 11 + index * 0.4)))
            queue_state[stall_id] = {
                "stall_id": stall_id,
                "wait_time_minutes": wait_time,
                "alternative": f"{stall_id}-alt",
            }
        return queue_state

    def _queue_for_stall(self, stall_id: str) -> dict:
        density = sum(self._density.values()) / max(1, len(self._density))
        wait_time = max(1, int(round(2 + density / 12)))
        return {
            "stall_id": stall_id,
            "wait_time_minutes": wait_time,
            "alternative": f"{stall_id}-alt",
        }

    def _queue_time_for_zone(self, zone_id: str) -> int:
        density = self._density.get(zone_id, 50)
        if self._scenario == "food-rush" and zone_id in {"zone-8", "zone-9", "zone-13", "zone-14"}:
            density += 18
        if self._scenario == "emergency-mode":
            density += 12
        if self._scenario == "optimize-crowd":
            density -= 12
        return max(1, int(round(2 + density / 12)))

    def _zone_payload(self, zone_id: str, density: int) -> dict:
        level = "low" if density < 35 else "medium" if density < 70 else "high"
        row, col = self._parse_zone(zone_id)
        return {
            "zone_id": zone_id,
            "row": row,
            "col": col,
            "density_level": level,
            "density_score": density,
            "timestamp": self._timestamp,
        }

    def _high_density_zone_count(self) -> int:
        return sum(1 for density in self._density.values() if density > 70)

    def _scenario_metrics(self) -> dict:
        queue_items = list(self._queue_state.values())
        longest_queue = max((item["wait_time_minutes"] for item in queue_items), default=0)
        return {
            "avg_density": round(sum(self._density.values()) / max(1, len(self._density)), 1),
            "longest_queue": longest_queue,
            "high_density_zones": self._high_density_zone_count(),
            "flow_score": max(0, 100 - int(round(sum(self._density.values()) / max(1, len(self._density))) / 2) - longest_queue),
        }

    def _normalize_demo_action(self, action: str) -> str:
        normalized = action.strip().lower().replace(" ", "-")
        allowed = {"normal", "surge-zone-1", "food-rush", "emergency-mode", "optimize-crowd"}
        if normalized not in allowed:
            return "normal"
        return normalized

    def _demo_title(self, action: str) -> str:
        titles = {
            "surge-zone-1": "Surge Zone 1 activated",
            "food-rush": "Food rush simulated",
            "emergency-mode": "Emergency mode engaged",
            "optimize-crowd": "Crowd optimization applied",
            "normal": "Baseline crowd flow restored",
        }
        return titles.get(action, "Scenario updated")

    def _demo_message(self, action: str) -> str:
        messages = {
            "surge-zone-1": "Zone 1 density spikes and nearby routes reroute automatically.",
            "food-rush": "Concessions fill quickly, pushing queues and detours into view.",
            "emergency-mode": "Critical congestion and reduced signal quality trigger fallback guidance.",
            "optimize-crowd": "Density and queue pressure are reduced across the venue.",
            "normal": "Live conditions return to the default operating state.",
        }
        return messages.get(action, "Scenario updated.")

    def _demo_targets(self, action: str) -> list[str]:
        targets = {
            "surge-zone-1": ["zone-1", "zone-2", "zone-6"],
            "food-rush": ["zone-8", "zone-9", "zone-13", "zone-14"],
            "emergency-mode": ["zone-11", "zone-12", "zone-13", "zone-14", "zone-15"],
            "optimize-crowd": ["zone-1", "zone-2", "zone-6", "zone-8", "zone-9"],
            "normal": [],
        }
        return targets.get(action, [])

    def _apply_demo_action(self, action: str) -> None:
        adjustments = {
            "surge-zone-1": {"zone-1": 32, "zone-2": 16, "zone-6": 10},
            "food-rush": {"zone-8": 26, "zone-9": 24, "zone-13": 20, "zone-14": 18},
            "emergency-mode": {"zone-11": 34, "zone-12": 36, "zone-13": 28, "zone-14": 28, "zone-15": 34},
            "optimize-crowd": {"zone-1": -14, "zone-2": -12, "zone-6": -10, "zone-8": -8, "zone-9": -8, "zone-13": -6, "zone-14": -6},
        }
        deltas = adjustments.get(action)
        if not deltas:
            return
        for zone_id, delta in deltas.items():
            if zone_id in self._density:
                self._density[zone_id] = self._clamp(self._density[zone_id] + delta, 6, 96)
        return sum(1 for density in self._density.values() if density >= 70)

    def _resolve_point(self, value: str, phase: str | None = None) -> GridPoint:
        aliases = {
            "entrance": (0, 0),
            "main-entrance": (0, 0),
            "main-gate": (0, 0),
            "north-gate": (0, 0),
            "gate-1": (0, 0),
            "gate-2": (0, 4),
            "gate-3": (4, 0),
            "gate-4": (4, 4),
            "food": (2, 1),
            "food-court": (2, 1),
            "restroom": (3, 3),
            "restroom-1": (3, 3),
            "restroom-2": (1, 3),
            "concourse-a": (2, 0),
            "concourse-b": (2, 2),
            "concourse-c": (2, 4),
            "parking-a": (4, 1),
            "parking-b": (4, 3),
            "exit-a": (4, 2),
            "exit-b": (1, 4),
            "seat": (4, 4),
            "seat-block": (4, 4),
            "stage": (0, 4),
            "plaza": (3, 1),
        }
        value = value.strip().lower()
        if phase == "departure" and value in {"seat", "seat-block"}:
            return aliases["exit-a"]
        if value in aliases:
            return aliases[value]
        if value.startswith("zone-"):
            return self._parse_zone(value)
        if value in {"0,0", "4,4", "2,1", "3,3", "0,4"}:
            row, col = value.split(",")
            return int(row), int(col)
        return aliases["entrance"] if value == "start" else aliases["seat"]

    def _venue_catalog(self, kind: str) -> list[dict]:
        nodes = [
            {"node_id": "gate-1", "label": "North Gate", "kind": "gate", "row": 0, "col": 0},
            {"node_id": "gate-2", "label": "East Gate", "kind": "gate", "row": 0, "col": 4},
            {"node_id": "gate-3", "label": "South Gate", "kind": "gate", "row": 4, "col": 0},
            {"node_id": "gate-4", "label": "West Gate", "kind": "gate", "row": 4, "col": 4},
            {"node_id": "parking-a", "label": "Parking A", "kind": "parking", "row": 4, "col": 1},
            {"node_id": "parking-b", "label": "Parking B", "kind": "parking", "row": 4, "col": 3},
            {"node_id": "exit-a", "label": "Exit Plaza A", "kind": "exit", "row": 4, "col": 2},
            {"node_id": "exit-b", "label": "Transit Exit", "kind": "exit", "row": 1, "col": 4},
            {"node_id": "concourse-a", "label": "Main Concourse", "kind": "concourse", "row": 2, "col": 0},
            {"node_id": "concourse-b", "label": "Food Hall", "kind": "concourse", "row": 2, "col": 2},
            {"node_id": "concourse-c", "label": "Family Zone", "kind": "concourse", "row": 2, "col": 4},
        ]
        return [node for node in nodes if node["kind"] == kind]

    def _node_payload(self, node: dict) -> dict:
        zone_id = self._point_to_zone((node["row"], node["col"]))
        density = self._density[zone_id]
        level = "low" if density < 35 else "medium" if density < 70 else "high"
        recommendation = self._node_recommendation(node["kind"], density)
        return {
            "node_id": node["node_id"],
            "label": node["label"],
            "kind": node["kind"],
            "zone_id": zone_id,
            "row": node["row"],
            "col": node["col"],
            "density_level": level,
            "density_score": density,
            "recommendation": recommendation,
        }

    def _node_recommendation(self, kind: str, density: int) -> str:
        if kind == "gate":
            if density >= 70:
                return "Redirect attendees to a lower-density gate."
            return "Use this gate for balanced entry distribution."
        if kind == "parking":
            return "Guide vehicles here when nearby lots are full."
        if kind == "exit":
            if density >= 70:
                return "Hold this exit for controlled departure waves."
            return "Use for staggered departures."
        return "Use as a routing waypoint inside the venue."

    def _phase_notes(self, phase: str) -> list[str]:
        normalized_phase = self._normalize_phase(phase)
        if self._scenario == "emergency-mode":
            return ["Switch to emergency broadcast mode.", "Push evacuation guidance and freeze non-essential routing."]
        if self._scenario == "optimize-crowd":
            return ["Flow is optimized.", "Keep recommendation overlays active for the final mile."]
        notes = {
            "arrival": ["Open the least crowded gates first.", "Push parking alternatives to incoming fans."],
            "in-venue": ["Balance foot traffic between concourses.", "Keep live food and restroom guidance visible."],
            "halftime": ["Expect queue spikes in the next few minutes.", "Pre-position staff at concessions and restrooms."],
            "departure": ["Stagger exit streams to avoid crush points.", "Prioritize transit exits and parking feedback."],
        }
        return notes.get(normalized_phase, notes["in-venue"])

    def _journey_advice(self, phase: str, origin: str, destination: str) -> list[str]:
        advice = {
            "arrival": [
                "Follow the least crowded gate shown by the live map.",
                "Use parking recommendations if your arrival window is tight.",
            ],
            "in-venue": [
                "Stay on the highlighted route and avoid the hottest concourse nodes.",
                "Check alternate food and restroom options when queues rise above 8 minutes.",
            ],
            "halftime": [
                "Move early if you need concessions or restrooms.",
                "Use the alternate path if your destination sits beside a high-density node.",
            ],
            "departure": [
                "Follow the recommended exit wave to keep circulation smooth.",
                "Hold near your section until the primary exit lane clears.",
            ],
        }
        base = advice.get(phase, advice["in-venue"]).copy()
        if self._scenario == "emergency-mode":
            base = ["Follow emergency arrows and keep movement minimal.", "Use the fallback route if the primary corridor is crowded."]
        if self._scenario == "optimize-crowd":
            base = ["AI recommends the green route and lower-density nodes.", "Predicted congestion drops in 2 minutes with the optimized path."]
        if origin == destination:
            base.append("No movement is required, but keep the app open for congestion alerts.")
        return base

    def _normalize_phase(self, phase: str) -> str:
        normalized = phase.strip().lower()
        if normalized not in {"arrival", "in-venue", "halftime", "departure"}:
            return "in-venue"
        return normalized

    def _dijkstra(self, start: GridPoint, end: GridPoint) -> List[GridPoint]:
        queue: list[tuple[float, GridPoint]] = [(0.0, start)]
        distances: dict[GridPoint, float] = {start: 0.0}
        previous: dict[GridPoint, GridPoint] = {}

        while queue:
            cost, node = heappop(queue)
            if node == end:
                break
            if cost > distances.get(node, float("inf")):
                continue
            for neighbor in self._neighbors(node):
                zone_id = self._point_to_zone(neighbor)
                density = self._density.get(zone_id, 50)
                step_cost = 1 + density / 40
                if density >= 70:
                    step_cost += 4
                new_cost = cost + step_cost
                if new_cost < distances.get(neighbor, float("inf")):
                    distances[neighbor] = new_cost
                    previous[neighbor] = node
                    heappush(queue, (new_cost, neighbor))

        if end not in previous and start != end:
            return [start, end]

        path = [end]
        while path[-1] != start:
            path.append(previous[path[-1]])
        path.reverse()
        return path

    def _neighbors(self, point: GridPoint) -> list[GridPoint]:
        row, col = point
        candidates = [(row - 1, col), (row + 1, col), (row, col - 1), (row, col + 1)]
        return [candidate for candidate in candidates if 0 <= candidate[0] < self.rows and 0 <= candidate[1] < self.cols]

    def _point_to_zone(self, point: GridPoint) -> str:
        return self._zone_id(point[0], point[1])

    def _zone_id(self, row: int, col: int) -> str:
        return f"zone-{row * self.cols + col + 1}"

    def _parse_zone(self, zone_id: str) -> GridPoint:
        index = int(zone_id.split("-")[1]) - 1
        return divmod(index, self.cols)

    def _clamp(self, value: int, minimum: int, maximum: int) -> int:
        return max(minimum, min(maximum, value))

    def _now(self) -> str:
        return datetime.now(UTC).isoformat()
