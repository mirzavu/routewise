import bisect
import hashlib
import math
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from django.core.cache import cache

from .providers import get_json


def normalize(payload):
    hourly = payload.get("hourly", {})
    units = payload.get("hourly_units", {})
    times = hourly.get("time", [])

    def values(name, kind):
        unit = units.get(name, "")
        factors = {
            "wind": {"mph": 1, "mp/h": 1, "km/h": 1 / 1.609344, "m/s": 2.236936292},
            "rain": {"inch": 1, "in": 1, "mm": 1 / 25.4},
            "snow": {"inch": 1, "in": 1, "cm": 1 / 2.54},
        }
        factor = factors[kind].get(unit)
        raw = hourly.get(name, [])
        if not isinstance(raw, list):
            raw = []
        raw = (raw + [None] * len(times))[: len(times)]
        return [
            v * factor
            if isinstance(v, (int, float)) and math.isfinite(v) and v >= 0 and factor is not None
            else None
            for v in raw
        ]

    rain, showers = values("rain", "rain"), values("showers", "rain")
    return {
        "times": times,
        "wind": values("wind_speed_10m", "wind"),
        "rain": [a + b if a is not None and b is not None else None for a, b in zip(rain, showers)],
        "snow": values("snowfall", "snow"),
    }


def weather_at(forecast, arrival):
    unknown = {"wind_mph": None, "rain_in_hr": None, "snow_in_hr": None}
    if not forecast or not forecast["times"]:
        return unknown
    stamp = arrival.timestamp()
    times = forecast["times"]
    if stamp < times[0] or stamp > times[-1]:
        return unknown
    high = bisect.bisect_left(times, stamp)
    low = max(0, high - 1)
    a, b = forecast["wind"][low], forecast["wind"][high]
    ratio = (stamp - times[low]) / (times[high] - times[low]) if high != low else 0
    wind = (
        (a + (b - a) * ratio)
        if a is not None and b is not None
        else (b if stamp == times[high] else None)
    )
    return {
        "wind_mph": wind,
        "rain_in_hr": forecast["rain"][high],
        "snow_in_hr": forecast["snow"][high],
    }


def fetch_forecasts(points):
    hour = datetime.now(timezone.utc).strftime("%Y%m%d%H")
    unique = {tuple(round(v, 4) for v in p) for p in points}

    def key(p):
        return "weather:" + hashlib.sha256(f"{hour}:{p}".encode()).hexdigest()

    stored = {p: cache.get(key(p)) for p in unique}
    missing = [p for p in unique if stored[p] is None]
    batches = [missing[i : i + 30] for i in range(0, len(missing), 30)]

    def fetch(batch):
        data = get_json(
            "https://api.open-meteo.com/v1/forecast",
            {
                "latitude": ",".join(str(p[1]) for p in batch),
                "longitude": ",".join(str(p[0]) for p in batch),
                "hourly": "wind_speed_10m,rain,showers,snowfall",
                "wind_speed_unit": "mph",
                "precipitation_unit": "inch",
                "timezone": "GMT",
                "timeformat": "unixtime",
                "forecast_hours": 168,
                "past_hours": 1,
            },
        )
        data = data if isinstance(data, list) else [data]
        if len(data) != len(batch):
            from .providers import ProviderError

            raise ProviderError("Weather provider returned incomplete location data. Please retry.")
        return [(p, normalize(row)) for p, row in zip(batch, data)]

    with ThreadPoolExecutor(max_workers=2) as pool:
        for batch_results in pool.map(fetch, batches):
            for p, data in batch_results:
                stored[p] = data
                cache.set(key(p), data, 900)
    return [stored[tuple(round(v, 4) for v in p)] for p in points]
