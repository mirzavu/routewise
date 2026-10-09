# Loom walkthrough: 7–8 minutes

## Before recording

Configure Mapbox, verify the deployed URL, and identify a live trip that returns three alternatives. Current weather may be mild; do not invent hazardous live conditions. Use the automated threshold tests to demonstrate rules if there is no interesting weather on the live route. Keep the repository and application open. Check forecast availability through arrival.

## 0:00–0:45 — Problem and scope

Explain that RouteWise compares weather exposure at the time a truck reaches each checkpoint. Mention React + Django and the focus on a clear trip-planning experience.

## 0:45–1:45 — Plan a trip

Enter origin/destination, departure and cargo weight. Explain 10/25/50-mile sampling. Submit and describe the transition from form to compact trip summary.

## 1:45–3:15 — Compare routes

Point out the recommended route and explain the exact ranking order: Severe miles, High miles, average risk, then duration. Inspect another route without changing the recommendation. Show distance, arrival, risk mileage and checkpoint count. Explain No Travel exclusion.

## 3:15–4:15 — Arrival-time weather

Open a checkpoint on the map or list. Show ETA, wind/rain/snow units and the risk explanation. Discuss the cargo wind overrides and why missing weather is never treated as low risk.

## 4:15–5:00 — Forecast exploration

Move the slider through 48 hours and toggle the overlay. Explain that this is a sampled corridor forecast, and that scrubbing does not change arrival-time route scores. All frames are fetched once, so scrubbing stays local.

## 5:00–6:30 — Code and tests

Show provider adapters, pure risk functions, geometry sampling, and one threshold/ranking test. Explain segment-duration interpolation, unit normalization, batching/caching, and why a stateless API was sufficient.

## 6:30–7:30 — Practical decisions

Show mobile layout and Edit trip. Explain provider limits on route alternatives, forecast horizon, driving-time assumptions, and deployment. Finish with the repository and hosted URL.

Do not claim a live behavior was tested unless it was actually checked with configured providers.
