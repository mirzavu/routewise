import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { CloudSun, ShieldCheck, MoveRight, LoaderCircle } from 'lucide-react'
import { DateTime } from 'luxon'
import Brand from './components/Brand'
import TripForm from './components/TripForm'
import { initialDraft, toTripInput } from './format'
import { api } from './api'
import type { Analysis, TripDraft } from './types'
const Workspace = lazy(() => import('./components/Workspace'))

export default function App() {
  const [draft, setDraft] = useState(initialDraft),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('')
  const [result, setResult] = useState<Analysis | null>(null),
    [submitted, setSubmitted] = useState<TripDraft | null>(null),
    [editing, setEditing] = useState(false),
    [token, setToken] = useState('')
  const controller = useRef<AbortController | null>(null),
    dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const abort = new AbortController()
    api<{ mapbox_public_token: string }>('/config', undefined, abort.signal)
      .then((c) => setToken(c.mapbox_public_token))
      .catch(() => {})
    return () => {
      abort.abort()
      controller.current?.abort()
    }
  }, [])
  useEffect(() => {
    if (editing) dialog.current?.showModal()
    else dialog.current?.close()
  }, [editing])
  async function submit(value = draft) {
    let next: AbortController | undefined
    try {
      const input = toTripInput(value)
      controller.current?.abort()
      next = new AbortController()
      controller.current = next
      setError('')
      setLoading(true)
      const response = await api<Analysis>('/trips/analyze', input, next.signal)
      if (next.signal.aborted) return
      setSubmitted({ ...value })
      setResult(response)
      setEditing(false)
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') setError(e.message)
    } finally {
      if (next === controller.current || !next) setLoading(false)
    }
  }
  function example() {
    const time = DateTime.now().setZone('America/Chicago').plus({ hours: 1 }).startOf('hour')
    const value: TripDraft = {
      origin: {
        label: 'Dallas, TX, United States',
        coordinates: [-96.797, 32.777],
        timezone: 'America/Chicago',
      },
      destination: {
        label: 'Atlanta, GA, United States',
        coordinates: [-84.388, 33.749],
        timezone: 'America/New_York',
      },
      date: time.toISODate()!,
      time: time.toFormat('HH:mm'),
      timezone: 'America/Chicago',
      load: '36,000',
      spacing: 25,
    }
    setDraft(value)
    void submit(value)
  }
  if (result && submitted)
    return (
      <>
        <Suspense
          fallback={
            <div className="workspace-loading">
              <LoaderCircle className="spin" />
              Opening your route workspace…
            </div>
          }
        >
          <Workspace
            key={result.weather_fetched_at}
            result={result}
            trip={submitted}
            token={token}
            onEdit={() => {
              setDraft({ ...submitted })
              setError('')
              setEditing(true)
            }}
            onHome={() => {
              setResult(null)
              setError('')
              setEditing(false)
            }}
          />
        </Suspense>
        <dialog
          ref={dialog}
          className="edit-dialog"
          onCancel={(e) => {
            e.preventDefault()
            if (!loading) setEditing(false)
          }}
        >
          <TripForm
            compact
            draft={draft}
            onChange={setDraft}
            onSubmit={() => void submit()}
            onCancel={() => setEditing(false)}
            loading={loading}
            error={error}
          />
        </dialog>
      </>
    )
  return (
    <main className="landing">
      <div className="landing-photo" />
      <div className="landing-wash" />
      <div className="landing-content">
        <header className="landing-header">
          <Brand />
        </header>
        <section className="hero-copy">
          <h1>
            Smarter routes.
            <br />
            Safer journeys.
          </h1>
          <p>
            A better route starts with a look ahead.
            <br className="desktop-break" /> Compare weather risk and travel time for your load.
          </p>
        </section>
        <div className="landing-form-card">
          <TripForm
            draft={draft}
            onChange={setDraft}
            onSubmit={() => void submit()}
            onExample={example}
            loading={loading}
            error={error}
          />
          <div className="trust-row">
            <span>
              <CloudSun />
              <span>
                Weather along
                <br />
                your entire route
              </span>
            </span>
            <span>
              <ShieldCheck />
              <span>
                Recommendations
                <br />
                built for your load
              </span>
            </span>
            <span>
              <MoveRight />
              <span>
                A better way
                <br />
                forward
              </span>
            </span>
          </div>
        </div>
      </div>
    </main>
  )
}
