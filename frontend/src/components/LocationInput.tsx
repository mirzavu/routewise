import { useEffect, useId, useRef, useState } from 'react'
import { LoaderCircle, MapPin, Search, X } from 'lucide-react'
import { api } from '../api'
import type { Location } from '../types'

export default function LocationInput({label,value,onChange}:{label:string;value:Location|null;onChange:(value:Location|null)=>void}) {
 const id=useId(), root=useRef<HTMLDivElement>(null)
 const [query,setQuery]=useState(value?.label||'')
 const [options,setOptions]=useState<Location[]>([]),[open,setOpen]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[active,setActive]=useState(-1)
 useEffect(()=>{setQuery(value?.label||'')},[value])
 useEffect(()=>{
  if(!open || query.trim().length<3 || value?.label===query){setOptions([]);return}
  const controller=new AbortController()
  const timeout=setTimeout(()=>{setLoading(true);setError('');api<{locations:Location[]}>(`/locations?q=${encodeURIComponent(query)}`,undefined,controller.signal).then(data=>{setOptions(data.locations);setActive(-1)}).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})},300)
  return ()=>{clearTimeout(timeout);controller.abort();setLoading(false)}
 },[query,open,value])
 useEffect(()=>{const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[])
 function select(location:Location){onChange(location);setQuery(location.label);setOpen(false)}
 return <div className="field location-field" ref={root}><label htmlFor={id}>{label}</label><div className="input-wrap"><Search size={18}/><input id={id} role="combobox" autoComplete="off" placeholder={label==='Origin'?'Where are you starting?':'Where are you headed?'} value={query} aria-expanded={open&&options.length>0} aria-controls={`${id}-options`} aria-autocomplete="list" aria-activedescendant={active>=0?`${id}-${active}`:undefined} onFocus={()=>setOpen(true)} onChange={e=>{if(value)onChange(null);setQuery(e.target.value);setOpen(true)}} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);if(e.key==='ArrowDown'){e.preventDefault();setActive(i=>Math.min(i+1,options.length-1))}if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>Math.max(0,i-1))}if(e.key==='Enter'&&open&&active>=0){e.preventDefault();select(options[active])}}}/>{loading?<LoaderCircle className="spin" size={16}/>:query?<button type="button" className="icon-button clear-input" aria-label={`Clear ${label.toLowerCase()}`} onClick={()=>{onChange(null);setQuery('');setOptions([])}}><X size={15}/></button>:null}</div>{open&&query.length>=3&&!value&&<div className="suggestions" id={`${id}-options`} role="listbox" aria-label={`${label} suggestions`}>{error?<p role="status">{error}</p>:options.length?options.map((location,i)=><button type="button" id={`${id}-${i}`} role="option" aria-selected={i===active} key={`${location.label}-${i}`} onClick={()=>select(location)} onMouseEnter={()=>setActive(i)}><MapPin size={16}/><span>{location.label}</span></button>):<p>{loading?'Finding places…':'No matching places yet. Try a city and state.'}</p>}</div>}</div>
}
