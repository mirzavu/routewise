from datetime import datetime, timezone

import pytest

from trips import weather
from trips.weather import normalize, weather_at


def test_arrival_interpolates_wind_but_uses_containing_rain_hour():
    forecast = {
        "times": [0, 3600, 7200],
        "wind": [10, 30, 50],
        "rain": [0, 0.2, 0.6],
        "snow": [0, 0.1, 1],
    }
    w = weather_at(forecast, datetime.fromtimestamp(1800, timezone.utc))
    assert w == {"wind_mph": 20, "rain_in_hr": 0.2, "snow_in_hr": 0.1}
    assert weather_at(forecast, datetime.fromtimestamp(3600, timezone.utc))["rain_in_hr"] == 0.2
    assert weather_at(forecast, datetime.fromtimestamp(7300, timezone.utc))["wind_mph"] is None


def test_unit_conversion_and_showers():
    w = normalize(
        {
            "hourly": {
                "time": [0],
                "wind_speed_10m": [16.09344],
                "rain": [2.54],
                "showers": [2.54],
                "snowfall": [2.54],
            },
            "hourly_units": {
                "wind_speed_10m": "km/h",
                "rain": "mm",
                "showers": "mm",
                "snowfall": "cm",
            },
        }
    )
    assert w["wind"][0] == pytest.approx(10)
    assert w["rain"][0] == pytest.approx(0.2)
    assert w["snow"][0] == pytest.approx(1)


def test_missing_values_are_not_zero():
    w = normalize(
        {
            "hourly": {"time": [0], "wind_speed_10m": [None], "rain": [0], "snowfall": [0]},
            "hourly_units": {"wind_speed_10m": "mph", "rain": "inch", "snowfall": "inch"},
        }
    )
    assert w["wind"] == [None]
    assert w["rain"] == [None]


def test_provider_miles_per_hour_unit_alias():
    data = normalize(
        {
            "hourly": {
                "time": [0],
                "wind_speed_10m": [38],
                "rain": [0],
                "showers": [0],
                "snowfall": [0],
            },
            "hourly_units": {
                "wind_speed_10m": "mp/h",
                "rain": "inch",
                "showers": "inch",
                "snowfall": "inch",
            },
        }
    )
    assert data["wind"][0] == 38


def test_truncated_arrays_are_unknown_not_index_errors():
    data = normalize(
        {
            "hourly": {
                "time": [0, 3600],
                "wind_speed_10m": [10],
                "rain": [0],
                "showers": [0],
                "snowfall": [0],
            },
            "hourly_units": {
                "wind_speed_10m": "mph",
                "rain": "inch",
                "showers": "inch",
                "snowfall": "inch",
            },
        }
    )
    assert weather_at(data, datetime.fromtimestamp(3600, timezone.utc))["wind_mph"] is None


def test_condition_arrays_preserve_codes_and_normalize_daylight():
    data = normalize(
        {
            "hourly": {
                "time": [0, 3600, 7200, 10800],
                "weather_code": [0, 3, 71, 95],
                "is_day": [1, 0, 1, 0],
            }
        }
    )
    assert data["weather_code"] == [0, 3, 71, 95]
    assert data["is_day"] == [True, False, True, False]


@pytest.mark.parametrize(
    "raw_codes,raw_days,expected_codes,expected_days",
    [
        ([61], [0], [61, None, None], [False, None, None]),
        ([None, 4, 61.5], [None, 2, "1"], [None] * 3, [None] * 3),
        ([True, "61", float("nan")], [False, 1.0, float("inf")], [None] * 3, [None] * 3),
        ("61", 1, [None] * 3, [None] * 3),
    ],
)
def test_invalid_or_truncated_condition_arrays_are_unknown(
    raw_codes, raw_days, expected_codes, expected_days
):
    data = normalize(
        {
            "hourly": {
                "time": [0, 3600, 7200],
                "weather_code": raw_codes,
                "is_day": raw_days,
            }
        }
    )
    assert data["weather_code"] == expected_codes
    assert data["is_day"] == expected_days
    missing = normalize({"hourly": {"time": [0, 3600]}})
    assert missing["weather_code"] == [None, None]
    assert missing["is_day"] == [None, None]


@pytest.mark.parametrize(
    "stamp,expected",
    [
        (-1, {"code": None, "is_day": None}),
        (0, {"code": 0, "is_day": False}),
        (1800, {"code": 0, "is_day": False}),
        (3600, {"code": 61, "is_day": True}),
        (7199, {"code": 61, "is_day": True}),
        (7200, {"code": 95, "is_day": None}),
        (7201, {"code": None, "is_day": None}),
    ],
)
def test_condition_at_uses_previous_instant_without_interpolating(stamp, expected):
    forecast = {
        "times": [0, 3600, 7200],
        "weather_code": [0, 61, 95],
        "is_day": [False, True, None],
    }
    assert weather.condition_at(forecast, datetime.fromtimestamp(stamp, timezone.utc)) == expected


@pytest.mark.parametrize(
    "forecast",
    [None, {}, {"times": []}, {"times": [0]}, {"times": [0], "weather_code": [], "is_day": []}],
)
def test_condition_at_handles_missing_forecast_values(forecast):
    assert weather.condition_at(forecast, datetime.fromtimestamp(0, timezone.utc)) == {
        "code": None,
        "is_day": None,
    }
