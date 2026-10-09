import { describe, it, expect } from 'vitest'
import { toTripInput } from './format'
import type { TripDraft } from './types'
const draft: TripDraft = {
  origin: {
    label: 'Denver',
    coordinates: [-104.99, 39.74],
    timezone: 'America/Denver',
  },
  destination: {
    label: 'Dallas',
    coordinates: [-96.8, 32.8],
    timezone: 'America/Chicago',
  },
  date: '2026-10-12',
  time: '08:00',
  timezone: 'America/Denver',
  load: '42,000',
  spacing: 25,
}
describe('trip input', () => {
  it('converts origin-local time to an absolute time and normalizes load', () => {
    const t = toTripInput(draft)
    expect(t.departure).toBe('2026-10-12T14:00:00.000Z')
    expect(t.load_lb).toBe(42000)
  })
  it('requires selected locations', () =>
    expect(() => toTripInput({ ...draft, origin: null })).toThrow(/origin/i))
  it('rejects invalid cargo', () =>
    expect(() => toTripInput({ ...draft, load: '-1' })).toThrow(/weight/i))
  it('rejects nonexistent DST time instead of silently shifting', () =>
    expect(() => toTripInput({ ...draft, date: '2026-03-08', time: '02:30' })).toThrow(/time/i))
  it('rejects an ambiguous DST time', () =>
    expect(() => toTripInput({ ...draft, date: '2026-11-01', time: '01:30' })).toThrow(/time/i))
})
