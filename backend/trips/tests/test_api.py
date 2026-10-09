from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import pytest
from rest_framework.test import APIClient

@pytest.fixture
def client():
    return APIClient()

def payload():
    return {'origin':{'label':'Dallas, TX','coordinates':[-96.8,32.8],'timezone':'America/Chicago'},'destination':{'label':'Atlanta, GA','coordinates':[-84.4,33.75],'timezone':'America/New_York'},'departure':(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat(),'load_lb':36000,'spacing_miles':25}

def test_health(client):
    assert client.get('/api/health').status_code==200

@pytest.mark.parametrize('field,value',[('load_lb',-1),('spacing_miles',15),('departure','2020-01-01T00:00:00Z'),('load_lb','NaN')])
def test_invalid_inputs(client,field,value):
    data=payload(); data[field]=value
    assert client.post('/api/trips/analyze',data,format='json').status_code==400


def test_missing_key_is_actionable(client,settings):
    settings.MAPBOX_ACCESS_TOKEN=''
    r=client.post('/api/trips/analyze',payload(),format='json')
    assert r.status_code==503
    assert 'Mapbox' in r.json()['message']


def test_live_analysis_contract(client):
    now=datetime.now(timezone.utc).replace(minute=0,second=0,microsecond=0)
    forecast={'times':[(now+timedelta(hours=i)).timestamp() for i in range(12)],'wind':[10]*12,'rain':[0]*12,'snow':[0]*12}
    route={'geometry':{'type':'LineString','coordinates':[[-96.8,32.8],[-96,33]]},'legs':[{'summary':'I-20 E','annotation':{'distance':[50000],'duration':[2000]}}],'distance':50000,'duration':2000}
    with patch('trips.views.get_routes',return_value=[route]), patch('trips.views.fetch_forecasts',side_effect=lambda points:[forecast for _ in points]):
        r=client.post('/api/trips/analyze',payload(),format='json')
    assert r.status_code==200, r.content
    data=r.json()
    assert len(data['routes'])==1
    assert data['recommendation']['route_id']=='A'
    assert len(data['routes'][0]['checkpoints'])==3
    assert data['warnings']
    assert data['routes'][0]['summary']['high_miles']==0


def test_corridor_rejects_unbounded_input(client):
    r=client.post('/api/weather/corridor',{'routes':[[[0,0],[190,4]]],'load_lb':0},format='json')
    assert r.status_code==400
