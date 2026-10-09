import time
from functools import lru_cache

import httpx
from django.conf import settings


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
    coords = ";".join(",".join(str(v) for v in p) for p in [origin, destination])
    data = get_json(
        f"https://api.mapbox.com/directions/v5/mapbox/driving/{coords}",
        {
            "access_token": mapbox_token(),
            "alternatives": "true",
            "geometries": "geojson",
            "overview": "full",
            "annotations": "distance,duration",
            "steps": "true",
            "depart_at": departure.isoformat(),
        },
    )
    if data.get("code") == "NoRoute" or not data.get("routes"):
        raise ProviderError("No driving route was found. Try different locations.", 422)
    if data.get("code") != "Ok":
        raise ProviderError("The routing service could not calculate this trip.", 422)
    return data["routes"][:3]
