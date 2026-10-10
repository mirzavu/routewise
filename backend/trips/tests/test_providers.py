from copy import deepcopy
from datetime import datetime, timezone
from unittest.mock import patch

import pytest

from trips.providers import ProviderError, get_routes

START, END = [-100, 35], [-98, 35]
DEPARTURE = datetime(2026, 10, 10, 10, 0, 0, 123456, tzinfo=timezone.utc)


def route(middle, distance=2000, duration=120):
    return {
        "geometry": {"type": "LineString", "coordinates": [START, middle, END]},
        "distance": distance,
        "duration": duration,
        "legs": [
            {
                "summary": "Main road",
                "annotation": {"distance": [distance / 2] * 2, "duration": [duration / 2] * 2},
                "steps": [],
            }
        ],
    }


@pytest.fixture(autouse=True)
def configured(settings):
    settings.MAPBOX_ACCESS_TOKEN = "pk.test"


def response(routes):
    return {"code": "Ok", "routes": routes}


def test_adds_a_distinct_api_route_via_pass_through_corridor():
    a, b, c = route([-99, 35]), route([-99, 34.7]), route([-99, 35.3], 2200, 140)
    with patch("trips.providers.get_json", side_effect=[response([a, b]), response([c])]) as fetch:
        assert get_routes(START, END, DEPARTURE) == [a, b, c]
    assert fetch.call_count == 2
    url, params = fetch.call_args.args
    assert url.rsplit("/", 1)[-1].count(";") == 2
    assert params["waypoints"] == "0;2"
    assert params["continue_straight"] == "true"
    assert params["depart_at"] == "2026-10-10T10:00:00+00:00"


def test_does_not_supplement_when_three_routes_already_exist():
    routes = [route([-99, 35]), route([-99, 34.7]), route([-99, 35.3])]
    with patch("trips.providers.get_json", return_value=response(routes)) as fetch:
        assert get_routes(START, END, DEPARTURE) == routes
    assert fetch.call_count == 1


def test_duplicate_routes_never_fill_the_third_slot_and_requests_are_bounded():
    a, b = route([-99, 35]), route([-99, 34.7])
    with patch("trips.providers.get_json", return_value=response([a, b])) as fetch:
        assert get_routes(START, END, DEPARTURE) == [a, b]
    assert fetch.call_count == 3


@pytest.mark.parametrize("kind", ["distance", "duration", "uturn", "backtrack"])
def test_rejects_unsuitable_supplemental_routes(kind):
    a, b, c = route([-99, 35]), route([-99, 34.7]), route([-99, 35.3])
    if kind == "distance":
        c = route([-99, 35.3], distance=3000)
    elif kind == "duration":
        c["duration"] = 200
    elif kind == "uturn":
        c["legs"][0]["steps"] = [{"maneuver": {"modifier": "uturn"}}]
    else:
        c = deepcopy(a)
        c["geometry"]["coordinates"] = [START, [-99, 35], [-99, 35.1], [-99, 35], END]
        c["legs"][0]["annotation"] = {
            "distance": [1000, 100, 100, 1000],
            "duration": [50, 5, 5, 50],
        }
        c["distance"] = 2200
    with patch(
        "trips.providers.get_json", side_effect=[response([a, b]), response([c]), response([])]
    ):
        assert get_routes(START, END, DEPARTURE) == [a, b]


def test_supplemental_provider_failure_preserves_valid_routes():
    routes = [route([-99, 35]), route([-99, 34.7])]
    with patch("trips.providers.get_json", side_effect=[response(routes), ProviderError("Outage")]):
        assert get_routes(START, END, DEPARTURE) == routes
