import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import RouteMap from './RouteMap'
import type { Route } from '../types'

const mapTest = vi.hoisted(() => ({
  failWebGL: true,
  handlers: new Map<string, Array<(event: Record<string, unknown>) => void>>(),
  features: [] as Array<{ layer: { id: string }; properties: Record<string, unknown> }>,
  easeTo: vi.fn(),
  project: vi.fn(() => ({ x: 20, y: 40 })),
}))

vi.mock('mapbox-gl', () => ({
  default: {
    Map: class {
      constructor() {
        if (mapTest.failWebGL) throw new Error('Failed to initialize WebGL')
      }
      on(
        type: string,
        layerOrListener: string | ((event: Record<string, unknown>) => void),
        listener?: (event: Record<string, unknown>) => void,
      ) {
        const key = typeof layerOrListener === 'string' ? `${type}:${layerOrListener}` : type
        const callback = listener || (layerOrListener as (event: Record<string, unknown>) => void)
        mapTest.handlers.set(key, [...(mapTest.handlers.get(key) || []), callback])
      }
      getStyle() {
        return { layers: [] }
      }
      addControl() {}
      addSource() {}
      addLayer() {}
      setFilter() {}
      setLayoutProperty() {}
      fitBounds() {}
      easeTo = mapTest.easeTo
      project = mapTest.project
      getSource() {
        return { setData() {} }
      }
      getLayer() {
        return undefined
      }
      queryRenderedFeatures() {
        return mapTest.features
      }
      resize() {}
      remove() {}
    },
    NavigationControl: class {},
    AttributionControl: class {},
    LngLatBounds: class {
      extend() {}
    },
    Marker: class {
      setLngLat() {
        return this
      }
      addTo() {
        return this
      }
      remove() {}
    },
  },
}))

beforeEach(() => {
  mapTest.failWebGL = true
  mapTest.handlers.clear()
  mapTest.features = []
  mapTest.easeTo.mockReset()
  mapTest.project.mockReset().mockReturnValue({ x: 20, y: 40 })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})

function emit(type: string, event: Record<string, unknown> = {}) {
  act(() => {
    for (const handler of mapTest.handlers.get(type) || []) handler(event)
  })
}

it('shows an actionable map error without crashing the surrounding trip results', () => {
  render(
    <div>
      <h2>Route results</h2>
      <RouteMap
        routes={[]}
        selected="A"
        token="pk.test"
        corridor={null}
        hour={0}
        weatherVisible
        checkpoint={null}
        onRouteSelect={() => {}}
        onCheckpointSelect={() => {}}
        onCheckpointDismiss={() => {}}
      />
    </div>,
  )
  expect(screen.getByRole('heading', { name: 'Route results' })).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent(/WebGL/i)
  expect(screen.getByRole('alert')).toHaveTextContent(/restart/i)
})

const route: Route = {
  id: 'A',
  name: 'I-20 E',
  geometry: {
    type: 'LineString' as const,
    coordinates: [
      [-96, 32],
      [-84, 33],
    ],
  },
  distance_miles: 780,
  duration_seconds: 45600,
  arrival: '2026-10-12T22:40:00Z',
  checkpoints: [
    {
      index: 1,
      mile: 0,
      coordinates: [-96, 32] as [number, number],
      eta: '2026-10-12T10:00:00Z',
      weather: { wind_mph: 38, rain_in_hr: 0.08, snow_in_hr: 0 },
      risk: { level: 3, label: 'Severe', reasons: ['High wind'] },
    },
  ],
  summary: {
    risk_miles: [700, 50, 30, 0, 0],
    severe_miles: 0,
    high_miles: 30,
    no_travel_miles: 0,
    unknown_miles: 0,
    average_risk: 0.2,
    complete: true,
    highest_risk: 2,
    segments: [],
  },
}

function loadMap() {
  mapTest.failWebGL = false
  const callbacks = {
    onRouteSelect: vi.fn(),
    onCheckpointSelect: vi.fn(),
    onCheckpointDismiss: vi.fn(),
  }
  render(
    <RouteMap
      routes={[route]}
      selected="A"
      token="pk.test"
      corridor={null}
      hour={0}
      weatherVisible
      checkpoint={route.checkpoints[0]}
      {...callbacks}
    />,
  )
  emit('load')
  return callbacks
}

it('dismisses checkpoint weather on an empty map click', () => {
  const callbacks = loadMap()
  emit('click', { point: { x: 20, y: 40 } })
  expect(callbacks.onCheckpointDismiss).toHaveBeenCalledOnce()
  expect(callbacks.onCheckpointSelect).not.toHaveBeenCalled()
  expect(callbacks.onRouteSelect).not.toHaveBeenCalled()
})

it('prioritizes checkpoint hits over an overlapping route without dismissing them', () => {
  const callbacks = loadMap()
  mapTest.features = [
    { layer: { id: 'route-lines' }, properties: { id: 'A' } },
    { layer: { id: 'checkpoint-points' }, properties: { route_id: 'A', index: 0 } },
  ]
  emit('click', { point: { x: 20, y: 40 } })
  expect(callbacks.onCheckpointSelect).toHaveBeenCalledWith('A', 0)
  expect(callbacks.onRouteSelect).not.toHaveBeenCalled()
  expect(callbacks.onCheckpointDismiss).not.toHaveBeenCalled()
})

it('selects a clicked route when there is no checkpoint hit', () => {
  const callbacks = loadMap()
  mapTest.features = [{ layer: { id: 'route-lines' }, properties: { id: 'A' } }]
  emit('click', { point: { x: 20, y: 40 } })
  expect(callbacks.onRouteSelect).toHaveBeenCalledWith('A')
  expect(callbacks.onCheckpointSelect).not.toHaveBeenCalled()
})

it('selects the nearest checkpoint within reach and ignores ones outside reach', () => {
  const callbacks = loadMap()
  mapTest.features = [
    { layer: { id: 'checkpoint-points' }, properties: { route_id: 'A', index: 0 } },
    { layer: { id: 'checkpoint-points' }, properties: { route_id: 'A', index: 0 } },
  ]
  mapTest.project.mockReturnValueOnce({ x: 60, y: 40 }).mockReturnValueOnce({ x: 30, y: 40 })
  emit('click', { point: { x: 20, y: 40 } })
  expect(callbacks.onCheckpointSelect).toHaveBeenCalledWith('A', 0)
  callbacks.onCheckpointSelect.mockClear()
  mapTest.project.mockReturnValue({ x: 60, y: 40 })
  emit('click', { point: { x: 20, y: 40 } })
  expect(callbacks.onCheckpointSelect).not.toHaveBeenCalled()
  expect(callbacks.onCheckpointDismiss).toHaveBeenCalledOnce()
})

it('keeps automatic checkpoint camera moves open and dismisses a user move', () => {
  const callbacks = loadMap()
  expect(mapTest.easeTo).toHaveBeenCalledWith({ center: [-96, 32], duration: 500 })
  emit('movestart')
  emit('move')
  expect(callbacks.onCheckpointDismiss).not.toHaveBeenCalled()
  emit('move', { originalEvent: new MouseEvent('mousemove') })
  expect(callbacks.onCheckpointDismiss).toHaveBeenCalledOnce()
})

it('dismisses checkpoint weather when fitting routes', () => {
  const callbacks = loadMap()
  fireEvent.click(screen.getByRole('button', { name: 'Fit routes' }))
  expect(callbacks.onCheckpointDismiss).toHaveBeenCalledOnce()
})
