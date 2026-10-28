"""
VAJRA 3.0 Tool: Road-Aware Patrol Dispatch & Beat Optimizer
===========================================================
Generates a road-network-constrained 4-hour beat patrol route connecting
density hotspots within a police station jurisdiction using LightGBM forecasting and TSP.
"""

from typing import Dict, Any
from tools.registry import VajraTool, ToolManager
from patrol_optimizer import PatrolRouteOptimizer

class PatrolRouteTool(VajraTool):
    def get_schema(self) -> dict:
        return {
            "name": "optimize_patrol_route",
            "description": "Generates a feasible 4-hour road-network beat patrol corridor for a police station, optimizing waypoint sequencing across density blackspots using LightGBM forecasting and TSP.",
            "parameters": {
                "type": "object",
                "properties": {
                    "unit_id": {
                        "type": "integer",
                        "description": "PoliceStationID (UnitID) to generate patrol corridor for"
                    },
                    "station_name": {
                        "type": "string",
                        "description": "Name of the police station headquarters (e.g. 'Ulsoor Gate PS')"
                    },
                    "max_stops": {
                        "type": "integer",
                        "description": "Maximum high-density patrol stops to include (default: 5)",
                        "default": 5
                    }
                },
                "required": ["unit_id"]
            }
        }

    def execute(self, params: dict, context: dict) -> dict:
        unit_id = params.get("unit_id") or params.get("station_id") or 1
        station_name = params.get("station_name") or f"Police Station {unit_id}"
        max_stops = params.get("max_stops") or 5

        plan = PatrolRouteOptimizer.generate_patrol_plan(
            unit_id=int(unit_id),
            station_name=str(station_name),
            max_stops=int(max_stops)
        )

        if plan.get("status") != "success":
            return {
                "response_type": "text",
                "text_result": f"⚠️ **Patrol Route Dispatch**: {plan.get('message', 'Unable to generate route for unit')}",
                "data": plan
            }

        fc = plan.get("volume_forecast", {})
        stops = plan.get("waypoints", [])

        lines = [
            f"🚔 **Proactive Beat Patrol Corridor: {station_name}**",
            f"• **Forecasted 7-Day Workload**: **{fc.get('predicted_7d_incidents')} incidents** (Tier: **{fc.get('risk_tier')}**)",
            f"• **Total Road Corridor**: **{plan.get('total_corridor_distance_km')} km** across {len(stops)} sectors",
            f"• **Total Beat Mission Time**: **{plan.get('total_beat_duration_min')} min** (Transit: {plan.get('estimated_transit_time_min')}m, On-Scene Dwell: {plan.get('on_scene_dwell_time_min')}m)",
            f"• **4-Hour Shift Feasibility**: **{'✅ Feasible' if plan.get('fits_4h_shift_budget') else '⚠️ Exceeds 4h - Split into 2 Beats'}**\n",
            "**Sequential Beat Waypoints:**"
        ]

        for s in stops:
            lines.append(
                f"{s['stop_sequence']}. **{s['name']}** [{s['priority']}] — ({s['lat']}, {s['lng']}) → Next: {s.get('distance_to_next_km', 0)} km"
            )

        lines.append("\n*Routing Model*: Road-network tortuosity factor (1.32x street topology) + 2-opt TSP sequencing.")

        return {
            "response_type": "patrol_plan",
            "text_result": "\n".join(lines),
            "data": plan,
            "citations": [{
                "type": "Beat Patrol Forecaster",
                "id": str(unit_id),
                "details": f"Corridor Distance: {plan.get('total_corridor_distance_km')} km"
            }]
        }

# Register with central ToolManager
ToolManager.register("optimize_patrol_route", PatrolRouteTool())
