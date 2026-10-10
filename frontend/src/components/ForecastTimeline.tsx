import {
  ChevronLeft,
  ChevronRight,
  Cloud,
  CircleHelp,
  Eye,
  EyeOff,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { DateTime } from 'luxon'
import type { Corridor, Route } from '../types'
import { RISK_COLORS, RISK_LABELS, ROUTE_COLORS } from '../types'
import { localTime } from '../format'
import { dominantWeatherDrivers } from '../weatherRisk'

export default function ForecastTimeline({
  data,
  hour,
  onHour,
  zone,
  loading,
  error,
  onRetry,
  visible,
  onVisible,
  routes,
  selectedRoute,
  visibleRoutes,
  onToggleRoute,
}: {
  data: Corridor | null
  hour: number
  onHour: (hour: number) => void
  zone: string
  loading: boolean
  error: string
  onRetry: () => void
  visible: boolean
  onVisible: () => void
  routes: Route[]
  selectedRoute: Route
  visibleRoutes: string[]
  onToggleRoute: (id: string) => void
}) {
  // Icons and the band share the peak risk across corridor samples at each hour.
  const peakRisk = (index: number) => {
    const levels = data?.frames[index]?.filter((v): v is number => v !== null) || []
    return levels.length ? Math.max(...levels) : null
  }
  const riskColor = (index: number) => {
    const level = peakRisk(index)
    return level === null ? '#dce7f3' : RISK_COLORS[level]
  }
  const time = (index: number, format: string) =>
    data?.times[index] ? DateTime.fromISO(data.times[index]).setZone(zone).toFormat(format) : '—'
  const gradient = data
    ? `linear-gradient(90deg, ${data.times.map((_, i) => `${riskColor(i)} ${(i / 48) * 100}%`).join(', ')})`
    : '#dce7f3'
  const forecastStart = data ? DateTime.fromISO(data.times[0]).toMillis() : NaN
  const forecastEnd = data ? DateTime.fromISO(data.times.at(-1)!).toMillis() : NaN
  const arrival = DateTime.fromISO(selectedRoute.arrival)
  const arrivalPosition =
    ((arrival.toMillis() - forecastStart) / (forecastEnd - forecastStart)) * 100
  const arrivalInRange =
    Number.isFinite(arrivalPosition) && arrivalPosition >= 0 && arrivalPosition <= 100
  const arrivalLabel = `Route ${selectedRoute.id} arrival: ${localTime(selectedRoute.arrival, zone, true)}`
  // Native range thumbs travel within the track, inset by half their diameter.
  return (
    <section className="forecast-timeline" aria-label="48-hour forecast">
      <div className="forecast-heading">
        <h3>
          <Cloud size={25} />
          48-Hour Forecast
        </h3>
        <span className="forecast-subtitle">Weather from departure through +48 hours</span>
        <div className="forecast-actions">
          <div className="route-visibility">
            <span>Show on map:</span>
            {routes.map((route) => (
              <label key={route.id}>
                <input
                  type="checkbox"
                  checked={visibleRoutes.includes(route.id)}
                  onChange={() => onToggleRoute(route.id)}
                  style={{ accentColor: ROUTE_COLORS[route.id] }}
                />
                Route {route.id}
              </label>
            ))}
          </div>
          <button
            className="text-button forecast-toggle"
            aria-label={visible ? 'Hide weather' : 'Show weather'}
            title={visible ? 'Hide weather' : 'Show weather'}
            onClick={onVisible}
            aria-pressed={visible}
          >
            {visible ? <Eye size={17} /> : <EyeOff size={17} />}
          </button>
        </div>
      </div>
      {error ? (
        <div className="forecast-error" role="status">
          {error}
          <button onClick={onRetry} className="text-button">
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      ) : (
        <>
          <div className="timeline-current">
            <span>
              {loading ? (
                <>
                  <LoaderCircle className="spin" size={14} /> Loading corridor weather…
                </>
              ) : data ? (
                <>
                  +{hour}h · {localTime(data.times[hour], zone, true)}
                </>
              ) : (
                'Forecast unavailable'
              )}
            </span>
            <div className="timeline-stepper">
              <button
                className="outline-icon"
                aria-label="Previous forecast hour"
                disabled={loading || !data || hour === 0}
                onClick={() => onHour(hour - 1)}
              >
                <ChevronLeft size={17} />
              </button>
              <button
                className="outline-icon"
                aria-label="Next forecast hour"
                disabled={loading || !data || hour === 48}
                onClick={() => onHour(hour + 1)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
          <div className="timeline-days">
            <span>{time(0, 'ccc, MMM d')}</span>
            <span>{time(24, 'ccc, MMM d')}</span>
          </div>
          <div className="timeline-track">
            <div className="timeline-ticks">
              {[0, 6, 12, 18, 24, 30, 36, 42, 48].map((t) => (
                <span key={t}>{time(t, 'h:mm a')}</span>
              ))}
            </div>
            <div className="timeline-weather-track">
              <input
                className="timeline-scrubber"
                type="range"
                name="forecast-hour"
                aria-label="Forecast hour"
                aria-valuetext={data ? localTime(data.times[hour], zone, true) : 'Loading'}
                min={0}
                max={48}
                step={1}
                value={hour}
                onChange={(e) => onHour(Number(e.target.value))}
                disabled={loading || !data}
              />
              <div
                className="timeline-symbols"
                aria-label="Highest weather risk along the route corridor"
              >
                {Array.from({ length: 17 }, (_, i) => i * 3).map((t) => {
                  const risk = peakRisk(t)
                  const drivers = data?.risk_drivers?.[t]
                  const dominant = dominantWeatherDrivers(risk, drivers)
                  const unknown = risk === null || !drivers
                  const description = unknown
                    ? 'Risk details unavailable'
                    : risk === 0
                      ? 'Low risk: wind, rain and snow below elevated-risk thresholds'
                      : `${dominant.map(({ label }) => label).join(' + ')} · ${RISK_LABELS[risk!]} risk`
                  return (
                    <span
                      key={t}
                      title={`+${t}h · ${time(t, 'h:mm a')}: ${description}`}
                      className="timeline-risk-icons"
                      role="img"
                      aria-label={description}
                      style={{ color: unknown ? '#94a3b8' : RISK_COLORS[risk!] }}
                    >
                      {unknown ? (
                        <CircleHelp aria-hidden="true" />
                      ) : risk === 0 ? (
                        <ShieldCheck aria-hidden="true" />
                      ) : (
                        dominant.map(({ key, paths }) => (
                          <svg
                            key={key}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            {paths.map((d) => (
                              <path key={d} d={d} />
                            ))}
                          </svg>
                        ))
                      )}
                    </span>
                  )
                })}
              </div>
              <div
                className="timeline-risk-band"
                style={{ background: gradient }}
                aria-label="Peak corridor risk over 48 hours"
              />
              {!loading && arrivalInRange && (
                <div className="timeline-arrival-track">
                  <div
                    className={`timeline-arrival-marker ${arrivalPosition < 10 ? 'near-start' : arrivalPosition > 90 ? 'near-end' : ''}`}
                    role="img"
                    aria-label={arrivalLabel}
                    style={{
                      left: `${arrivalPosition}%`,
                      borderColor: ROUTE_COLORS[selectedRoute.id],
                    }}
                  >
                    <span className="timeline-arrival-label" title={arrivalLabel}>
                      Arrival · {arrival.setZone(zone).toFormat('h:mm a')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      <p className="timeline-note">
        {!loading && data && arrivalPosition > 100 && (
          <span>Arrival beyond +48h · {localTime(selectedRoute.arrival, zone, true)}. </span>
        )}
        {loading ? (
          <span role="status">Loading weather from departure… </span>
        ) : data && peakRisk(hour) === null ? (
          <span role="status">Forecast unavailable at this hour.</span>
        ) : null}{' '}
        Icons show the highest wind, rain or snow risk; ties show together. Map weather: selected
        hour. Route risks: estimated arrival times. All times {zone}. Unavailable hours have no risk
        color.
      </p>
    </section>
  )
}
