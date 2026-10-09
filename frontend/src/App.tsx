import { useState } from 'react'
import { CloudSun, ShieldCheck, MoveRight, ArrowUpRight } from 'lucide-react'
import { DateTime } from 'luxon'
import Brand from './components/Brand'
import TripForm from './components/TripForm'
import { initialDraft, toTripInput } from './format'
import { api } from './api'
import type { Analysis, TripDraft } from './types'

export default function App(){
 const [draft,setDraft]=useState(initialDraft),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const [result,setResult]=useState<Analysis|null>(null)
 async function submit(value=draft){
  try {const input=toTripInput(value);setError('');setLoading(true);setResult(await api<Analysis>('/trips/analyze',input))}catch(e){setError(e instanceof Error?e.message:'Could not compare routes.')}finally{setLoading(false)}
 }
 function example(){const time=DateTime.now().setZone('America/Chicago').plus({hours:1}).startOf('hour');const value:TripDraft={origin:{label:'Dallas, TX, United States',coordinates:[-96.797,32.777],timezone:'America/Chicago'},destination:{label:'Atlanta, GA, United States',coordinates:[-84.388,33.749],timezone:'America/New_York'},date:time.toISODate()!,time:time.toFormat('HH:mm'),timezone:'America/Chicago',load:'36,000',spacing:25};setDraft(value);void submit(value)}
 return <main className="landing"><div className="landing-photo"/><div className="landing-wash"/><div className="landing-content"><header className="landing-header"><Brand/><span className="header-caption">EVERY MILE, MORE INFORMED</span></header><section className="hero-copy"><h1>Smarter routes.<br/>Safer journeys.</h1><p>A better route starts with a look ahead.<br className="desktop-break"/> Compare weather risk and travel time for your load.</p></section><div className="landing-form-card"><TripForm draft={draft} onChange={setDraft} onSubmit={()=>void submit()} onExample={example} loading={loading} error={error}/><div className="trust-row"><span><CloudSun/><span>Weather along<br/>your entire route</span></span><span><ShieldCheck/><span>Recommendations<br/>built for your load</span></span><span><MoveRight/><span>A better way<br/>forward</span></span></div>{result&&<p className="temporary-result" role="status">{result.routes.length} routes calculated. {result.recommendation.reason}</p>}</div><footer className="landing-footer"><span>Made for the miles ahead.</span><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Forecasts by Open-Meteo <ArrowUpRight size={12}/></a></footer></div></main>
}
