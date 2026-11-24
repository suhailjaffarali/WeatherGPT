"""
decision_engine.py — WeatherGPT Server-Side Agronomic Decision Engine  (item 11)

Pure, unit-testable functions that return a verdict dict with:
  - ok   : bool      (True = safe/recommended, False = hold/skip)
  - badge: str       (short label for UI)
  - reason: str      (one sentence explanation)

These verdicts run BEFORE the LLM and are injected into the prompt as
hard facts the model must not contradict.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


# ---------------------------------------------------------------------------
# Shared types
# ---------------------------------------------------------------------------

@dataclass
class Verdict:
    ok: bool
    badge: str
    reason: str

    def to_dict(self) -> dict:
        return {"ok": self.ok, "badge": self.badge, "reason": self.reason}


# ---------------------------------------------------------------------------
# 1. Irrigation
# ---------------------------------------------------------------------------

def irrigation_verdict(
    root_moisture: Optional[float],   # m³/m³, 9–27 cm depth
    is_rain_forecast: bool,
) -> Verdict:
    """
    Determine whether to irrigate.

    Rules (in priority order):
      1. Rain forecast → skip (soil will receive natural moisture).
      2. root_moisture > 0.35 m³/m³ → skip (saturated; risk of waterlogging).
      3. root_moisture < 0.15 m³/m³ → irrigate now (crop stress).
      4. 0.15–0.35 m³/m³              → optimal; light irrigation acceptable.
      5. No moisture data              → recommend morning irrigation as standard practice.
    """
    if is_rain_forecast:
        return Verdict(
            ok=False,
            badge="Skip",
            reason="Rain is forecast — skip irrigation today to avoid waterlogging.",
        )

    if root_moisture is not None:
        pct = round(root_moisture * 100)
        if root_moisture > 0.35:
            return Verdict(
                ok=False,
                badge="Skip",
                reason=f"Root-zone soil is saturated ({pct}%) — irrigating now risks waterlogging and root rot.",
            )
        if root_moisture < 0.15:
            return Verdict(
                ok=True,
                badge="Irrigate",
                reason=f"Root-zone soil is dry ({pct}%) — irrigate now to prevent crop stress.",
            )
        return Verdict(
            ok=True,
            badge="Optimal",
            reason=f"Root-zone moisture is optimal ({pct}%) — light irrigation in early morning is acceptable.",
        )

    # No soil data
    return Verdict(
        ok=True,
        badge="Irrigate",
        reason="Soil moisture data unavailable — follow standard schedule and irrigate in early morning.",
    )


# ---------------------------------------------------------------------------
# 2. Spraying (pesticide / fertilizer)
# ---------------------------------------------------------------------------

def spraying_verdict(
    vpd_kpa: Optional[float],         # Vapour Pressure Deficit in kPa
    wind_gusts_ms: Optional[float],   # Wind gusts in m/s (None if unknown)
    is_rain_forecast: bool,
    humidity_pct: int,
) -> Verdict:
    """
    Determine whether conditions are safe for pesticide/fertilizer spraying.

    Rules:
      1. Rain forecast → delay (spray will be washed off).
      2. VPD > 2.0 kPa → delay (plants under moisture stress; droplets evaporate before uptake).
      3. Wind gusts > 5 m/s → delay (spray drift risk).
      4. Humidity > 90% → delay (droplets won't evaporate; fungal risk).
      5. Otherwise → safe.
    """
    if is_rain_forecast:
        return Verdict(
            ok=False,
            badge="Delay",
            reason="Rain forecast — spraying now will cause costly wash-off and chemical runoff.",
        )
    if vpd_kpa is not None and vpd_kpa > 2.0:
        return Verdict(
            ok=False,
            badge="Delay",
            reason=f"Vapour Pressure Deficit is high ({vpd_kpa:.1f} kPa) — plants are under moisture stress and spray uptake will be poor.",
        )
    if wind_gusts_ms is not None and wind_gusts_ms > 5.0:
        return Verdict(
            ok=False,
            badge="Delay",
            reason=f"Wind gusts are strong ({wind_gusts_ms:.1f} m/s) — spray drift may harm neighbouring crops and people.",
        )
    if humidity_pct > 90:
        return Verdict(
            ok=False,
            badge="Delay",
            reason=f"Humidity is very high ({humidity_pct}%) — droplets will not evaporate properly and may promote fungal disease.",
        )
    return Verdict(
        ok=True,
        badge="Safe",
        reason="Conditions are calm and dry — safe window for spraying in early morning or late afternoon.",
    )


# ---------------------------------------------------------------------------
# 3. Harvest readiness
# ---------------------------------------------------------------------------

def harvest_verdict(
    crop_stage: str,                      # "sowing" | "growing" | "harvest"
    is_rain_forecast: bool,
    has_extreme_alert: bool,
    temperature_c: float,
    storm_in_7d: bool = False,            # True if 7-day outlook has storms
) -> Verdict:
    """
    Determine whether conditions allow safe harvesting.

    Rules:
      1. Stage not "harvest" → not applicable.
      2. Extreme weather alert → hold.
      3. Storm in 7-day outlook → plan carefully.
      4. Rain forecast today → hold (risk of field damage and grain spoilage).
      5. Temperature > 42°C → hold (heat stress on harvesters and equipment).
      6. Otherwise → ready.
    """
    if crop_stage != "harvest":
        return Verdict(
            ok=False,
            badge="N/A",
            reason="Crop is still maturing — harvest readiness will be assessed when you switch to harvest stage.",
        )
    if has_extreme_alert:
        return Verdict(
            ok=False,
            badge="Hold",
            reason="Extreme weather alert is active — do not harvest; secure crops and machinery.",
        )
    if storm_in_7d:
        return Verdict(
            ok=False,
            badge="Plan",
            reason="Storms are expected within 7 days — harvest as soon as a 48-hour dry window is confirmed.",
        )
    if is_rain_forecast:
        return Verdict(
            ok=False,
            badge="Hold",
            reason="Rain forecast today — delay harvest to prevent grain damage and field access problems.",
        )
    if temperature_c > 42:
        return Verdict(
            ok=False,
            badge="Hold",
            reason=f"Temperature {temperature_c:.0f}°C is dangerously high — harvest only in early morning to protect workers.",
        )
    return Verdict(
        ok=True,
        badge="Ready",
        reason="Clear weather window — good conditions to harvest; complete within the next 48 hours if possible.",
    )


# ---------------------------------------------------------------------------
# 4. Build prompt snippet from verdicts (injected before LLM call)
# ---------------------------------------------------------------------------

def verdicts_to_prompt_context(
    irrigation: Verdict,
    spraying: Verdict,
    harvest: Verdict,
    data_source: str = "live",
) -> str:
    """
    Returns a plain-English block injected into the LLM prompt.
    The model MUST NOT contradict these verdicts.
    """
    source_note = (
        "NOTE: Weather and soil data are ESTIMATED (live API unavailable). "
        "Tell the farmer the data may not be exact. "
        if data_source == "estimated"
        else ""
    )
    return (
        f"{source_note}"
        f"[Decision Engine — treat these as fixed facts]\n"
        f"Irrigation: {irrigation.badge} — {irrigation.reason}\n"
        f"Spraying:   {spraying.badge} — {spraying.reason}\n"
        f"Harvest:    {harvest.badge} — {harvest.reason}\n"
    )
