import { DateTime } from 'luxon'
import type { TripDraft, TripInput } from './types'

export function initialDraft(): TripDraft {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const next = DateTime.now().setZone(timezone).plus({ hours: 1 }).startOf('hour')
  return {
    origin: null,
    destination: null,
    date: next.toISODate()!,
    time: next.toFormat('HH:mm'),
    timezone,
    load: '',
    spacing: 25,
  }
}
export function toTripInput(draft: TripDraft): TripInput {
  if (!draft.origin) throw new Error('Choose an origin from the location suggestions.')
  if (!draft.destination) throw new Error('Choose a destination from the location suggestions.')
  const load = Number(draft.load.replaceAll(',', ''))
  if (!draft.load.trim() || !Number.isFinite(load) || load < 0 || load > 200000)
    throw new Error('Enter a cargo weight between 0 and 200,000 lb.')
  const local = `${draft.date}T${draft.time}`
  const date = DateTime.fromISO(local, { zone: draft.timezone })
  if (
    !date.isValid ||
    date.toFormat("yyyy-MM-dd'T'HH:mm") !== local ||
    date.getPossibleOffsets().length > 1
  )
    throw new Error('Choose a valid, unambiguous departure time in this timezone.')
  return {
    origin: draft.origin,
    destination: draft.destination,
    departure: date.toUTC().toISO()!,
    load_lb: load,
    spacing_miles: draft.spacing,
  }
}
export function duration(seconds: number) {
  const minutes = Math.round(seconds / 60)
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
export function miles(value: number) {
  return Math.round(value).toLocaleString('en-US')
}
export function localTime(iso: string, zone: string, withDate = false) {
  return DateTime.fromISO(iso)
    .setZone(zone)
    .toFormat(withDate ? 'MMM d, h:mm a ZZZZ' : 'h:mm a ZZZZ')
}
export function city(label: string) {
  return label.split(',')[0]
}
