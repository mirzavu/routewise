import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import type { FeatureCollection, Feature, Point, LineString } from 'geojson'
import { Expand, MapPin } from 'lucide-react'
import { RISK_COLORS, ROUTE_COLORS } from '../types'
import type { Checkpoint, Corridor, Route } from '../types'
import 'mapbox-gl/dist/mapbox-gl.css'

interface Props {
  routes: Route[]
  selected: string
  token: string
  corridor: Corridor | null
  hour: number
  weatherVisible: boolean
  checkpoint: Checkpoint | null
  onRouteSelect: (id: string) => void
  onCheckpointSelect: (id: string, index: number) => void
}
export default function RouteMap(props: Props) {
  const element = useRef<HTMLDivElement>(null),
    mapRef = useRef<mapboxgl.Map | null>(null),
    live = useRef(props),
    canvas = useRef<HTMLCanvasElement | null>(null)
  live.current = props
  const [loaded, setLoaded] = useState(false),
    [error, setError] = useState('')
  function fit() {
    const map = mapRef.current
    if (!map) return
    const bounds = new mapboxgl.LngLatBounds()
    live.current.routes.forEach((r) => r.geometry.coordinates.forEach((c) => bounds.extend(c)))
    map.fitBounds(bounds, {
      padding: { top: 140, bottom: 200, left: 60, right: 60 },
      duration: 600,
      maxZoom: 11,
    })
  }
  useEffect(() => {
    if (!element.current || !props.token) return
    const map = new mapboxgl.Map({
      container: element.current,
      accessToken: props.token,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-90.5, 34],
      zoom: 4,
      attributionControl: false,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    const resize = new ResizeObserver(() => map.resize())
    resize.observe(element.current)
    map.on('error', (e) => {
      if (/401|403|token|unauthorized/i.test(e.error.message))
        setError('Map access was denied. Check the public Mapbox token and its URL restrictions.')
    })
    map.on('load', () => {
      const lines: FeatureCollection<LineString> = {
        type: 'FeatureCollection',
        features: live.current.routes.map((r) => ({
          type: 'Feature',
          geometry: r.geometry,
          properties: { id: r.id, color: ROUTE_COLORS[r.id] },
        })),
      }
      map.addSource('routes', { type: 'geojson', data: lines })
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': 8,
          'line-opacity': 0.95,
        },
      })
      map.addLayer({
        id: 'route-lines',
        type: 'line',
        source: 'routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4,
          'line-opacity': 0.8,
        },
      })
      map.addSource('selected-route', {
        type: 'geojson',
        data: lines.features[0],
      })
      map.addLayer({
        id: 'selected-casing',
        type: 'line',
        source: 'selected-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#fff', 'line-width': 10 },
      })
      map.addLayer({
        id: 'selected-line',
        type: 'line',
        source: 'selected-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 5 },
      })
      map.addSource('checkpoints', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'checkpoint-points',
        type: 'circle',
        source: 'checkpoints',
        paint: {
          'circle-radius': ['case', ['get', 'selected'], 5, 3],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
          'circle-opacity': ['case', ['get', 'selected'], 1, 0.5],
        },
      })
      const route = live.current.routes[0]
      const ends = [route.geometry.coordinates[0], route.geometry.coordinates.at(-1)!]
      ends.forEach((c, i) => {
        const el = document.createElement('div')
        el.className = `map-endpoint ${i ? 'destination' : 'origin'}`
        el.textContent = i ? 'B' : 'A'
        el.title = i ? 'Destination' : 'Origin'
        new mapboxgl.Marker({ element: el }).setLngLat(c).addTo(map)
      })
      map.on('click', 'route-lines', (e) => {
        const id = e.features?.[0]?.properties?.id
        if (id) live.current.onRouteSelect(id)
      })
      map.on('click', 'checkpoint-points', (e) => {
        const p = e.features?.[0]?.properties
        if (p) live.current.onCheckpointSelect(p.route_id, Number(p.index))
      })
      for (const id of ['route-lines', 'checkpoint-points']) {
        map.on('mouseenter', id, () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', id, () => {
          map.getCanvas().style.cursor = ''
        })
      }
      setLoaded(true)
      fit()
    })
    return () => {
      resize.disconnect()
      map.remove()
      mapRef.current = null
      setLoaded(false)
    }
  }, [props.token, props.routes])
  useEffect(() => {
    const map = mapRef.current
    if (!loaded || !map) return
    const route = props.routes.find((r) => r.id === props.selected)!
    const line: Feature<LineString> = {
      type: 'Feature',
      geometry: route.geometry,
      properties: { id: route.id, color: ROUTE_COLORS[route.id] },
    }
    ;(map.getSource('selected-route') as mapboxgl.GeoJSONSource).setData(line)
    const points: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: props.routes.flatMap((r) =>
        r.checkpoints.map((p, i) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: p.coordinates },
          properties: {
            route_id: r.id,
            index: i,
            selected: r.id === props.selected,
            color: p.risk.level === null ? '#94a3b8' : RISK_COLORS[p.risk.level],
          },
        })),
      ),
    }
    ;(map.getSource('checkpoints') as mapboxgl.GeoJSONSource).setData(points)
  }, [loaded, props.selected, props.routes])
  useEffect(() => {
    if (props.checkpoint && loaded)
      mapRef.current?.easeTo({
        center: props.checkpoint.coordinates,
        duration: 500,
      })
  }, [props.checkpoint, loaded])
  useEffect(() => {
    const map = mapRef.current
    if (!loaded || !map) return
    if (map.getLayer('weather-layer'))
      map.setLayoutProperty(
        'weather-layer',
        'visibility',
        props.weatherVisible ? 'visible' : 'none',
      )
    if (!props.corridor) return
    const data = props.corridor
    if (!canvas.current) {
      canvas.current = document.createElement('canvas')
      canvas.current.width = 240
      canvas.current.height = 160
    }
    paintWeather(canvas.current, data, props.hour)
    if (!map.getSource('weather')) {
      const [west, south, east, north] = data.bounds
      map.addSource('weather', {
        type: 'canvas',
        canvas: canvas.current,
        animate: false,
        coordinates: [
          [west, north],
          [east, north],
          [east, south],
          [west, south],
        ],
      })
      map.addLayer(
        {
          id: 'weather-layer',
          type: 'raster',
          source: 'weather',
          layout: { visibility: props.weatherVisible ? 'visible' : 'none' },
          paint: { 'raster-opacity': 0.65, 'raster-fade-duration': 180 },
        },
        'route-casing',
      )
    }
    const source = map.getSource('weather') as mapboxgl.CanvasSource
    source.play()
    map.once('render', () => source.pause())
    map.triggerRepaint()
  }, [loaded, props.corridor, props.hour, props.weatherVisible])
  return (
    <>
      <div className="route-map" ref={element} />
      {!props.token && (
        <div className="map-unavailable">
          <MapPin size={28} />
          <h3>Map connection needed</h3>
          <p>Configure the public Mapbox token to display the interactive map.</p>
        </div>
      )}
      {error && (
        <div className="map-service-error" role="alert">
          {error}
        </div>
      )}
      {props.token && (
        <button className="fit-routes" onClick={fit}>
          <Expand size={15} />
          Fit routes
        </button>
      )}
    </>
  )
}

