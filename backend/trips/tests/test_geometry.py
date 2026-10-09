from datetime import datetime, timezone
import pytest
from trips.geometry import sample_route, corridor_grid


def sample():
    return {'geometry':{'coordinates':[[0,0],[1,0],[2,0]]},'legs':[{'annotation':{'distance':[16093.44,16093.44],'duration':[600,1800]}}], 'distance':32186.88, 'duration':2400}

@pytest.mark.parametrize('spacing,miles', [(10,[0,10,20]),(25,[0,20]),(50,[0,20])])
def test_checkpoint_distances_include_endpoints(spacing,miles):
    result = sample_route(sample(), spacing, datetime(2026,1,1,tzinfo=timezone.utc))
    assert [p['mile'] for p in result] == pytest.approx(miles)


def test_eta_uses_road_segment_durations():
    result = sample_route(sample(), 10, datetime(2026,1,1,tzinfo=timezone.utc))
    assert result[1]['eta'] == '2026-01-01T00:10:00+00:00'
    assert result[2]['eta'] == '2026-01-01T00:40:00+00:00'
    assert result[1]['coordinates'] == [1,0]


def test_grid_is_bounded_and_includes_surrounding_area():
    grid = corridor_grid([[[-100,35],[-90,35]]])
    assert 1 < len(grid['points']) <= 150
    assert any(abs(p[1]-35)>.05 for p in grid['points'])


def test_final_partial_interval_and_zero_length_vertices():
    r=sample()
    r['geometry']['coordinates'].insert(0,[0,0])
    r['legs'][0]['annotation']['distance'].insert(0,0)
    r['legs'][0]['annotation']['duration'].insert(0,0)
    result = sample_route(r, 15, datetime(2026,1,1,tzinfo=timezone.utc))
    assert [p['mile'] for p in result] == pytest.approx([0,15,20])
    assert result[1]['eta'] == '2026-01-01T00:25:00+00:00'
