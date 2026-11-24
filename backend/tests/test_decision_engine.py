"""
tests/test_decision_engine.py

Unit tests for decision_engine.py covering all threshold cases.
No network calls — pure Python logic.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from decision_engine import (
    irrigation_verdict,
    spraying_verdict,
    harvest_verdict,
    verdicts_to_prompt_context,
)


# ---------------------------------------------------------------------------
# Irrigation thresholds
# ---------------------------------------------------------------------------

class TestIrrigation:
    def test_rain_forecast_always_skip(self):
        """Rain overrides even a dry soil reading."""
        v = irrigation_verdict(root_moisture=0.10, is_rain_forecast=True)
        assert v.ok is False
        assert v.badge == "Skip"
        assert "rain" in v.reason.lower()

    def test_saturated_soil_skip(self):
        v = irrigation_verdict(root_moisture=0.36, is_rain_forecast=False)
        assert v.ok is False
        assert v.badge == "Skip"
        assert "saturat" in v.reason.lower() or "waterlog" in v.reason.lower()

    def test_exact_saturation_boundary_above(self):
        """root_moisture > 0.35 should be Skip."""
        v = irrigation_verdict(root_moisture=0.351, is_rain_forecast=False)
        assert v.ok is False

    def test_dry_soil_irrigate(self):
        v = irrigation_verdict(root_moisture=0.14, is_rain_forecast=False)
        assert v.ok is True
        assert v.badge == "Irrigate"
        assert "dry" in v.reason.lower() or "stress" in v.reason.lower()

    def test_exact_dry_boundary_below(self):
        """root_moisture < 0.15 should be Irrigate."""
        v = irrigation_verdict(root_moisture=0.149, is_rain_forecast=False)
        assert v.ok is True

    def test_optimal_range_no_rain(self):
        v = irrigation_verdict(root_moisture=0.25, is_rain_forecast=False)
        assert v.ok is True
        assert v.badge == "Optimal"

    def test_no_moisture_data_fallback(self):
        v = irrigation_verdict(root_moisture=None, is_rain_forecast=False)
        assert v.ok is True          # default to irrigation advice
        assert "unavailable" in v.reason.lower() or "standard" in v.reason.lower()


# ---------------------------------------------------------------------------
# Spraying thresholds
# ---------------------------------------------------------------------------

class TestSpraying:
    def test_rain_forecast_delay(self):
        v = spraying_verdict(vpd_kpa=1.0, wind_gusts_ms=2.0,
                             is_rain_forecast=True, humidity_pct=70)
        assert v.ok is False
        assert v.badge == "Delay"
        assert "rain" in v.reason.lower() or "wash" in v.reason.lower()

    def test_high_vpd_delay(self):
        v = spraying_verdict(vpd_kpa=2.1, wind_gusts_ms=2.0,
                             is_rain_forecast=False, humidity_pct=70)
        assert v.ok is False
        assert "vpd" in v.reason.lower() or "vapour" in v.reason.lower() or "pressure" in v.reason.lower()

    def test_vpd_exactly_at_threshold_ok(self):
        """VPD = 2.0 exactly is NOT above threshold — should be safe."""
        v = spraying_verdict(vpd_kpa=2.0, wind_gusts_ms=2.0,
                             is_rain_forecast=False, humidity_pct=70)
        assert v.ok is True

    def test_high_wind_delay(self):
        v = spraying_verdict(vpd_kpa=1.0, wind_gusts_ms=5.5,
                             is_rain_forecast=False, humidity_pct=70)
        assert v.ok is False
        assert "wind" in v.reason.lower() or "drift" in v.reason.lower()

    def test_high_humidity_delay(self):
        v = spraying_verdict(vpd_kpa=1.0, wind_gusts_ms=2.0,
                             is_rain_forecast=False, humidity_pct=92)
        assert v.ok is False
        assert "humid" in v.reason.lower()

    def test_safe_conditions(self):
        v = spraying_verdict(vpd_kpa=1.0, wind_gusts_ms=2.0,
                             is_rain_forecast=False, humidity_pct=70)
        assert v.ok is True
        assert v.badge == "Safe"

    def test_no_vpd_no_wind_safe(self):
        v = spraying_verdict(vpd_kpa=None, wind_gusts_ms=None,
                             is_rain_forecast=False, humidity_pct=60)
        assert v.ok is True


# ---------------------------------------------------------------------------
# Harvest thresholds
# ---------------------------------------------------------------------------

class TestHarvest:
    def test_not_harvest_stage_na(self):
        v = harvest_verdict("growing", False, False, 30.0)
        assert v.badge == "N/A"
        assert v.ok is False

    def test_sowing_stage_na(self):
        v = harvest_verdict("sowing", False, False, 30.0)
        assert v.badge == "N/A"

    def test_extreme_alert_hold(self):
        v = harvest_verdict("harvest", False, True, 30.0)
        assert v.ok is False
        assert v.badge == "Hold"

    def test_rain_forecast_hold(self):
        v = harvest_verdict("harvest", True, False, 30.0)
        assert v.ok is False
        assert v.badge == "Hold"

    def test_high_temp_hold(self):
        v = harvest_verdict("harvest", False, False, 43.0)
        assert v.ok is False

    def test_exact_temp_boundary_ok(self):
        """Temperature = 42°C should be OK (threshold is > 42)."""
        v = harvest_verdict("harvest", False, False, 42.0)
        assert v.ok is True

    def test_clear_conditions_ready(self):
        v = harvest_verdict("harvest", False, False, 35.0)
        assert v.ok is True
        assert v.badge == "Ready"

    def test_storm_in_7d(self):
        v = harvest_verdict("harvest", False, False, 35.0, storm_in_7d=True)
        assert v.ok is False
        assert v.badge == "Plan"


# ---------------------------------------------------------------------------
# Prompt context generation
# ---------------------------------------------------------------------------

class TestVerdictContext:
    def test_live_data_no_estimated_note(self):
        irr = irrigation_verdict(0.25, False)
        spr = spraying_verdict(1.0, 2.0, False, 70)
        har = harvest_verdict("growing", False, False, 30.0)
        ctx = verdicts_to_prompt_context(irr, spr, har, data_source="live")
        assert "ESTIMATED" not in ctx
        assert "Decision Engine" in ctx

    def test_estimated_data_note_present(self):
        irr = irrigation_verdict(0.25, False)
        spr = spraying_verdict(1.0, 2.0, False, 70)
        har = harvest_verdict("growing", False, False, 30.0)
        ctx = verdicts_to_prompt_context(irr, spr, har, data_source="estimated")
        assert "ESTIMATED" in ctx
