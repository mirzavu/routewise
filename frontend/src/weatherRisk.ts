import type { WeatherRiskComponents } from './types'

const weatherDrivers = [
  {
    key: 'wind',
    label: 'Wind',
    paths: [
      'M3 8h12a3 3 0 1 0-3-3',
      'M2 12h17a2 2 0 1 1-2 2',
      'M4 16h6a2 2 0 1 1-2 2',
    ],
  },
  {
    key: 'rain',
    label: 'Rain',
    paths: [
      'M6 15a4 4 0 0 1-.4-8 6 6 0 0 1 11.5-1A4.5 4.5 0 1 1 18 15Z',
      'm8 18-1 3m6-3-1 3m6-3-1 3',
    ],
  },
  {
    key: 'snow',
    label: 'Snow',
    paths: [
      'M6 15a4 4 0 0 1-.4-8 6 6 0 0 1 11.5-1A4.5 4.5 0 1 1 18 15Z',
      'M8 17v6m-2.6-4.5 5.2 3m-5.2 0 5.2-3M17 17v6m-2.6-4.5 5.2 3m-5.2 0 5.2-3',
    ],
  },
] as const

export function dominantWeatherDrivers(
  level: number | null,
  components?: WeatherRiskComponents,
) {
  return weatherDrivers.filter(
    ({ key }) => level !== null && level > 0 && components?.[key] === level,
  )
}
