# RouteWise implementation plan

Source of truth: assessment.pdf. Visual references: landing-reference.png and results-reference.png.

## Task 1: Foundation and tested calculations
React/TypeScript/Vite/Tailwind frontend; Django REST Framework backend. Pure risk classification, distance-weighted summaries and lexicographic recommendation. Tests for every threshold and load override. No login or persistent trip database.

## Task 2: Live trip analysis
Mapbox geocoding/directions; checkpoints every 10/25/50 miles plus endpoints. ETA from segment durations. Open-Meteo wind, rain + showers and snowfall at arrival. UTC internally and IANA zones for display. Honest errors and missing coverage.

## Task 3: Approved screens
Truck-image landing with real form; map workspace with compact editable trip summary, 3 route cards and checkpoint details. Responsive and accessible. No invented delay estimates. Live example trip uses same analysis endpoint.

## Task 4: Forecast and polish
25-mile corridor buffer/grid, <=150 grid samples, 49 forecast frames, locally scrubbed weather-risk overlay. Arrival-time risks do not change when scrubbing. Independent overlay loading/failure.

## Task 5: Delivery
Tests, production build, Chrome DevTools desktop/mobile review, Docker/Render config, README and Loom script. Publish only when account access is available; do not represent local readiness as deployment.

## Decisions
- At overlapping rain/snow boundaries use higher severity except strict No Travel >1 in/hr rain, >3 in/hr snow.
- Segment risk = worse endpoint. Average risk = distance-weighted 0..4 severity.
- No Travel routes are visible but excluded; incomplete weather suppresses recommendation.
- Mapbox may return fewer than 3 routes: display actual count, never fabricate alternatives.
- No driver rest model or cargo weight treated as total truck weight.
- Missing credentials produce actionable configuration error, not fake live data.
