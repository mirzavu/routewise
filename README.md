# RouteWise

A weather-aware truck route planner built with React and Django for the Spotter full-stack assessment. Enter a trip and cargo weight, compare route alternatives, and inspect weather at the time the truck is expected to reach each checkpoint.

## Run locally

Requirements: Node 24+, Python 3.12+, [uv](https://docs.astral.sh/uv/), and a Mapbox account/token.

```bash
cp .env.example .env
# Set MAPBOX_ACCESS_TOKEN in .env. Keep this file private.
uv sync
npm ci --prefix frontend
uv run python backend/manage.py runserver
```

In a second terminal:

```bash
npm run dev --prefix frontend
```

Open http://localhost:5173. Vite proxies `/api` to Django on port 8000. Restart Django after editing `.env` and reload the browser to pick up token changes. The application displays an actionable error when routing is not configured; it never substitutes synthetic routes or weather.

`MAPBOX_PUBLIC_TOKEN` optionally supplies a separate URL-restricted `pk.` token for browser maps. If omitted, a public `MAPBOX_ACCESS_TOKEN` is also used for the map. Never use a secret `sk.` token as the public token. Grant only required Mapbox scopes and include localhost and the deployment URL in public-token restrictions. A server token must allow server-side geocoding and Directions requests.

The **Try an example trip** action submits Dallas → Atlanta, 36,000 lb, departure at the next hour and 25-mile checks to the same live endpoint used by the form. This trip has been verified with three genuine Mapbox routes and complete arrival-time forecasts. Routing availability can change; fewer distinct alternatives are shown honestly when necessary.

## Architecture

- `frontend/`: React + TypeScript + Vite; Tailwind and custom CSS, self-hosted fonts, Mapbox GL JS. The map workspace is lazy-loaded after trip analysis. Form state is retained while editing.
- `backend/trips/`: DRF validation, provider adapters, pure risk calculations, checkpoint geometry, and weather normalization.
- Stateless trip analysis; no user accounts, saved trips, queue or persistent trip database. Django's local-memory weather cache lasts 15 minutes and is per worker.
- Routing and weather requests run server-side; only the map's public token is exposed to the browser. Autocomplete is debounced, older requests are aborted, and temporary geocoding results are not cached or persisted.

### Endpoints

| Method / endpoint | Input | Result |
| --- | --- | --- |
| GET `/api/config` | — | Public map token and routing availability |
| GET `/api/health` | — | Health status |
| GET `/api/locations?q=…` | Search text, at least 3 characters | Labels, `[longitude, latitude]`, IANA timezone |
| POST `/api/trips/analyze` | `origin`, `destination`, ISO departure, `load_lb`, `spacing_miles` | Routes, checkpoints, risk summaries, recommendation, warnings |
| POST `/api/weather/corridor` | Up to 3 route coordinate arrays, `load_lb`, and ISO 8601 `departure` | Corridor sample grid and 49 hourly risk frames from departure |

Locations contain `label`, `coordinates` and `timezone`. All API dates include an offset; calculations use UTC. Coordinates always use longitude first. Validation errors return a human-readable `message` and optional `fields`. Provider outages return 502/503, no route returns 422. Anonymous requests are throttled in-process.

## Risk rules and assumptions

The original brief is in [docs/assessment.pdf](docs/assessment.pdf). Risk calculations are authoritative on the server.

| Risk | Wind (mph) | Rain (in/hr) | Snow (in/hr) |
| --- | --- | --- | --- |
| Low | <25 | <0.10 | <0.5 |
| Moderate | 25–<35 | 0.10–<0.25 | 0.5–<1.0 |
| High | 35–<45 | 0.25–<0.50 | 1.0–<2.0 |
| Severe | 45–<55 | 0.50–1.00 | 2.0–3.0 |
| No Travel | ≥55 | >1.00 | >3.0 |

The brief overlaps at some rain/snow endpoints. This implementation chooses the higher category at those overlaps, while preserving the explicit strict No Travel thresholds. Classification uses unrounded values.

Load overrides: wind ≥55 mph blocks every load; 45–<55 mph with cargo >30,000 lb blocks travel; 35–<45 mph with cargo >40,000 lb is Severe. Cargo weight is not treated as total vehicle weight for road restrictions.

- A checkpoint takes the maximum of wind/rain/snow and applicable load risk.
- Checkpoints include both endpoints and the final partial interval. Distances and arrival times interpolate within Mapbox road-segment annotations, not a constant average trip speed.
- An interval takes the worse risk of its two endpoints. Mileage sums use real interval lengths; average risk is distance-weighted on a 0–4 scale.
- Recommendation order is strictly `(Severe miles, High miles, average risk, travel seconds)`. Routes with No Travel exposure are excluded. If every route is blocked, none is recommended. If any alternative has incomplete weather, a full recommendation is withheld.
- Hourly wind is interpolated at arrival. Rain plus showers and snowfall use the preceding-hour accumulation record whose interval contains arrival. Snowfall depth is kept separate from liquid-equivalent precipitation.
- Departures are accepted from now through the next six days, reserving time for travel within the seven-day request. All arrival times are checked against actual returned forecast coverage. Missing weather is unknown, never Low. The UI rejects nonexistent or ambiguous daylight-saving times.
- ETAs are driving estimates, without rest stops, hours-of-service, loading stops, or custom truck restrictions. This is the assessment's weather comparison model, not a truck-navigation engine.
- Mapbox's initial alternatives request can return only one or two routes. To try to obtain three, up to two additional requests guide through a point to either side of the fastest route's distance midpoint, offset by 10% of its mileage (maximum 80 miles). The point guides the provider without adding a stop. Supplemental routes must be within 25% of the fastest route's distance and 35% of its time; U-turns, more than 2% repeated-edge mileage and over 90% overlap with an existing shorter route are rejected. Road edges are compared at five decimal places. Supplemental service failure preserves the original routes. No geometry or timing is invented.

### Forecast overlay

The corridor grid covers a 25-mile buffer around the route alternatives. Grid spacing starts at 25 miles and coarsens to keep at most 150 weather samples. This never changes the chosen checkpoint spacing. The backend batches/caches weather requests and returns 49 hourly frames. The browser interpolates this sampled risk field for display on a canvas-backed raster layer. It is a forecast visualization, not live radar; it is not used to calculate route risk.

The slider ranges from the exact selected departure (0h) through departure +48 hours, displayed in the selected trip timezone. Non-hour departures keep their minutes on each hourly frame and tick. The corridor request uses the same timezone conversion as trip analysis; changing the departure reloads its frames and resets the slider. The full 48-hour span remains visible regardless of trip duration. Hours beyond provider coverage show unavailable weather, with no risk color. Scrubbing changes only the overlay; rankings and checkpoint weather remain tied to arrival times. Frames are updated locally without network requests. Overlay failure leaves route results usable.

Timeline icons show the wind, rain or snow condition producing the highest corridor risk at that hour, using the same thresholds and cargo wind overrides as the risk band. Tied conditions appear together; a shield indicates all three are Low, and a question mark indicates unavailable risk details. Icon colors match the risk band. General weather condition codes do not choose these icons.

On the map, small dots show all route checkpoints. Larger weather markers appear at every checkpoint with Moderate or higher arrival-time risk (score 1–4), using the same wind/rain/snow symbols and risk colors as the timeline. Tied contributors appear together, and each tooltip identifies the route, checkpoint, condition and arrival-time risk. Selecting a checkpoint enlarges its marker.

The timeline marks the selected route's exact arrival time with a vertical line and local time label. Selecting another route moves the marker without changing the forecast hour. Trips ending after the 48-hour window show their arrival in a note instead of placing a marker at an incorrect time.

## Tests and checks

```bash
uv run pytest -q
uv run ruff check backend
npm test --prefix frontend
npm run build --prefix frontend
```

Backend tests cover thresholds, cargo overrides, ranking, checkpoint interpolation, partial intervals, weather units and intervals, missing coverage, and API validation. Frontend tests cover timezone conversion and DST, editing location searches, trip submission/recovery, route selection, checkpoint inspection, and slider independence. Tests use isolated provider fixtures; production has no demo-data fallback.

Visual review is manual: check the landing page at desktop and mobile widths, submit a trip, switch routes, inspect a checkpoint, scrub the forecast, and edit the trip. Live Mapbox smoke testing requires configured credentials. The generated hero background and user-supplied logo are bundled local assets. The asset prompt is recorded in [docs/assets.md](docs/assets.md).

Playwright also verifies the live trip flow. Mapbox GL JS needs WebGL2; if the browser cannot initialize it, an actionable message appears while route results and checkpoint-list inspection remain usable. Check `chrome://gpu` for browser graphics status. Enabling Chrome's graphics setting does not guarantee WebGL is available if the browser has blocked its graphics stack.

## Deployment

A single container serves the built frontend through WhiteNoise and runs Django with Gunicorn.

```bash
docker build -t routewise .
docker run --rm -p 8000:8000 --env-file .env routewise
```

For Render, push this repository to GitHub and create a Blueprint from `render.yaml`. Set Mapbox tokens when prompted. Render generates the Django secret and supplies its hostname. The blueprint defaults to the free plan, which may sleep when idle; check the hosted app before recording. Add the hosted URL to the public map token's allowed URLs.

GitHub Actions runs tests, Python lint, and the production frontend build. The deployment health check is `/api/health`; it checks app availability, not external provider health. Gunicorn writes access and error logs to the host. Provider error handling avoids logging credential-bearing URLs.

Submission: GitHub repository URL, hosted application URL, and a 5–10 minute Loom walkthrough. Use [docs/walkthrough.md](docs/walkthrough.md) to prepare the recording. Account-dependent publishing and live routing verification must be completed before submitting.
