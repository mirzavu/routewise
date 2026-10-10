import math
import time
from functools import lru_cache

import httpx
from django.conf import settings

from .geometry import METERS_PER_MILE, sample_route


class ProviderError(Exception):
    def __init__(self, message, status=502):
        self.message, self.status = message, status
        super().__init__(message)


def get_json(url, params):
    for attempt in range(2):
        try:
            response = httpx.get(url, params=params, timeout=httpx.Timeout(25, connect=8))
            if response.status_code in [429, 500, 502, 503, 504] and attempt == 0:
                time.sleep(1)
                continue
            if response.status_code == 429:
                raise ProviderError(
                    "The data provider is busy. Please wait a minute and try again.", 503
                )
            if response.status_code in [401, 403]:
                raise ProviderError(
                    "Mapbox credentials were not accepted. Check the configured token and permissions.",
                    503,
                )
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, ValueError) as exc:
            if attempt == 0:
                continue
            raise ProviderError(
                "A routing or weather service could not be reached. Please try again."
            ) from exc


def mapbox_token():
    if not settings.MAPBOX_ACCESS_TOKEN:
        raise ProviderError(
            "Mapbox is not configured yet. Add MAPBOX_ACCESS_TOKEN to the server environment to enable live routes.",
            503,
        )
    return settings.MAPBOX_ACCESS_TOKEN


def get_locations(query):
    data = get_json(
        "https://api.mapbox.com/search/geocode/v6/forward",
        {
            "q": query,
            "access_token": mapbox_token(),
            "autocomplete": "true",
            "limit": 5,
            "types": "place,address",
            "language": "en",
        },
    )
    result = []
    for feature in data.get("features", []):
        p = feature["properties"]
        coordinates = feature["geometry"]["coordinates"]
        result.append(
            {
                "label": p.get("full_address")
                or p.get("name_preferred")
                or p.get("name", "Location"),
                "coordinates": coordinates,
                "timezone": resolve_timezone(*coordinates),
            }
        )
    return result


@lru_cache(maxsize=1)
def timezone_finder():
    from timezonefinder import TimezoneFinder

    return TimezoneFinder(in_memory=False)


def resolve_timezone(lon, lat):
    return timezone_finder().timezone_at(lng=lon, lat=lat) or "UTC"


def get_routes(origin, destination, departure):
    params = {
        "access_token": mapbox_token(),
        "alternatives": "true",
        "geometries": "geojson",
        "overview": "full",
        "annotations": "distance,duration",
        "steps": "true",
        "depart_at": departure.replace(microsecond=0).isoformat(),
    }

    def request(points, extra=None):
        coords = ";".join(",".join(str(v) for v in p) for p in points)
        return get_json(
            f"https://api.mapbox.com/directions/v5/mapbox/driving/{coords}",
            {**params, **(extra or {})},
        )

    data = request([origin, destination])
    if data.get("code") == "NoRoute" or not data.get("routes"):
        raise ProviderError("No driving route was found. Try different locations.", 422)
    if data.get("code") != "Ok":
        raise ProviderError("The routing service could not calculate this trip.", 422)
    routes = data["routes"][:3]
    if len(routes) == 3:
        return routes
    fastest = min(routes, key=lambda r: r["duration"])
    length = fastest["distance"] / METERS_PER_MILE
    midpoint = sample_route(fastest, length / 2, departure)[1]["coordinates"]
    x_scale = max(5, 69.172 * math.cos(math.radians(midpoint[1])))
    dx, dy = (destination[0] - origin[0]) * x_scale, (destination[1] - origin[1]) * 69
    direction_length = math.hypot(dx, dy)
    if not direction_length:
        return routes
    offset = min(80, length * 0.10)
    for side in [1, -1]:
        waypoint = [
            midpoint[0] - side * offset * dy / direction_length / x_scale,
            midpoint[1] + side * offset * dx / direction_length / 69,
        ]
        if not (-180 <= waypoint[0] <= 180 and -85 <= waypoint[1] <= 85):
            continue
        try:
            # Guide through the corridor point without a stop or an extra leg.
            extra = request(
                [origin, waypoint, destination],
                {"waypoints": "0;2", "continue_straight": "true"},
            )
            if extra.get("code") != "Ok":
                continue
            for candidate in sorted(extra.get("routes", []), key=lambda r: r["duration"]):
                if suitable_alternative(candidate, fastest, routes):
                    routes.append(candidate)
                    if len(routes) == 3:
                        return routes
        except ProviderError:
            # An optional alternative must not discard already usable routes.
            break
        except (ValueError, KeyError, IndexError, TypeError):
            continue
    return routes


def route_edges(route):
    coordinates = route["geometry"]["coordinates"]
    distances = [d for leg in route["legs"] for d in leg["annotation"]["distance"]]
    if len(distances) != len(coordinates) - 1:
        raise ValueError("Inconsistent route annotations")
    edges, repeated = {}, 0.0
    for a, b, distance in zip(coordinates, coordinates[1:], distances):
        if not math.isfinite(distance) or distance < 0:
            raise ValueError("Invalid route distance")
        edge = tuple(sorted(tuple(round(v, 5) for v in p) for p in [a, b]))
        if edge[0] == edge[1]:
            continue
        if edge in edges:
            repeated += distance
        edges[edge] = edges.get(edge, 0) + distance
    return edges, repeated


def suitable_alternative(candidate, fastest, accepted):
    if not (0 < candidate["distance"] <= fastest["distance"] * 1.25) or not (
        0 < candidate["duration"] <= fastest["duration"] * 1.35
    ):
        return False
    if any(
        step.get("maneuver", {}).get("modifier") == "uturn"
        for leg in candidate["legs"]
        for step in leg.get("steps", [])
    ):
        return False
    edges, repeated = route_edges(candidate)
    total = sum(edges.values())
    if not total or repeated / total > 0.02:
        return False
    for route in accepted:
        other, _ = route_edges(route)
        shorter = min(total, sum(other.values()))
        shared = sum(min(distance, other.get(edge, 0)) for edge, distance in edges.items())
        if not shorter or shared / shorter > 0.90:
            return False
    return True
