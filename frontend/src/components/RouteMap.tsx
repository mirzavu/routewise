import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import type { FeatureCollection, Feature, Point, LineString } from 'geojson'
import { LocateFixed, MapPin } from 'lucide-react'
import { RISK_COLORS, RISK_LABELS, ROUTE_COLORS } from '../types'
import type { Checkpoint, Corridor, Route } from '../types'
import { dominantWeatherDrivers } from '../weatherRisk'
import 'mapbox-gl/dist/mapbox-gl.css'

interface Props {
  routes: Route[]
  selected: string
  token: string
  corridor: Corridor | null
  hour: number
  weatherVisible: boolean
  checkpoint: Checkpoint | null
  visibleRoutes?: string[]
  originLabel?: string
  destinationLabel?: string
  onRouteSelect: (id: string) => void
  onCheckpointSelect: (id: string, index: number) => void
  onCheckpointDismiss: () => void
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
    const mobile = (element.current?.clientWidth || 0) <= 760
    const sidebar = document.querySelector('.trip-sidebar')?.getBoundingClientRect().width || 0
    const height = element.current?.clientHeight || 800
    map.fitBounds(bounds, {
      padding: {
        top: mobile ? 145 : 175,
        bottom: Math.min(mobile ? 285 : 320, height * 0.42),
        left: mobile ? 35 : sidebar + 80,
        right: mobile ? 35 : 85,
      },
      duration: 600,
      maxZoom: 11,
    })
  }
  useEffect(() => {
    if (!element.current || !props.token) return
    setError('')
    let map: mapboxgl.Map
    try {
      map = new mapboxgl.Map({
        container: element.current,
        accessToken: props.token,
        style: 'mapbox://styles/mapbox/outdoors-v12',
        center: [-90.5, 34],
        zoom: 4,
        attributionControl: false,
      })
    } catch {
      element.current.replaceChildren()
      setError(
        'The map could not start WebGL. Check your browser’s graphics settings and restart it, or try another browser. You can still compare routes and inspect checkpoints from the list.',
      )
      return
    }
    mapRef.current = map
    // Camera animations for checkpoint selection have no original input event.
    map.on('move', (event) => {
      if (event.originalEvent && live.current.checkpoint) live.current.onCheckpointDismiss()
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    const resize = new ResizeObserver(() => map.resize())
    resize.observe(element.current)
    map.on('error', (e) => {
      if (/401|403|token|unauthorized/i.test(e.error.message))
        setError('Map access was denied. Check the public Mapbox token and its URL restrictions.')
    })
    map.on('load', () => {
      // Keep terrain legible without competing with the route and forecast layers.
      for (const layer of map.getStyle().layers || []) {
        if (layer.type === 'background')
          map.setPaintProperty(layer.id, 'background-color', '#e9eee2')
        if (layer.type === 'fill' && /landcover|landuse|national-park/.test(layer.id))
          map.setPaintProperty(layer.id, 'fill-opacity', 0.25)
        if (layer.type === 'fill' && layer.id === 'water')
          map.setPaintProperty(layer.id, 'fill-color', '#aed9ef')
        if (layer.type === 'line' && /road|bridge|tunnel/.test(layer.id))
          map.setPaintProperty(layer.id, 'line-opacity', 0.4)
      }
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
          'line-width': 5,
          'line-opacity': 0.95,
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
        paint: { 'line-color': ['get', 'color'], 'line-width': 6 },
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
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            5, ['case', ['get', 'active'], 6, 1],
            8, ['case', ['get', 'active'], 8, 4],
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': ['case', ['get', 'active'], 3, 1],
          'circle-stroke-color': '#fff',
          'circle-opacity': ['case', ['get', 'active'], 1, ['get', 'selected'], 0.5, 0.2],
        },
      })
      const route = live.current.routes[0]
      const ends = [route.geometry.coordinates[0], route.geometry.coordinates.at(-1)!]
      ends.forEach((c, i) => {
        const el = document.createElement('div')
        el.className = `map-endpoint ${i ? 'destination' : 'origin'}`
        el.title = i ? 'Destination' : 'Origin'
        const label = document.createElement('span')
        label.className = 'endpoint-label'
        label.textContent =
          (i ? live.current.destinationLabel : live.current.originLabel) || el.title
        el.append(label)
        new mapboxgl.Marker({ element: el }).setLngLat(c).addTo(map)
      })
      map.on('click', (event) => {
        // Give small dots an 18px radius for clicks without changing their appearance.
        const radius = 18
        const { x, y } = event.point
        const features = map.queryRenderedFeatures(
          [[x - radius, y - radius], [x + radius, y + radius]],
          { layers: ['checkpoint-points'] },
        )
        let nearest: { routeId: string; index: number; distance: number } | null = null
        for (const feature of features) {
          if (feature.layer?.id !== 'checkpoint-points' || !feature.properties) continue
          const routeId = String(feature.properties.route_id)
          const index = Number(feature.properties.index)
          const checkpoint = live.current.routes.find((r) => r.id === routeId)?.checkpoints[index]
          if (!checkpoint) continue
          const projected = map.project(checkpoint.coordinates)
          const distance = (projected.x - x) ** 2 + (projected.y - y) ** 2
          if (distance > radius ** 2) continue
          if (
            !nearest || distance < nearest.distance ||
            (distance === nearest.distance && routeId === live.current.selected)
          ) nearest = { routeId, index, distance }
        }
        if (nearest) {
          live.current.onCheckpointSelect(nearest.routeId, nearest.index)
          return
        }
        const route = map.queryRenderedFeatures(event.point, { layers: ['route-lines'] })
          .find((feature) => feature.layer?.id === 'route-lines')
        if (route?.properties?.id) live.current.onRouteSelect(route.properties.id)
        else live.current.onCheckpointDismiss()
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
            active: r.id === props.selected && p.index === props.checkpoint?.index,
            color: p.risk.level === null ? '#94a3b8' : RISK_COLORS[p.risk.level],
          },
        })),
      ),
    }
    ;(map.getSource('checkpoints') as mapboxgl.GeoJSONSource).setData(points)
  }, [loaded, props.selected, props.routes, props.checkpoint])
  useEffect(() => {
    const map = mapRef.current
    if (!loaded || !map) return
    const ids = props.visibleRoutes || props.routes.map((r) => r.id)
    for (const layer of ['route-casing', 'route-lines'])
      map.setFilter(layer, ['in', ['get', 'id'], ['literal', ids]])
    for (const layer of ['selected-casing', 'selected-line'])
      map.setLayoutProperty(layer, 'visibility', ids.includes(props.selected) ? 'visible' : 'none')
    map.setFilter('checkpoint-points', ['in', ['get', 'route_id'], ['literal', ids]])
    const markers: mapboxgl.Marker[] = []
    props.routes
      .filter((r) => ids.includes(r.id))
      .forEach((route) => {
        const checkpoints = route.checkpoints
        checkpoints.forEach((point, index) => {
          const level = point.risk.level
          if (level === null || level < 1) return
          const drivers = dominantWeatherDrivers(level, point.risk.components)
          const el = document.createElement('button')
          el.className = 'weather-map-marker'
          const active = route.id === props.selected && point.index === props.checkpoint?.index
          el.classList.toggle('selected', active)
          el.setAttribute('aria-pressed', String(active))
          const condition = drivers.map(({ label }) => label).join(' + ') || 'Risk details unavailable'
          el.title = `Route ${route.id} · Checkpoint ${point.index} · ${condition} · ${RISK_LABELS[level]} risk at estimated arrival`
          el.setAttribute('aria-label', el.title)
          el.style.setProperty(
            '--marker-color',
            RISK_COLORS[level],
          )
          const symbols = document.createElement('span')
          symbols.className = 'weather-marker-icons'
          const icons = drivers.length ? drivers : [{ paths: ['M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01'] }]
          for (const { paths } of icons) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
            svg.setAttribute('viewBox', '0 0 24 24')
            svg.setAttribute('fill', 'none')
            svg.setAttribute('stroke', 'currentColor')
            svg.setAttribute('stroke-linecap', 'round')
            svg.setAttribute('stroke-linejoin', 'round')
            svg.setAttribute('aria-hidden', 'true')
            for (const d of paths) {
              const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
              path.setAttribute('d', d)
              svg.append(path)
            }
            symbols.append(svg)
          }
          el.append(symbols)
          el.addEventListener('click', (event) => {
            event.stopPropagation()
            live.current.onCheckpointSelect(route.id, index)
          })
          markers.push(new mapboxgl.Marker({ element: el }).setLngLat(point.coordinates).addTo(map))
          el.setAttribute('role', 'button')
        })
        const midpoint = checkpoints[Math.floor(checkpoints.length * 0.55)]
        if (midpoint && route.id !== props.selected) {
          const el = document.createElement('button')
          el.className = 'map-route-badge'
          el.textContent = route.id
          el.style.setProperty('--route-color', ROUTE_COLORS[route.id])
          el.setAttribute('aria-label', `Select Route ${route.id}`)
          el.addEventListener('click', () => live.current.onRouteSelect(route.id))
          markers.push(
            new mapboxgl.Marker({ element: el }).setLngLat(midpoint.coordinates).addTo(map),
          )
          el.setAttribute('role', 'button')
        }
      })
    return () => markers.forEach((marker) => marker.remove())
  }, [loaded, props.routes, props.selected, props.visibleRoutes, props.checkpoint])
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
      {props.token && loaded && (
        <button
          className="fit-routes"
          onClick={() => {
            live.current.onCheckpointDismiss()
            fit()
          }}
          aria-label="Fit routes"
          title="Fit routes"
        >
          <LocateFixed size={21} />
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
