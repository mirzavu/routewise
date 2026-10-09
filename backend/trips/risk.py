"""Assessment thresholds. Never round weather before classification."""
import math

LABELS = ['Low', 'Moderate', 'High', 'Severe', 'No Travel']


def classify(wind, rain, snow, load):
    values = [wind, rain, snow]
    if any(v is None or not math.isfinite(v) or v < 0 for v in values):
        return {'level': None, 'label': 'Unknown', 'reasons': ['Weather coverage is incomplete.']}
    w = sum(wind >= t for t in [25, 35, 45, 55])
    r = 4 if rain > 1 else sum(rain >= t for t in [.10, .25, .50])
    s = 4 if snow > 3 else sum(snow >= t for t in [.5, 1, 2])
    reasons = []
    if wind >= 55:
        reasons.append('Wind at or above 55 mph creates No Travel conditions for any load.')
    elif wind >= 45 and load > 30000:
        w = 4
        reasons.append('Wind of 45–54 mph with a load over 30,000 lb creates No Travel conditions.')
    elif 35 <= wind < 45 and load > 40000:
        w = 3
        reasons.append('Wind of 35–44 mph with a load over 40,000 lb increases risk to Severe.')
    elif w:
        reasons.append(f'{wind:.1f} mph wind is {LABELS[w].lower()} risk.')
    if r:
        reasons.append(f'{rain:.2f} in/hr rainfall is {LABELS[r].lower()} risk.')
    if s:
        reasons.append(f'{snow:.2f} in/hr snowfall is {LABELS[s].lower()} risk.')
    return {'level': max(w, r, s), 'label': LABELS[max(w, r, s)], 'reasons': reasons or ['Wind, rain and snow are below the assessment’s elevated-risk thresholds.']}


def summarize(checkpoints):
    miles = [0.0]*5
    unknown = 0.0
    segments = []
    for a, b in zip(checkpoints, checkpoints[1:]):
        length = max(0, b['mile'] - a['mile'])
        levels = [a['risk']['level'], b['risk']['level']]
        level = None if None in levels else max(levels)
        if level is None:
            unknown += length
        else:
            miles[level] += length
        segments.append({'start_mile': a['mile'], 'end_mile': b['mile'], 'level': level})
    total = sum(miles) + unknown
    complete = all(p['risk']['level'] is not None for p in checkpoints)
    worst = max((p['risk']['level'] for p in checkpoints if p['risk']['level'] is not None), default=None)
    return {'risk_miles': miles, 'severe_miles': miles[3], 'high_miles': miles[2], 'no_travel_miles': miles[4], 'unknown_miles': unknown, 'average_risk': sum(i*d for i,d in enumerate(miles))/total if total and complete else None, 'complete': complete, 'highest_risk': worst, 'segments': segments}


def recommend(routes):
    if not routes or any(not r['summary']['complete'] for r in routes):
        return {'route_id': None, 'reason': 'Weather coverage is incomplete. A full route comparison is unavailable.'}
    eligible = [r for r in routes if not r['summary']['no_travel_miles']]
    if not eligible:
        return {'route_id': None, 'reason': 'Every route contains No Travel conditions. Try another departure time or change your trip.'}
    best = min(eligible, key=lambda r: (r['summary']['severe_miles'], r['summary']['high_miles'], r['summary']['average_risk'], r['duration_seconds']))
    others = [r for r in eligible if r['id'] != best['id']]
    reason = 'The only route without No Travel conditions.' if not others and len(routes)>1 else 'Recommended by severe exposure, high exposure, average risk, then travel time.'
    for key, label in [('severe_miles','severe-weather miles'),('high_miles','high-risk miles'),('average_risk','average weather risk')]:
        if others and any(best['summary'][key] < r['summary'][key] for r in others):
            reason = f'The fewest {label} among routes tied on higher-priority risk measures.'
            break
        others = [r for r in others if r['summary'][key] == best['summary'][key]]
    fastest = min(eligible, key=lambda r:r['duration_seconds'])
    extra = round((best['duration_seconds']-fastest['duration_seconds'])/60)
    if extra > 0:
        reason += f' Adds {extra} minutes compared with the fastest eligible route.'
    return {'route_id': best['id'], 'reason': reason}
