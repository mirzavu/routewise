import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import RouteMap from './RouteMap'

vi.mock('mapbox-gl', () => ({
  default: {
    Map: class {
      constructor() {
        throw new Error('Failed to initialize WebGL')
      }
    },
  },
}))

it('shows an actionable map error without crashing the surrounding trip results', () => {
  render(
    <div>
      <h2>Route results</h2>
      <RouteMap
        routes={[]}
        selected="A"
        token="pk.test"
        corridor={null}
        hour={0}
        weatherVisible
        checkpoint={null}
        onRouteSelect={() => {}}
        onCheckpointSelect={() => {}}
      />
    </div>,
  )
  expect(screen.getByRole('heading', { name: 'Route results' })).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent(/WebGL/i)
  expect(screen.getByRole('alert')).toHaveTextContent(/restart/i)
})
