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
  Package,
  SlidersHorizontal,
} from 'lucide-react'
import { DateTime } from 'luxon'
import Brand from './Brand'
import RouteMap from './RouteMap'
import CheckpointPanel from './CheckpointPanel'
import ForecastTimeline from './ForecastTimeline'
import { api } from '../api'
import { city, duration, localTime, miles, routeName, toTripInput } from '../format'
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
  const [visibleRoutes, setVisibleRoutes] = useState(result.routes.map((r) => r.id))
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
    const { departure, load_lb } = toTripInput(trip)
    api<Corridor>('/weather/corridor', { routes: lines, load_lb, departure }, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setCorridor(data)
      })
      .catch((e) => {
        if (!controller.signal.aborted && e.name !== 'AbortError') setWeatherError(e.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setWeatherLoading(false)
      })
    return () => controller.abort()
  }, [result, trip.load, trip.date, trip.time, trip.timezone, retry])
  function select(id: string) {
    setSelected(id)
    setVisibleRoutes((ids) => (ids.includes(id) ? ids : [...ids, id]))
    setCheckpoint(null)
    setShowCheckpoints(false)
  }
  const recommendation = result.recommendation
  const recommendedRoute = result.routes.find((r) => r.id === recommendation.route_id)
  const departure = DateTime.fromISO(`${trip.date}T${trip.time}`, { zone: trip.timezone })
  const point = checkpoint === null ? null : route.checkpoints[checkpoint]
  return (
    <div className="workspace">
      <header className="workspace-header">
        <Brand onClick={onHome} />
        <nav>
          <span className="active">Plan Trip</span>
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
        <div className="workspace-map-layer">
          <RouteMap
            routes={result.routes}
            selected={route.id}
            visibleRoutes={visibleRoutes}
            originLabel={city(trip.origin?.label || '')}
            destinationLabel={city(trip.destination?.label || '')}
            token={token}
            corridor={corridor}
            hour={hour}
            weatherVisible={weatherVisible}
            checkpoint={point}
            onRouteSelect={select}
            onCheckpointDismiss={() => setCheckpoint(null)}
            onCheckpointSelect={(id, index) => {
              setSelected(id)
              setCheckpoint(index)
            }}
          />
        </div>
        <aside className="trip-sidebar">
          <section className="trip-summary">
            <div className="section-heading">
              <h2>
                <Map size={23} /> Trip Plan
              </h2>
              <button className="text-button" onClick={onEdit}>
                <Pencil size={15} />
                Edit trip
              </button>
            </div>
            <div className="summary-fields">
              {[
                {
                  label: 'Origin',
                  value: trip.origin?.label.split(',').slice(0, 2).join(',') || '',
                  icon: <MapPin className="origin-pin" />,
                },
                {
                  label: 'Destination',
                  value: trip.destination?.label.split(',').slice(0, 2).join(',') || '',
                  icon: <MapPin className="destination-pin" />,
                },
                {
                  label: 'Departure',
                  value: departure.toFormat('ccc, MMM d, h:mm a'),
                  icon: <CalendarDays />,
                },
                {
                  label: 'Cargo weight',
                  value: `${Number(trip.load.replaceAll(',', '')).toLocaleString()} lb`,
                  icon: <Package />,
                },
              ].map((field) => (
                <div className="summary-field" key={field.label}>
                  {field.icon}
                  <div className="summary-field-content">
                    <small>{field.label}</small>
                    <button
                      className="summary-field-value"
                      onClick={onEdit}
                      aria-label={`Edit ${field.label.toLowerCase()}`}
                    >
                      <span>{field.value}</span>
                      <ChevronDown size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="route-options-panel" aria-label="Route options">
            <div className="route-options-heading">
              <h2>
                <RouteIcon size={23} /> Route Options
              </h2>
              <button
                className="text-button"
                onClick={() => setRules(!rules)}
                aria-expanded={rules}
              >
                <SlidersHorizontal size={16} /> Compare routes
              </button>
            </div>
            <div className="route-cards">
              {result.routes.map((r) => {
                const active = r.id === route.id,
                  recommended = r.id === recommendation.route_id
                const level = r.summary.highest_risk
                return (
                  <section
                    className={`route-card ${active ? 'selected' : ''} ${recommended ? 'is-recommended' : ''}`}
                    key={r.id}
                    style={
                      {
                        '--route-color': ROUTE_COLORS[r.id],
                        '--badge-color': ROUTE_COLORS[r.id],
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
                            {routeName(r.name)}
                            {recommended && <span className="recommended-tag">Recommended</span>}
                          </h3>
                        </div>
                        <ChevronRight size={17} />
                      </div>
                      <div className="route-main-metrics">
                        <strong>
                          <Clock3 size={14} />
                          {duration(r.duration_seconds).replace('h ', ' hr ').replace('m', ' min')}
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
                          Weather risk:{' '}
                          <strong
                            style={{ color: level === null ? undefined : RISK_COLORS[level] }}
                          >
                            {r.summary.complete
                              ? level === null
                                ? 'Unknown'
                                : RISK_LABELS[level]
                              : 'Incomplete'}
                          </strong>
                        </span>
                        <span className="route-arrival">
                          <Clock3 size={14} /> Arrival{' '}
                          {localTime(r.arrival, trip.destination?.timezone || trip.timezone)}
                        </span>
                      </div>
                      <p className="route-description">
                        {!r.summary.complete
                          ? 'Some weather forecasts are unavailable along this route.'
                          : r.summary.highest_risk === 0
                            ? 'Low weather risk along your route at estimated arrival times.'
                            : r.summary.highest_risk === 1
                              ? 'Moderate conditions, with no high or severe weather exposure.'
                              : `${miles(r.summary.severe_miles)} mi severe and ${miles(r.summary.high_miles)} mi high weather exposure along this route.`}
                      </p>
                      {r.summary.no_travel_miles > 0 && (
                        <div className="blocked-label">
                          {miles(r.summary.no_travel_miles)} mi · No Travel conditions
                        </div>
                      )}
                    </button>
                    {active && (
                      <div className="route-extra">
                        <button
                          className="checkpoints-toggle"
                          title={`View ${r.checkpoints.length} checkpoints`}
                          aria-expanded={showCheckpoints}
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
                                aria-pressed={checkpoint === i}
                                className={checkpoint === i ? 'selected' : ''}
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
                    At 55 mph wind, all loads are No Travel. At 45–54 mph, loads over 30,000 lb are
                    No Travel. At 35–44 mph, loads over 40,000 lb are Severe.
                  </p>
                </div>
              )}
              <span>Driving estimates exclude rest stops.</span>
            </div>
          </section>
        </aside>
        <main className="map-workspace" aria-label="Route comparison map">
          <div
            className={`recommendation-banner ${recommendation.route_id ? '' : 'no-recommendation'}`}
          >
            <span className="recommendation-icon">
              {recommendation.route_id ? <Check size={22} strokeWidth={3} /> : <Info size={22} />}
            </span>
            <div className="recommendation-copy">
              <h2>
                {recommendation.route_id
                  ? `Recommended: Route ${recommendation.route_id} via ${routeName(recommendedRoute?.name || '')}`
                  : 'No route recommended'}
              </h2>
              <p>
                {recommendation.route_id
                  ? 'Best balance of travel time and weather safety'
                  : 'Review the weather conditions before departure'}
              </p>
            </div>
            <p className="recommendation-reason">{recommendation.reason}</p>
          </div>
          <div className="map-legend">
            <div>
              <CloudSun size={15} />
              <strong>Weather Forecast</strong>
              <Info size={14} />
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
            routes={result.routes}
            selectedRoute={route}
            visibleRoutes={visibleRoutes}
            onToggleRoute={(id) =>
              setVisibleRoutes((ids) =>
                ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id],
              )
            }
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
