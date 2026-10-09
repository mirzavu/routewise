import { Clock3, CloudSun, Eye, EyeOff, LoaderCircle, RefreshCw } from 'lucide-react'
import type { Corridor } from '../types'
import { localTime } from '../format'
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
}) {
  return (
    <section className="forecast-timeline" aria-label="48-hour forecast">
      <div className="forecast-heading">
        <h3>
          <CloudSun size={20} />
          48-hour forecast <span>Weather around your routes</span>
        </h3>
        <div>
          <button
            className="text-button forecast-toggle"
            aria-label={visible ? 'Hide weather' : 'Show weather'}
            onClick={onVisible}
            aria-pressed={visible}
          >
            {visible ? <Eye size={15} /> : <EyeOff size={15} />}
            <span>{visible ? 'Hide weather' : 'Show weather'}</span>
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
              {data
                ? localTime(data.times[hour], zone, true)
                : loading
                  ? 'Loading corridor weather…'
                  : 'Forecast unavailable'}
            </span>
            <span>{hour === 0 ? 'Current hour' : `+${hour} hours`}</span>
          </div>
          <div className="timeline-controls">
            <span className="play-button" aria-hidden="true">
              {loading ? <LoaderCircle className="spin" size={17} /> : <Clock3 size={16} />}
            </span>
            <div className="slider-track">
              <input
                type="range"
                name="forecast-hour"
                aria-label="Forecast hour"
                aria-valuetext={data ? localTime(data.times[hour], zone, true) : 'Loading'}
                min={0}
                max={48}
                step={1}
                value={hour}
                onChange={(e) => {
                  onHour(Number(e.target.value))
                }}
                disabled={!data}
              />
              <div className="timeline-ticks">
                {[0, 6, 12, 18, 24, 30, 36, 42, 48].map((t) => (
                  <span key={t}>{t === 0 ? 'Now' : `+${t}h`}</span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      <p className="timeline-note">
        Map weather: selected hour. Route risks: estimated arrival times.
      </p>
    </section>
  )
}
