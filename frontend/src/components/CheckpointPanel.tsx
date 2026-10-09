import { ChevronLeft, ChevronRight, CloudRain, MapPin, Snowflake, Wind, X } from 'lucide-react'
import type { Checkpoint } from '../types'
import { RISK_COLORS } from '../types'
import { localTime, miles } from '../format'
export default function CheckpointPanel({
  point,
  count,
  zone,
  onClose,
  onMove,
}: {
  point: Checkpoint
  count: number
  zone: string
  onClose: () => void
  onMove: (direction: number) => void
}) {
  const w = point.weather,
    level = point.risk.level
  const value = (n: number | null, digits = 0) => (n === null ? 'Unavailable' : n.toFixed(digits))
  return (
    <section className="checkpoint-panel" aria-label="Checkpoint details">
      <div className="checkpoint-heading">
        <span className="small-label">
          <MapPin size={14} /> ALONG YOUR ROUTE
        </span>
        <button className="icon-button" aria-label="Close checkpoint details" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="checkpoint-title">
        <div>
          <h3>Checkpoint {point.index}</h3>
          <p>{miles(point.mile)} miles from origin</p>
        </div>
        <span
          className="risk-pill"
          style={{
            color: level === null ? '#78899b' : RISK_COLORS[level],
            background: level === null ? '#f0f3f7' : `${RISK_COLORS[level]}16`,
          }}
        >
          {point.risk.label}
        </span>
      </div>
      <div className="checkpoint-arrival">
        <span>Estimated arrival</span>
        <strong>{localTime(point.eta, zone, true)}</strong>
      </div>
      <div className="weather-readings">
        <div>
          <Wind />
          <strong>{value(w.wind_mph)} mph</strong>
          <span>Wind</span>
        </div>
        <div>
          <CloudRain />
          <strong>{value(w.rain_in_hr, 2)}</strong>
          <span>Rain · in/hr</span>
        </div>
        <div>
          <Snowflake />
          <strong>{value(w.snow_in_hr, 2)}</strong>
          <span>Snow · in/hr</span>
        </div>
      </div>
      <div className="risk-explanation">
        <strong>Why this risk?</strong>
        {point.risk.reasons.map((reason) => (
          <p key={reason}>{reason}</p>
        ))}
      </div>
      <div className="checkpoint-navigation">
        <span>
          {point.index} of {count} checkpoints
        </span>
        <div>
          <button
            className="outline-icon"
            aria-label="Previous checkpoint"
            disabled={point.index === 1}
            onClick={() => onMove(-1)}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className="outline-icon"
            aria-label="Next checkpoint"
            disabled={point.index === count}
            onClick={() => onMove(1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
    </section>
  )
}
