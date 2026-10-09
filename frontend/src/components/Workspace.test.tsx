import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import Workspace from './Workspace'
import type { Analysis, Route, TripDraft } from '../types'
vi.mock('./RouteMap', () => ({
  default: ({
    onCheckpointSelect,
    routes,
  }: {
    onCheckpointSelect: (id: string, index: number) => void
    routes: Route[]
  }) => <button onClick={() => onCheckpointSelect(routes[0].id, 0)}>Map checkpoint</button>,
}))
const a: Route = {
  id: 'A',
  name: 'I-20 E',
  geometry: {
    type: 'LineString',
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
      coordinates: [-96, 32],
      eta: '2026-10-12T10:00:00Z',
      weather: { wind_mph: 38, rain_in_hr: 0.08, snow_in_hr: 0 },
      risk: {
        level: 3,
        label: 'Severe',
        reasons: ['Heavy load increases wind risk.'],
      },
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
const result: Analysis = {
  routes: [a, { ...a, id: 'B', name: 'I-40 E' }],
  recommendation: { route_id: 'A', reason: 'Fewest high-risk miles.' },
  warnings: [],
  weather_fetched_at: '2026-10-12T09:00:00Z',
}
const draft: TripDraft = {
  origin: {
    label: 'Dallas',
    coordinates: [-96, 32],
    timezone: 'America/Chicago',
  },
  destination: {
    label: 'Atlanta',
    coordinates: [-84, 33],
    timezone: 'America/New_York',
  },
  date: '2026-10-12',
  time: '08:00',
  timezone: 'America/Chicago',
  load: '42000',
  spacing: 25,
}
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        points: [[-96, 32]],
        bounds: [-97, 31, -95, 33],
        times: Array.from({ length: 49 }, (_, i) =>
          new Date(Date.UTC(2026, 9, 12, 10 + i)).toISOString(),
        ),
        frames: Array.from({ length: 49 }, () => [1]),
        spacing_miles: 25,
        fetched_at: '2026-10-12T09:00:00Z',
      }),
    })),
  )
})
it('keeps recommendation stable when selecting another route and scrubbing forecast', async () => {
  render(<Workspace result={result} trip={draft} token="" onEdit={() => {}} onHome={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /Inspect Route B/ }))
  expect(screen.getByRole('button', { name: /Inspect Route B/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await waitFor(() => expect(screen.getByRole('slider', { name: 'Forecast hour' })).toBeEnabled())
  const count = vi.mocked(fetch).mock.calls.length
  fireEvent.change(screen.getByRole('slider'), { target: { value: '12' } })
  expect(screen.getByText(/Recommended: Route A/)).toBeInTheDocument()
  expect(vi.mocked(fetch).mock.calls.length).toBe(count)
})
it('opens arrival-time weather when a checkpoint is clicked', async () => {
  render(<Workspace result={result} trip={draft} token="" onEdit={() => {}} onHome={() => {}} />)
  await userEvent.click(screen.getByText('Map checkpoint'))
  expect(screen.getByText('Heavy load increases wind risk.')).toBeInTheDocument()
  expect(screen.getByText('38 mph')).toBeInTheDocument()
})
