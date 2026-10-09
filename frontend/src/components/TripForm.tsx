import { ArrowRight, ArrowRightLeft, CalendarDays, Clock3, Globe2, Info, LoaderCircle, Play, Route, ShieldCheck, Truck } from 'lucide-react'
import { DateTime } from 'luxon'
import LocationInput from './LocationInput'
import type { TripDraft } from '../types'

interface Props {draft:TripDraft;onChange:(draft:TripDraft)=>void;onSubmit:()=>void;onExample?:()=>void;loading:boolean;error:string;compact?:boolean;onCancel?:()=>void}
export default function TripForm({draft,onChange,onSubmit,onExample,loading,error,compact,onCancel}:Props){
 const update=(patch:Partial<TripDraft>)=>onChange({...draft,...patch})
 const zones=[...new Set([draft.timezone,'America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Phoenix','America/Anchorage','Pacific/Honolulu','UTC'])]
 return <form className={`trip-form ${compact?'compact-form':''}`} onSubmit={e=>{e.preventDefault();onSubmit()}} noValidate>
 <div className="form-heading"><h2>{compact?'Edit your trip':'Plan your trip'}</h2><span className="form-note"><ShieldCheck size={16}/> WEATHER-AWARE PLANNING</span></div>
 <fieldset disabled={loading}>
 <div className="locations-row"><LocationInput label="Origin" value={draft.origin} onChange={origin=>update({origin,...(origin?{timezone:origin.timezone}:{})})}/><button type="button" className="swap-button" aria-label="Swap origin and destination" onClick={()=>update({origin:draft.destination,destination:draft.origin,timezone:draft.destination?.timezone||draft.timezone})}><ArrowRightLeft size={17}/></button><LocationInput label="Destination" value={draft.destination} onChange={destination=>update({destination})}/></div>
 <div className="field-label">Departure date & time</div><div className="departure-row"><div className="input-wrap"><CalendarDays size={18}/><input aria-label="Departure date" type="date" value={draft.date} min={DateTime.now().setZone(draft.timezone).toISODate()!} max={DateTime.now().setZone(draft.timezone).plus({days:6}).toISODate()!} onChange={e=>update({date:e.target.value})}/></div><div className="input-wrap"><Clock3 size={18}/><input aria-label="Departure time" type="time" value={draft.time} onChange={e=>update({time:e.target.value})}/></div><div className="input-wrap timezone-input"><Globe2 size={17}/><select aria-label="Departure timezone" value={draft.timezone} onChange={e=>update({timezone:e.target.value})}>{zones.map(zone=><option key={zone} value={zone}>{DateTime.fromISO(`${draft.date}T${draft.time}`,{zone}).offsetNameShort||zone} · {zone.split('/').pop()?.replaceAll('_',' ')}</option>)}</select></div></div>
 <div className="cargo-row"><div className="field"><label htmlFor="cargo-weight">Cargo weight</label><div className="input-wrap"><Truck size={18}/><input id="cargo-weight" inputMode="decimal" value={draft.load} placeholder="e.g. 36,000" onChange={e=>update({load:e.target.value})}/><span className="input-unit">lb</span></div></div><div className="field spacing-field"><span id="spacing-label" className="field-label">Checkpoint spacing <span title="Weather is checked at your estimated arrival at every checkpoint."><Info size={13}/></span></span><div className="segmented" role="group" aria-labelledby="spacing-label">{[10,25,50].map(spacing=><button type="button" key={spacing} aria-pressed={draft.spacing===spacing} className={draft.spacing===spacing?'active':''} onClick={()=>update({spacing})}>{spacing} <span>miles</span></button>)}</div></div></div>
 {error&&<div className="form-error" role="alert">{error}</div>}
 <button className="primary-button" type="submit">{loading?<LoaderCircle className="spin" size={19}/>:<Route size={19}/>}<span>{loading?'Comparing routes & weather…':compact?'Update routes':'Compare routes'}</span>{!loading&&<ArrowRight size={19}/>}</button>
 {onExample&&<button className="example-button" type="button" onClick={onExample}><Play size={13} fill="currentColor"/>Try an example trip<span>Dallas to Atlanta · 36,000 lb</span></button>}
 {onCancel&&<button className="text-button cancel-edit" type="button" onClick={onCancel}>Keep current trip</button>}
 </fieldset>
 </form>
}
