import logging
from datetime import datetime, timedelta, timezone
from django.conf import settings
from django.http import FileResponse, HttpResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .geometry import sample_route, corridor_grid, METERS_PER_MILE
from .providers import get_locations, get_routes, ProviderError
from .risk import classify, summarize, recommend
from .serializers import TripSerializer, CorridorSerializer
from .weather import fetch_forecasts, weather_at

logger=logging.getLogger(__name__)


def error(exc):
    return Response({'message':exc.message},status=exc.status)


@api_view(['GET'])
def health(request):
    return Response({'status':'ok'})


@api_view(['GET'])
def configuration(request):
    return Response({'mapbox_public_token':settings.MAPBOX_PUBLIC_TOKEN,'routing_configured':bool(settings.MAPBOX_ACCESS_TOKEN)})


@api_view(['GET'])
def locations(request):
    query=request.query_params.get('q','').strip()
    if len(query)<3: return Response({'locations':[]})
    if len(query)>256 or ';' in query:
        return Response({'message':'Please shorten the location search.'},status=400)
    try: return Response({'locations':get_locations(query)})
    except ProviderError as exc: return error(exc)


@api_view(['POST'])
def analyze(request):
    serializer=TripSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'message':'Please check your trip details.','fields':serializer.errors},status=400)
    trip=serializer.validated_data
    try:
        raw=get_routes(trip['origin']['coordinates'],trip['destination']['coordinates'],trip['departure'])
        routes=[]
        for index,route in enumerate(raw):
            checkpoints=sample_route(route,trip['spacing_miles'],trip['departure'])
            routes.append({'id':chr(65+index),'name':route['legs'][0].get('summary') or f'Route {chr(65+index)}','geometry':route['geometry'],'distance_miles':sum(l['annotation']['distance'][i] for l in route['legs'] for i in range(len(l['annotation']['distance'])))/METERS_PER_MILE,'duration_seconds':route['duration'],'arrival':checkpoints[-1]['eta'],'checkpoints':checkpoints})
        all_points=[p for r in routes for p in r['checkpoints']]
        forecasts=fetch_forecasts([p['coordinates'] for p in all_points])
        for point,forecast in zip(all_points,forecasts):
            point['weather']=weather_at(forecast,datetime.fromisoformat(point['eta']))
            w=point['weather']
            point['risk']=classify(w['wind_mph'],w['rain_in_hr'],w['snow_in_hr'],trip['load_lb'])
        for route in routes: route['summary']=summarize(route['checkpoints'])
        warnings=[]
        if len(routes)<3: warnings.append(f'The routing provider found {len(routes)} distinct route'+('s' if len(routes)>1 else '')+' for this trip.')
        if any(not r['summary']['complete'] for r in routes): warnings.append('Some arrival times have no complete weather forecast. Recommendation is unavailable.')
        return Response({'routes':routes,'recommendation':recommend(routes),'warnings':warnings,'weather_fetched_at':datetime.now(timezone.utc).isoformat()})
    except ProviderError as exc: return error(exc)
    except (ValueError,KeyError,IndexError,TypeError) as exc:
        logger.warning('Invalid provider data: %s',type(exc).__name__)
        return Response({'message':'The provider returned incomplete trip data. Please try again.'},status=502)


@api_view(['POST'])
def corridor(request):
    serializer=CorridorSerializer(data=request.data)
    if not serializer.is_valid(): return Response({'message':'Invalid weather corridor.','fields':serializer.errors},status=400)
    data=serializer.validated_data
    try:
        grid=corridor_grid(data['routes'])
        forecasts=fetch_forecasts(grid['points'])
        reference=datetime.now(timezone.utc).replace(minute=0,second=0,microsecond=0)
        times=[reference+timedelta(hours=i) for i in range(49)]
        frames=[]
        for t in times:
            levels=[]
            for forecast in forecasts:
                w=weather_at(forecast,t)
                levels.append(classify(w['wind_mph'],w['rain_in_hr'],w['snow_in_hr'],data['load_lb'])['level'])
            frames.append(levels)
        return Response({**grid,'times':[t.isoformat() for t in times],'frames':frames,'fetched_at':datetime.now(timezone.utc).isoformat()})
    except ProviderError as exc: return error(exc)


def frontend(request):
    path=settings.ROOT_DIR/'frontend/dist/index.html'
    if path.exists(): return FileResponse(path.open('rb'),content_type='text/html')
    return HttpResponse('Frontend not built. Run npm run dev in frontend for development.',status=503)
