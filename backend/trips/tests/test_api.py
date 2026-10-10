from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient


@pytest.fixture
def client():
    return APIClient()


def payload():
    return {
        "origin": {
            "label": "Dallas, TX",
            "coordinates": [-96.8, 32.8],
            "timezone": "America/Chicago",
        },
        "destination": {
            "label": "Atlanta, GA",
            "coordinates": [-84.4, 33.75],
            "timezone": "America/New_York",
        },
        "departure": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        "load_lb": 36000,
        "spacing_miles": 25,
    }


def test_health(client):
    assert client.get("/api/health").status_code == 200


@pytest.mark.parametrize(
    "field,value",
    [
        ("load_lb", -1),
        ("spacing_miles", 15),
        ("departure", "2020-01-01T00:00:00Z"),
        ("load_lb", "NaN"),
    ],
)
def test_invalid_inputs(client, field, value):
    data = payload()
    data[field] = value
    assert client.post("/api/trips/analyze", data, format="json").status_code == 400


def test_missing_key_is_actionable(client, settings):
    settings.MAPBOX_ACCESS_TOKEN = ""
    r = client.post("/api/trips/analyze", payload(), format="json")
    assert r.status_code == 503
    assert "Mapbox" in r.json()["message"]


def test_live_analysis_contract(client):
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    forecast = {
        "times": [(now + timedelta(hours=i)).timestamp() for i in range(12)],
        "wind": [10] * 12,
        "rain": [0] * 12,
        "snow": [0] * 12,
    }
    route = {
        "geometry": {"type": "LineString", "coordinates": [[-96.8, 32.8], [-96, 33]]},
        "legs": [{"summary": "I-20 E", "annotation": {"distance": [50000], "duration": [2000]}}],
        "distance": 50000,
        "duration": 2000,
    }
    with (
        patch("trips.views.get_routes", return_value=[route]),
        patch("trips.views.fetch_forecasts", side_effect=lambda points: [forecast for _ in points]),
    ):
        r = client.post("/api/trips/analyze", payload(), format="json")
    assert r.status_code == 200, r.content
    data = r.json()
    assert len(data["routes"]) == 1
    assert data["recommendation"]["route_id"] == "A"
    assert len(data["routes"][0]["checkpoints"]) == 3
    assert data["warnings"]
    assert data["routes"][0]["summary"]["high_miles"] == 0


def test_corridor_rejects_unbounded_input(client):
    r = client.post(
        "/api/weather/corridor",
        {
            "routes": [[[0, 0], [190, 4]]],
            "load_lb": 0,
            "departure": payload()["departure"],
        },
        format="json",
    )
    assert r.status_code == 400
    assert "routes" in r.json()["fields"]


@pytest.mark.parametrize("departure", [None, "invalid-date"])
def test_corridor_requires_valid_departure(client, departure):
    data = {"routes": [[[-96.8, 32.8], [-96, 33]]], "load_lb": 36000}
    if departure is not None:
        data["departure"] = departure
    with patch("trips.views.fetch_forecasts", return_value=[]):
        response = client.post("/api/weather/corridor", data, format="json")
    assert response.status_code == 400
    assert "departure" in response.json()["fields"]


@pytest.mark.parametrize(
    "departure",
    ["2026-10-14T04:30:00Z", "2026-10-13T23:30:00-05:00", "2026-10-14T10:00:00+05:30"],
)
def test_corridor_starts_at_exact_departure_and_preserves_unavailable_hours(client, departure):
    start = datetime(2026, 10, 14, 4, 30, tzinfo=timezone.utc)
    hour = start.replace(minute=0)
    forecast = {
        "times": [(hour + timedelta(hours=i)).timestamp() for i in range(3)],
        "wind": [10, 30, 50],
        "rain": [0, 0.1, 0.3],
        "snow": [0, 0, 0],
        "weather_code": [0, 61, 63],
        "is_day": [False] * 3,
    }
    grid = {"points": [[-96.8, 32.8]], "width": 1, "height": 1}
    with (
        patch("trips.views.corridor_grid", return_value=grid),
        patch("trips.views.fetch_forecasts", return_value=[forecast]),
    ):
        response = client.post(
            "/api/weather/corridor",
            {"routes": [[[-96.8, 32.8], [-96, 33]]], "load_lb": 0, "departure": departure},
            format="json",
        )
    assert response.status_code == 200, response.content
    data = response.json()
    assert [datetime.fromisoformat(t) for t in data["times"]] == [
        start + timedelta(hours=i) for i in range(49)
    ]
    # Wind interpolates at :30; precipitation uses the containing hourly interval.
    assert data["frames"][:2] == [[1], [2]]
    assert data["risk_drivers"][:2] == [
        {"wind": 0, "rain": 1, "snow": 0},
        {"wind": 2, "rain": 2, "snow": 0},
    ]
    assert data["frames"][2:] == [[None]] * 47
    assert data["risk_drivers"][2:] == [{"wind": None, "rain": None, "snow": None}] * 47
    assert data["conditions"][2:] == [{"code": None, "is_day": None}] * 47


def test_corridor_reports_conditions_without_changing_risk_frames(client):
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    base = {
        "times": [(now + timedelta(hours=i)).timestamp() for i in range(49)],
        "wind": [10] * 49,
        "rain": [0] * 49,
        "snow": [0] * 49,
    }
    forecasts = [
        {**base, "weather_code": [3, 0] + [None] * 47, "is_day": [True] * 49},
        {**base, "weather_code": [71, 0] + [None] * 47, "is_day": [False] * 49},
    ]
    grid = {"points": [[-96.8, 32.8], [-96, 33]], "width": 2, "height": 1}
    with (
        patch("trips.views.corridor_grid", return_value=grid),
        patch("trips.views.fetch_forecasts", return_value=forecasts),
        patch("trips.views.datetime", wraps=datetime) as clock,
    ):
        clock.now.return_value = now
        response = client.post(
            "/api/weather/corridor",
            {
                "routes": [[[-96.8, 32.8], [-96, 33]]],
                "load_lb": 36000,
                "departure": now.isoformat(),
            },
            format="json",
        )
    assert response.status_code == 200, response.content
    data = response.json()
    assert len(data["conditions"]) == len(data["times"]) == len(data["frames"]) == 49
    assert data["conditions"][0] == {"code": 71, "is_day": False}
    assert data["conditions"][1] == {"code": 0, "is_day": True}
    assert data["conditions"][2:] == [{"code": None, "is_day": None}] * 47
    assert data["frames"] == [[0, 0]] * 49
