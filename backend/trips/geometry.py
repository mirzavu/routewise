"""Small, dependency-free helpers for route sampling and corridor grids."""
import math
from datetime import timedelta

METERS_PER_MILE = 1609.344


def sample_route(route, spacing, departure):
    coordinates = route['geometry']['coordinates']
    distances = [d for leg in route['legs'] for d in leg['annotation']['distance']]
    durations = [d for leg in route['legs'] for d in leg['annotation']['duration']]
    if len(distances) != len(coordinates)-1 or len(durations) != len(distances):
        raise ValueError('Routing provider returned inconsistent segment annotations.')
    total = sum(distances)
    if total <= 0:
        raise ValueError('Origin and destination must form a nonzero route.')
    step = spacing*METERS_PER_MILE
    targets = [i*step for i in range(math.ceil(total/step))] + [total]
    result = []
    segment, traveled, elapsed = 0, 0.0, 0.0
    for target in targets:
        while segment < len(distances)-1 and traveled+distances[segment] <= target:
            traveled += distances[segment]
            elapsed += durations[segment]
            segment += 1
        ratio = min(1, max(0, (target-traveled)/distances[segment])) if distances[segment] else 0
        a,b = coordinates[segment:segment+2]
        result.append({'index':len(result)+1, 'mile':target/METERS_PER_MILE, 'coordinates':[a[0]+ratio*(b[0]-a[0]), a[1]+ratio*(b[1]-a[1])], 'eta':(departure+timedelta(seconds=elapsed+ratio*durations[segment])).isoformat()})
    return result


def corridor_grid(routes):
    coords = [p for line in routes for p in line]
    mid_lat = sum(p[1] for p in coords)/len(coords)
    x_scale = 69.172*math.cos(math.radians(mid_lat))
    x_scale = max(x_scale, 5)
    projected = [[(p[0]*x_scale,p[1]*69) for p in line] for line in routes]
    segments = [(a,b) for line in projected for a,b in zip(line,line[1:])]
    # Subsample only the visualization geometry; route checkpoints use full geometry.
    bounds = [min(p[0] for p in coords)-25/x_scale, min(p[1] for p in coords)-25/69, max(p[0] for p in coords)+25/x_scale, max(p[1] for p in coords)+25/69]
    def distance2(x,y,a,b):
        dx,dy=b[0]-a[0],b[1]-a[1]
        t=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy))) if dx or dy else 0
        return (x-a[0]-t*dx)**2+(y-a[1]-t*dy)**2
    spacing=25.0
    while True:
        points=[]
        nx=max(1,math.ceil((bounds[2]-bounds[0])*x_scale/spacing))
        ny=max(1,math.ceil((bounds[3]-bounds[1])*69/spacing))
        for j in range(ny+1):
            lat=bounds[1]+j*(bounds[3]-bounds[1])/ny
            for i in range(nx+1):
                lon=bounds[0]+i*(bounds[2]-bounds[0])/nx
                if any(distance2(lon*x_scale,lat*69,a,b)<=25**2 for a,b in segments):
                    points.append([round(lon,5),round(lat,5)])
        if len(points)<=150:
            if not points:
                points=[coords[0],coords[-1]]
            return {'points':points,'bounds':bounds,'spacing_miles':spacing}
        spacing *= 1.3
