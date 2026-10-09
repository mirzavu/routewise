import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./components/Workspace', () => ({
  default: ({ onEdit }: { onEdit: () => void }) => <button onClick={onEdit}>Edit trip</button>,
}))
it('submits the example to the real analysis interface and preserves details when editing', async () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  const requests: unknown[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options) => {
      if (String(url).includes('/config'))
        return { ok: true, json: async () => ({ mapbox_public_token: '' }) }
      requests.push(JSON.parse(options.body))
      return {
        ok: true,
        json: async () => ({
          routes: [],
          recommendation: { route_id: null, reason: '' },
          warnings: [],
          weather_fetched_at: '2026-10-10T10:00:00Z',
        }),
      }
    }),
  )
  render(<App />)
  await userEvent.click(screen.getByRole('button', { name: /Try an example trip/ }))
  await userEvent.click(await screen.findByRole('button', { name: 'Edit trip' }))
  expect(requests).toHaveLength(1)
  expect(requests[0]).toMatchObject({
    load_lb: 36000,
    spacing_miles: 25,
    origin: { coordinates: [-96.797, 32.777] },
  })
  expect(screen.getByRole('combobox', { name: 'Origin' })).toHaveValue('Dallas, TX, United States')
  expect(screen.getByRole('textbox', { name: 'Cargo weight' })).toHaveValue('36,000')
})
it('preserves inputs and restores the action after a service failure', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => ({
      ok: !String(url).includes('/analyze'),
      json: async () =>
        String(url).includes('/config')
          ? { mapbox_public_token: '' }
          : { message: 'Routing is unavailable. Please retry.' },
    })),
  )
  render(<App />)
  await userEvent.click(screen.getByRole('button', { name: /Try an example trip/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Routing is unavailable. Please retry.',
  )
  expect(screen.getByRole('textbox', { name: 'Cargo weight' })).toHaveValue('36,000')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Compare routes' })).toBeEnabled())
})
