const conditions: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Heavy freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  97: 'Heavy thunderstorm',
  99: 'Thunderstorm with heavy hail',
}

export function weatherConditionLabel(code: number | null | undefined, isDay?: boolean | null) {
  const label = code == null ? undefined : conditions[code]
  return label ? `${label}${isDay === false ? ' at night' : ''}` : 'Conditions unavailable'
}

export default function WeatherIcon({
  code,
  isDay,
}: {
  code?: number | null
  isDay?: boolean | null
}) {
  const known = code != null && code in conditions
  const clear = known && code <= 2
  const rain = known && ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95)
  const snow = known && ((code >= 71 && code <= 77) || code === 85 || code === 86)
  const storm = known && code >= 95
  const fog = code === 45 || code === 48
  const heavy = code === 65 || code === 67 || code === 75 || code === 82 || code === 86 || storm
  const cloud = !known ? '#bfccd9' : heavy ? '#4d7fab' : code === 3 ? '#82b8e7' : '#a9d0ee'
  return (
    <svg
      className="forecast-weather-icon"
      viewBox="0 0 36 36"
      width="34"
      height="34"
      fill="none"
      role="img"
      aria-label={weatherConditionLabel(code, isDay)}
    >
      {clear &&
        (isDay === false ? (
          <path d="M16 4a9 9 0 1 0 10 13A9 9 0 0 1 16 4Z" fill="#a4b8e3" />
        ) : (
          <g stroke="#ffbd36" strokeWidth="1.7" strokeLinecap="round">
            <path d="M13 2v2m0 18v2M2 13h2m18 0h2M5.2 5.2l1.5 1.5m12.6 12.6 1.5 1.5M5.2 20.8l1.5-1.5M19.3 6.7l1.5-1.5" />
            <circle cx="13" cy="13" r="6.5" fill="#ffcd4b" stroke="none" />
          </g>
        ))}
      {code !== 0 && (
        <path
          d="M9 25a6.2 6.2 0 0 1-1.1-12.3A8.1 8.1 0 0 1 23.2 11a7 7 0 0 1 3.3 13.2H9Z"
          fill={cloud}
          stroke="none"
        />
      )}
      {rain && (
        <g stroke={heavy ? '#267dc5' : '#299df3'} strokeWidth="2" strokeLinecap="round">
          <path d="m10 28-1.5 3m9-3-1.5 3m9-3-1.5 3" />
          {heavy && <path d="m13 32-1 2m9-2-1 2" />}
        </g>
      )}
      {snow && (
        <g stroke="#7aafe0" strokeWidth="1.3" strokeLinecap="round">
          <path d="M11 28v6m-2.6-4.5 5.2 3m-5.2 0 5.2-3M25 28v6m-2.6-4.5 5.2 3m-5.2 0 5.2-3" />
        </g>
      )}
      {storm && <path d="m20 19-5 8h4l-2 7 8-10h-5l3-5Z" fill="#ffd35b" stroke="none" />}
      {fog && <path d="M6 28h24M10 32h16" stroke="#9aafc3" strokeWidth="2" strokeLinecap="round" />}
      {!known && (
        <text
          x="18"
          y="22"
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill="#60758d"
          stroke="none"
        >
          ?
        </text>
      )}
    </svg>
  )
}
