export type Coordinates = [number, number]
export interface Location { label: string; coordinates: Coordinates; timezone: string }
export interface TripDraft { origin: Location | null; destination: Location | null; date: string; time: string; timezone: string; load: string; spacing: number }
export interface TripInput { origin: Location; destination: Location; departure: string; load_lb: number; spacing_miles: number }
export interface Risk { level: number | null; label: string; reasons: string[] }
export interface Checkpoint { index: number; mile: number; coordinates: Coordinates; eta: string; weather: { wind_mph: number | null; rain_in_hr: number | null; snow_in_hr: number | null }; risk: Risk }
export interface Route { id: string; name: string; geometry: { type: 'LineString'; coordinates: Coordinates[] }; distance_miles: number; duration_seconds: number; arrival: string; checkpoints: Checkpoint[]; summary: { risk_miles: number[]; severe_miles: number; high_miles: number; no_travel_miles: number; unknown_miles: number; average_risk: number | null; complete: boolean; highest_risk: number | null; segments: { start_mile: number; end_mile: number; level: number | null }[] } }
export interface Analysis { routes: Route[]; recommendation: { route_id: string | null; reason: string }; warnings: string[]; weather_fetched_at: string }
export interface Corridor { points: Coordinates[]; bounds: [number, number, number, number]; spacing_miles: number; times: string[]; frames: (number | null)[][]; fetched_at: string }
export const RISK_LABELS = ['Low', 'Moderate', 'High', 'Severe', 'No Travel']
export const RISK_COLORS = ['#2bab86','#e9c34a','#f58b35','#ee5365','#8739ba']
export const ROUTE_COLORS: Record<string,string> = { A:'#2379ef',B:'#f69840',C:'#b268d7' }
