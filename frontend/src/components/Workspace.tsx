import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  CloudSun,
  Info,
  List,
  Map,
  MapPin,
  Pencil,
  Route as RouteIcon,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { DateTime } from 'luxon'
import Brand from './Brand'
import RouteMap from './RouteMap'
import CheckpointPanel from './CheckpointPanel'
import ForecastTimeline from './ForecastTimeline'
import { api } from '../api'
import { city, duration, localTime, miles } from '../format'
import { RISK_COLORS, RISK_LABELS, ROUTE_COLORS } from '../types'
import type { Analysis, Corridor, TripDraft } from '../types'

export default function Workspace({
  result,
  trip,
  token,
  onEdit,
  onHome,
}: {
  result: Analysis
  trip: TripDraft
  token: string
  onEdit: () => void
  onHome: () => void
}) {
  const [selected, setSelected] = useState(
    result.recommendation.route_id || result.routes[0]?.id || 'A',
  )
  const [checkpoint, setCheckpoint] = useState<number | null>(null),
    [showCheckpoints, setShowCheckpoints] = useState(false)
  const [corridor, setCorridor] = useState<Corridor | null>(null),
    [weatherLoading, setWeatherLoading] = useState(true),
    [weatherError, setWeatherError] = useState(''),
    [retry, setRetry] = useState(0)
  const [hour, setHour] = useState(0),
    [weatherVisible, setWeatherVisible] = useState(true),
    [mobileView, setMobileView] = useState('map'),
    [rules, setRules] = useState(false)
  const route = result.routes.find((r) => r.id === selected) || result.routes[0]
  useEffect(() => {
    const controller = new AbortController()
    setCorridor(null)
    setWeatherError('')
    setWeatherLoading(true)
    setHour(0)
    const lines = result.routes.map((r) => {
      const c = r.geometry.coordinates
      const step = Math.max(1, Math.ceil(c.length / 700))
      return c.filter((_, i) => i % step === 0 || i === c.length - 1)
    })
    api<Corridor>(
      '/weather/corridor',
      { routes: lines, load_lb: Number(trip.load.replaceAll(',', '')) },
      controller.signal,
    )
      .then(setCorridor)
      .catch((e) => {
        if (e.name !== 'AbortError') setWeatherError(e.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setWeatherLoading(false)
      })
    return () => controller.abort()
  }, [result, trip.load, retry])
  function select(id: string) {
    setSelected(id)
    setCheckpoint(null)
    setShowCheckpoints(false)
  }
  const recommendation = result.recommendation
  const point = checkpoint === null ? null : route.checkpoints[checkpoint]
  return (
    <div className="workspace">
      <header className="workspace-header">
        <Brand onClick={onHome} />
        <nav>
          <span className="active">Trip planner</span>
        </nav>
        <div className="workspace-header-right">
          <span>
            <span className="status-dot" />
            Forecasts updated {localTime(result.weather_fetched_at, trip.timezone)}
          </span>
          <button className="outline-button" onClick={onHome}>
            <ArrowLeft size={14} /> New trip
          </button>
        </div>
      </header>
      <div className="mobile-view-switch">
        <button
          className={mobileView === 'map' ? 'active' : ''}
          onClick={() => setMobileView('map')}
        >
          <Map size={15} />
          Map
        </button>
        <button
          className={mobileView === 'routes' ? 'active' : ''}
          onClick={() => setMobileView('routes')}
        >
          <List size={15} />
          Routes ({result.routes.length})
        </button>
      </div>
      <div className={`workspace-body mobile-${mobileView}`}>
        <aside className="trip-sidebar">
          <section className="trip-summary">
            <div className="section-heading">
              <h2>Your trip</h2>
              <button className="text-button" onClick={onEdit}>
                <Pencil size={13} />
                Edit trip
              </button>
            </div>
            <div className="summary-locations">
              <div>
                <span className="origin-dot" />
                <span>
                  <small>FROM</small>
                  <strong>{city(trip.origin?.label || '')}</strong>
                </span>
              </div>
              <div className="summary-location-line" />
              <div>
                <MapPin size={17} className="destination-pin" />
                <span>
                  <small>TO</small>
                  <strong>{city(trip.destination?.label || '')}</strong>
                </span>
              </div>
            </div>
            <div className="summary-meta">
              <span>
                <CalendarDays size={14} />
                {DateTime.fromISO(`${trip.date}T${trip.time}`, {
                  zone: trip.timezone,
                }).toFormat('MMM d · h:mm a ZZZZ')}
              </span>
              <span>
                <Truck size={14} />
                {Number(trip.load.replaceAll(',', '')).toLocaleString()} lb cargo
              </span>
            </div>
          </section>
          <div className="route-options-heading">
            <h2>
              Route options <span>{result.routes.length}</span>
            </h2>
            <span>{trip.spacing}-mile checks</span>
          </div>
          <div className="route-cards">
            {result.routes.map((r) => {
              const active = r.id === route.id,
                recommended = r.id === recommendation.route_id
              const level = r.summary.highest_risk
              return (
                <section
                  className={`route-card ${active ? 'selected' : ''}`}
                  key={r.id}
                  style={
                    {
                      '--route-color': ROUTE_COLORS[r.id],
                    } as React.CSSProperties
                  }
                >
                  <button
                    className="route-select"
                    aria-label={`Inspect Route ${r.id}`}
                    aria-pressed={active}
                    onClick={() => select(r.id)}
                  >
                    <div className="route-card-heading">
                      <span className="route-letter">{r.id}</span>
                      <div>
                        <h3>
                          Route {r.id}
                          {recommended && <span className="recommended-tag">Recommended</span>}
                        </h3>
                        <p>{r.name}</p>
                      </div>
                      <ChevronRight size={17} />
                    </div>
                    <div className="route-main-metrics">
                      <strong>
                        <Clock3 size={14} />
                        {duration(r.duration_seconds)}
                      </strong>
                      <span>
                        <RouteIcon size={14} />
                        {miles(r.distance_miles)} mi
                      </span>
                    </div>
                    <div className="route-risk-line">
                      <span
                        className="risk-dot"
                        style={{
                          background: level === null ? '#94a3b8' : RISK_COLORS[level],
                        }}
                      />
                      <span>
                        Peak risk:{' '}
                        <strong>
                          {r.summary.complete
                            ? level === null
                              ? 'Unknown'
                              : RISK_LABELS[level]
                            : 'Incomplete'}
                        </strong>
                      </span>
                      <span className="route-arrival">
                        {localTime(r.arrival, trip.destination?.timezone || trip.timezone)}
                      </span>
                    </div>
                    <div className="route-exposure">
                      <span>
                        <i style={{ background: RISK_COLORS[3] }} />
                        {miles(r.summary.severe_miles)} mi severe
                      </span>
                      <span>
                        <i style={{ background: RISK_COLORS[2] }} />
                        {miles(r.summary.high_miles)} mi high
                      </span>
                    </div>
                    {r.summary.no_travel_miles > 0 && (
                      <div className="blocked-label">
                        {miles(r.summary.no_travel_miles)} mi · No Travel conditions
                      </div>
                    )}
                  </button>
                  {active && (
                    <div className="route-extra">
                      <div>
                        <span>Arrival</span>
                        <strong>
                          {localTime(r.arrival, trip.destination?.timezone || trip.timezone, true)}
                        </strong>
                      </div>
                      <div>
                        <span>Average risk</span>
                        <strong>
                          {r.summary.average_risk === null
                            ? 'Unknown'
                            : `${r.summary.average_risk.toFixed(2)} / 4`}
                        </strong>
                      </div>
                      <button
                        className="checkpoints-toggle"
                        onClick={() => setShowCheckpoints(!showCheckpoints)}
                      >
                        View {r.checkpoints.length} checkpoints{' '}
                        <ChevronDown size={14} className={showCheckpoints ? 'rotated' : ''} />
                      </button>
                      {showCheckpoints && (
                        <div className="checkpoint-list">
                          {r.checkpoints.map((p, i) => (
                            <button
                              key={p.index}
                              onClick={() => {
                                setCheckpoint(i)
                                setMobileView('map')
                              }}
                            >
                              <span
                                className="risk-dot"
                                style={{
                                  background:
                                    p.risk.level === null ? '#94a3b8' : RISK_COLORS[p.risk.level],
                                }}
                              />
                              <span>
                                Checkpoint {p.index}
                                <small>
                                  {miles(p.mile)} mi · {localTime(p.eta, trip.timezone)}
                                </small>
                              </span>
                              <ChevronRight size={13} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
          {result.warnings.map((w) => (
            <p className="route-warning" key={w}>
              <Info size={14} />
              {w}
            </p>
          ))}
          <div className="sidebar-bottom">
            <button className="text-button" onClick={() => setRules(!rules)}>
              <ShieldCheck size={14} />
              How we compare routes <ChevronDown size={13} />
            </button>
            {rules && (
              <div className="rules-panel">
                <p>
                  Routes are compared in this order: Severe miles, High miles, average risk, then
                  travel time. No Travel routes are excluded.
                </p>
                <p>
                  Risk uses wind, rain, snow and cargo weight. Average risk is distance-weighted
                  from 0 (Low) to 4 (No Travel).
                </p>
                <p>
                  At 55 mph wind, all loads are No Travel. At 45–54 mph, loads over 30,000 lb are No
                  Travel. At 35–44 mph, loads over 40,000 lb are Severe.
                </p>
              </div>
            )}
            <span>Driving estimates exclude rest stops.</span>
          </div>
        </aside>
        <main className="map-workspace" aria-label="Route comparison map">
          <RouteMap
            routes={result.routes}
            selected={route.id}
            token={token}
            corridor={corridor}
            hour={hour}
            weatherVisible={weatherVisible}
            checkpoint={point}
            onRouteSelect={select}
            onCheckpointSelect={(id, index) => {
              setSelected(id)
              setCheckpoint(index)
            }}
          />
          <div
            className={`recommendation-banner ${recommendation.route_id ? '' : 'no-recommendation'}`}
          >
            <span className="recommendation-icon">
              {recommendation.route_id ? <Check size={22} strokeWidth={3} /> : <Info size={22} />}
            </span>
            <div>
              <h2>
                {recommendation.route_id
                  ? `Recommended: Route ${recommendation.route_id}`
                  : 'No route recommended'}
              </h2>
              <p>{recommendation.reason}</p>
            </div>
          </div>
          <div className="map-legend">
            <div>
              <CloudSun size={15} />
              <strong>Weather risk</strong>
            </div>
            <div className="legend-colors">
              {RISK_COLORS.map((c, i) => (
                <span key={c} style={{ background: c }} title={RISK_LABELS[i]} />
              ))}
            </div>
            <div className="legend-labels">
              <span>Low</span>
              <span>High</span>
              <span>No Travel</span>
            </div>
            <p>
              Sampled forecast ·{' '}
              {corridor ? `${Math.round(corridor.spacing_miles)} mi grid` : 'loading'}
            </p>
          </div>
          {point && (
            <CheckpointPanel
              point={point}
              count={route.checkpoints.length}
              zone={trip.timezone}
              onClose={() => setCheckpoint(null)}
              onMove={(d) =>
                setCheckpoint((i) =>
                  Math.max(0, Math.min(route.checkpoints.length - 1, (i || 0) + d)),
                )
              }
            />
          )}
          <ForecastTimeline
            data={corridor}
            hour={hour}
            onHour={setHour}
            zone={trip.timezone}
            loading={weatherLoading}
            error={weatherError}
            onRetry={() => setRetry((i) => i + 1)}
            visible={weatherVisible}
            onVisible={() => setWeatherVisible((v) => !v)}
          />
          <div className="weather-attribution">
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Weather: Open-Meteo
            </a>
            <ArrowRight size={9} />
            <span>Forecast, not radar</span>
          </div>
        </main>
      </div>
    </div>
  )
}
