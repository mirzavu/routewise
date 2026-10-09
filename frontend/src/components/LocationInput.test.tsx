import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import LocationInput from './LocationInput'
import type { Location } from '../types'

it('preserves the typed search when editing a selected location',async()=>{
 function Harness(){const [value,setValue]=useState<Location|null>({label:'Dallas',coordinates:[-96,32],timezone:'America/Chicago'});return <LocationInput label="Origin" value={value} onChange={setValue}/>}
 render(<Harness/>);const input=screen.getByRole('combobox');await userEvent.type(input,'a');expect(input).toHaveValue('Dallasa')
})
