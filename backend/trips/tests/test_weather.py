from datetime import datetime, timezone
import pytest
from trips.weather import weather_at, normalize


def test_arrival_interpolates_wind_but_uses_containing_rain_hour():
    forecast={'times':[0,3600,7200], 'wind':[10,30,50], 'rain':[0,.2,.6], 'snow':[0,.1,1]}
    w=weather_at(forecast,datetime.fromtimestamp(1800,timezone.utc))
    assert w == {'wind_mph':20, 'rain_in_hr':.2, 'snow_in_hr':.1}
    assert weather_at(forecast,datetime.fromtimestamp(3600,timezone.utc))['rain_in_hr']==.2
    assert weather_at(forecast,datetime.fromtimestamp(7300,timezone.utc))['wind_mph'] is None


def test_unit_conversion_and_showers():
    w=normalize({'hourly':{'time':[0], 'wind_speed_10m':[16.09344], 'rain':[2.54], 'showers':[2.54], 'snowfall':[2.54]}, 'hourly_units':{'wind_speed_10m':'km/h','rain':'mm','showers':'mm','snowfall':'cm'}})
    assert w['wind'][0]==pytest.approx(10)
    assert w['rain'][0]==pytest.approx(.2)
    assert w['snow'][0]==pytest.approx(1)


def test_missing_values_are_not_zero():
    w=normalize({'hourly':{'time':[0], 'wind_speed_10m':[None], 'rain':[0], 'snowfall':[0]},'hourly_units':{'wind_speed_10m':'mph','rain':'inch','snowfall':'inch'}})
    assert w['wind']==[None]
    assert w['rain']==[None]
