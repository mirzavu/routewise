export default function Brand({onClick}:{onClick?:()=>void}) {
 return <button className="brand" onClick={onClick} aria-label="RouteWise home"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 37 23 8a2 2 0 0 1 4 0l16 29H29L18 23"/><path className="brand-road" d="m8 37 16-14 8 8"/></svg><span>Route<span className="brand-blue">Wise</span><small>A clearer road ahead.</small></span></button>
}
