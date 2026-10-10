import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import WeatherIcon from './WeatherIcon'

it('uses provider conditions and daylight for weather descriptions', () => {
  const { rerender } = render(<WeatherIcon code={2} isDay />)
  expect(screen.getByRole('img', { name: 'Partly cloudy' })).toBeInTheDocument()
  rerender(<WeatherIcon code={65} isDay />)
  expect(screen.getByRole('img', { name: 'Heavy rain' })).toBeInTheDocument()
  rerender(<WeatherIcon code={0} isDay={false} />)
  expect(screen.getByRole('img', { name: 'Clear sky at night' })).toBeInTheDocument()
  rerender(<WeatherIcon code={73} />)
  expect(screen.getByRole('img', { name: 'Snow' })).toBeInTheDocument()
})

it('does not portray missing or unsupported conditions as clear weather', () => {
  const { rerender } = render(<WeatherIcon code={null} />)
  expect(screen.getByRole('img', { name: 'Conditions unavailable' })).toBeInTheDocument()
  rerender(<WeatherIcon code={1000} />)
  expect(screen.getByRole('img', { name: 'Conditions unavailable' })).toBeInTheDocument()
})
