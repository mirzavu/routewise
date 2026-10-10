import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import LocationInput from './LocationInput'
import type { Location } from '../types'

it('preserves the typed search when editing a selected location', async () => {
  function Harness() {
    const [value, setValue] = useState<Location | null>({
      label: 'Dallas',
      coordinates: [-96, 32],
      timezone: 'America/Chicago',
    })
    return <LocationInput label="Origin" value={value} onChange={setValue} />
  }
  render(<Harness />)
  const input = screen.getByRole('combobox')
  await userEvent.type(input, 'a')
  expect(input).toHaveValue('Dallasa')
})

it('clears keyboard selection when the search becomes too short', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        locations: [
          {
            label: 'Dallas',
            coordinates: [-96, 32],
            timezone: 'America/Chicago',
          },
        ],
      }),
    })),
  )
  const onChange = vi.fn()
  render(<LocationInput label="Origin" value={null} onChange={onChange} />)
  const user = userEvent.setup()
  const input = screen.getByRole('combobox')
  await user.type(input, 'Dallas')
  await screen.findByRole('option', { name: 'Dallas' })
  await user.keyboard('{ArrowDown}')
  expect(input).toHaveAttribute('aria-activedescendant')
  await user.clear(input)
  await user.type(input, 'D')
  expect(input).not.toHaveAttribute('aria-activedescendant')
  await user.keyboard('{Enter}')
  expect(onChange).not.toHaveBeenCalled()
})

it('keeps keyboard selection empty when there are no suggestions', async () => {
  const onChange = vi.fn()
  render(<LocationInput label="Origin" value={null} onChange={onChange} />)
  const user = userEvent.setup()
  const input = screen.getByRole('combobox')
  await user.click(input)
  await user.keyboard('{ArrowUp}')
  expect(input).not.toHaveAttribute('aria-activedescendant')
  await user.keyboard('{Enter}')
  expect(onChange).not.toHaveBeenCalled()
})
