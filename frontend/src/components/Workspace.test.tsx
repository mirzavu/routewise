import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import Workspace from './Workspace'
import { toTripInput } from '../format'
import type { Analysis, Route, TripDraft } from '../types'
vi.mock('./RouteMap', () => ({
  default: ({
    onCheckpointSelect,
    onCheckpointDismiss,
    routes,
  }: {
    onCheckpointSelect: (id: string, index: number) => void
    onCheckpointDismiss: () => void
    routes: Route[]
  }) => (
    <>
      <button onClick={() => onCheckpointSelect(routes[0].id, 0)}>Map checkpoint</button>
      <button onClick={onCheckpointDismiss}>Map background</button>
    </>
  ),
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
    vi.fn(async (_url: string, options?: RequestInit) => ({
      ok: true,
      json: async () => ({
        points: [[-96, 32]],
        bounds: [-97, 31, -95, 33],
        times: Array.from({ length: 49 }, (_, i) =>
          new Date(
            Date.parse(JSON.parse(options?.body as string).departure || '2026-10-12T10:00:00Z') +
              i * 3600000,
          ).toISOString(),
        ),
        frames: Array.from({ length: 49 }, (_, i) => [i < 24 ? 1 : null]),
        risk_drivers: Array.from({ length: 49 }, (_, i) =>
          i < 24 ? { wind: 1, rain: 0, snow: 0 } : { wind: null, rain: null, snow: null },
        ),
        spacing_miles: 25,
        fetched_at: '2026-10-12T09:00:00Z',
      }),
    })),
  )
})
it('anchors all 48 forecast hours to the exact departure in the selected trip timezone', async () => {
  const trip = { ...draft, date: '2026-10-13', time: '23:30' }
  render(<Workspace result={result} trip={trip} token="" onEdit={() => {}} onHome={() => {}} />)
  const slider = screen.getByRole('slider', { name: 'Forecast hour' })
  await waitFor(() => expect(slider).toBeEnabled())
  const request = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
  expect(request.departure).toBe('2026-10-14T04:30:00.000Z')
  expect(request.departure).toBe(toTripInput(trip).departure)
  expect(slider).toHaveAttribute('aria-valuetext', 'Oct 13, 11:30 PM CDT')
  const timeline = screen.getByRole('region', { name: '48-hour forecast' })
  expect(within(timeline).getAllByText('11:30 PM').length).toBeGreaterThan(0)
  fireEvent.change(slider, { target: { value: '48' } })
  expect(slider).toHaveAttribute('aria-valuetext', 'Oct 15, 11:30 PM CDT')
  expect(within(timeline).getByText('Forecast unavailable at this hour.')).toBeInTheDocument()
  expect(within(timeline).queryByRole('img', { name: /^Low risk/ })).not.toBeInTheDocument()
  expect(screen.getByText(/Recommended: Route A/)).toBeInTheDocument()
})

it('refreshes and resets the forecast when departure date, time or timezone changes', async () => {
  const props = { result, token: '', onEdit: () => {}, onHome: () => {} }
  const { rerender } = render(<Workspace {...props} trip={draft} />)
  const slider = screen.getByRole('slider', { name: 'Forecast hour' })
  await waitFor(() => expect(slider).toBeEnabled())
  const edits = [
    { ...draft, date: '2026-10-13' },
    { ...draft, date: '2026-10-13', time: '23:30' },
    { ...draft, date: '2026-10-13', time: '23:30', timezone: 'Asia/Kolkata' },
  ]
  for (const [index, trip] of edits.entries()) {
    fireEvent.change(slider, { target: { value: '12' } })
    rerender(<Workspace {...props} trip={trip} />)
    await waitFor(() => expect(vi.mocked(fetch).mock.calls).toHaveLength(index + 2))
    await waitFor(() => expect(slider).toBeEnabled())
    expect(slider).toHaveValue('0')
    const request = JSON.parse(vi.mocked(fetch).mock.calls[index + 1][1]?.body as string)
    expect(request.departure).toBe(toTripInput(trip).departure)
  }
  expect(slider).toHaveAttribute('aria-valuetext', 'Oct 13, 11:30 PM GMT+5:30')
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
it('moves the arrival marker to the selected route without changing the forecast hour', async () => {
  const trips: Analysis = {
    ...result,
    routes: [
      { ...a, arrival: '2026-10-12T14:30:00Z' },
      { ...a, id: 'B', arrival: '2026-10-12T20:00:00Z' },
    ],
  }
  render(<Workspace result={trips} trip={draft} token="" onEdit={() => {}} onHome={() => {}} />)
  const slider = screen.getByRole('slider', { name: 'Forecast hour' })
  await waitFor(() => expect(slider).toBeEnabled())
  const marker = screen.getByRole('img', { name: 'Route A arrival: Oct 12, 9:30 AM CDT' })
  expect(marker).toHaveStyle({ left: '3.125%' })
  expect(screen.getByText('Arrival · 9:30 AM')).toBeInTheDocument()
  fireEvent.change(slider, { target: { value: '12' } })
  await userEvent.click(screen.getByRole('button', { name: /Inspect Route B/ }))
  expect(screen.getByRole('img', { name: 'Route B arrival: Oct 12, 3:00 PM CDT' })).toHaveStyle({
    left: `${(7 / 48) * 100}%`,
  })
  expect(slider).toHaveValue('12')
})

it('labels an arrival beyond the forecast window instead of pinning it to the end', async () => {
  const trips: Analysis = { ...result, routes: [{ ...a, arrival: '2026-10-15T14:00:00Z' }] }
  render(<Workspace result={trips} trip={draft} token="" onEdit={() => {}} onHome={() => {}} />)
  await waitFor(() => expect(screen.getByRole('slider')).toBeEnabled())
  expect(screen.queryByRole('img', { name: /Route A arrival/ })).not.toBeInTheDocument()
  expect(screen.getByText(/Arrival beyond \+48h/)).toBeInTheDocument()
})

it('opens arrival-time weather when a checkpoint is clicked', async () => {
  render(<Workspace result={result} trip={draft} token="" onEdit={() => {}} onHome={() => {}} />)
  await userEvent.click(screen.getByText('Map checkpoint'))
  expect(screen.getByText('Heavy load increases wind risk.')).toBeInTheDocument()
  expect(screen.getByText('38 mph')).toBeInTheDocument()
})

it('closes checkpoint weather when the map dismisses it and can reopen it', async () => {
  render(<Workspace result={result} trip={draft} token="" onEdit={() => {}} onHome={() => {}} />)
  await userEvent.click(screen.getByText('Map checkpoint'))
  expect(screen.getByText('Heavy load increases wind risk.')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Map background'))
  expect(screen.queryByText('Heavy load increases wind risk.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByText('Map checkpoint'))
  expect(screen.getByText('Heavy load increases wind risk.')).toBeInTheDocument()
})

it('toggles route visibility independently and restores a route when selected', async () => {
  render(<Workspace result={result} trip={draft} token="" onEdit={() => {}} onHome={() => {}} />)
  const toggle = screen.getByRole('checkbox', { name: 'Route B' })
  expect(toggle).toBeChecked()
  await userEvent.click(toggle)
  expect(toggle).not.toBeChecked()
  await userEvent.click(screen.getByRole('button', { name: /Inspect Route B/ }))
  expect(toggle).toBeChecked()
  expect(screen.getByText(/Recommended: Route A/)).toBeInTheDocument()
})
