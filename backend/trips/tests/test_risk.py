import pytest

from trips.risk import classify, recommend, summarize


@pytest.mark.parametrize(
    "wind,expected",
    [
        (0, 0),
        (24.99, 0),
        (25, 1),
        (34.99, 1),
        (35, 2),
        (44.99, 2),
        (45, 3),
        (54.99, 3),
        (55, 4),
        (80, 4),
    ],
)
def test_wind_boundaries(wind, expected):
    assert classify(wind, 0, 0, 0)["level"] == expected


@pytest.mark.parametrize(
    "rain,expected",
    [(0.099, 0), (0.1, 1), (0.249, 1), (0.25, 2), (0.499, 2), (0.5, 3), (1, 3), (1.001, 4)],
)
def test_rain_boundaries(rain, expected):
    assert classify(0, rain, 0, 0)["level"] == expected


@pytest.mark.parametrize(
    "snow,expected",
    [(0.499, 0), (0.5, 1), (0.999, 1), (1, 2), (1.999, 2), (2, 3), (3, 3), (3.001, 4)],
)
def test_snow_boundaries(snow, expected):
    assert classify(0, 0, snow, 0)["level"] == expected


@pytest.mark.parametrize(
    "wind,load,expected",
    [(35, 40000, 2), (35, 40001, 3), (44.99, 42000, 3), (45, 30000, 3), (45, 30001, 4), (55, 0, 4)],
)
def test_load_overrides(wind, load, expected):
    risk = classify(wind, 0, 0, load)
    assert risk["level"] == expected
    assert risk["reasons"]


def test_worst_hazard_and_unknown():
    assert classify(20, 0.3, 2.5, 0)["level"] == 3
    assert classify(None, 0.3, 0, 0)["level"] is None


def test_distance_weighted_summary_counts_partial_interval():
    checkpoints = [
        {"mile": 0, "risk": {"level": 0}},
        {"mile": 25, "risk": {"level": 2}},
        {"mile": 31, "risk": {"level": 3}},
    ]
    s = summarize(checkpoints)
    assert s["high_miles"] == 25
    assert s["severe_miles"] == 6
    assert s["average_risk"] == pytest.approx((25 * 2 + 6 * 3) / 31)
    assert sum(s["risk_miles"]) == 31


def route(id, severe=0, high=0, average=0, seconds=100, blocked=0, complete=True):
    return {
        "id": id,
        "duration_seconds": seconds,
        "summary": {
            "severe_miles": severe,
            "high_miles": high,
            "average_risk": average,
            "no_travel_miles": blocked,
            "complete": complete,
        },
    }


@pytest.mark.parametrize(
    "a,b",
    [
        (route("a", severe=1), route("b", severe=2, seconds=1)),
        (route("a", high=1), route("b", high=2, average=0, seconds=1)),
        (route("a", average=1), route("b", average=2, seconds=1)),
        (route("a", seconds=10), route("b", seconds=20)),
    ],
)
def test_lexicographic_ranking(a, b):
    assert recommend([b, a])["route_id"] == "a"


def test_no_travel_excluded_and_incomplete_suppresses_recommendation():
    assert recommend([route("a", blocked=1), route("b", severe=100)])["route_id"] == "b"
    assert recommend([route("a", blocked=1)])["route_id"] is None
    assert recommend([route("a"), route("b", complete=False)])["route_id"] is None
