export async function api<T>(path:string, body?:unknown, signal?:AbortSignal):Promise<T> {
 let response:Response
 try { response=await fetch(`/api${path}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal}) }
 catch(e) { if(e instanceof Error && e.name==='AbortError') throw e; throw new Error('Unable to connect. Check your connection and try again.') }
 const data=await response.json().catch(()=>({message:'The service returned an unexpected response. Please retry.'}))
 if(!response.ok) {
  const details=data.fields ? Object.values(data.fields).flat().filter(v=>typeof v==='string').join(' ') : ''
  throw new Error(details || data.message || 'Something went wrong. Please try again.')
 }
 return data as T
}