// Interpolate only the display field. Route risk always uses checkpoint forecasts.
function paintWeather(canvas: HTMLCanvasElement, data: Corridor, hour: number) {
  const context = canvas.getContext('2d')!
  const width = canvas.width,
    height = canvas.height
  const image = context.createImageData(width, height),
    [west, south, east, north] = data.bounds
  const colors = RISK_COLORS.map((c) => [
    parseInt(c.slice(1, 3), 16),
    parseInt(c.slice(3, 5), 16),
    parseInt(c.slice(5, 7), 16),
  ])
  const cos = Math.cos((((north + south) / 2) * Math.PI) / 180),
    radius = Math.max(30, data.spacing_miles * 0.85)
  for (let y = 0; y < height; y++) {
    const lat = north - (y / (height - 1)) * (north - south)
    for (let x = 0; x < width; x++) {
      const lon = west + (x / (width - 1)) * (east - west)
      let sum = 0,
        weight = 0,
        nearest = Infinity
      data.points.forEach((p, i) => {
        const level = data.frames[hour]?.[i]
        if (level === null || level === undefined) return
        const d = ((p[0] - lon) * 69 * cos) ** 2 + ((p[1] - lat) * 69) ** 2
        nearest = Math.min(nearest, d)
        if (d > radius * radius) return
        const w = 1 / Math.max(d, 1)
        sum += level * w
        weight += w
      })
      if (!weight) continue
      const value = sum / weight,
        lo = Math.floor(value),
        hi = Math.min(4, lo + 1),
        fraction = value - lo
      const index = (y * width + x) * 4
      for (let k = 0; k < 3; k++)
        image.data[index + k] = colors[lo][k] * (1 - fraction) + colors[hi][k] * fraction
      image.data[index + 3] = Math.round(
        (value < 0.5 ? 32 : 150) * Math.max(0, 1 - nearest / (radius * radius)),
      )
    }
  }
  context.putImageData(image, 0, 0)
}
