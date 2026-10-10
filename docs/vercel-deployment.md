# Deploy on Vercel

1. Import `mirzavu/routewise`, branch `feat/routewise`.
2. Keep **Root Directory** as `./` and **Application Preset** as **Services**.
3. Refresh the import page after this configuration is pushed. It should detect `frontend` and `app` from `vercel.json`.
4. Add the environment variables below to the project, then deploy.

| Variable | Value |
| --- | --- |
| `MAPBOX_ACCESS_TOKEN` | Mapbox token used for server-side geocoding and routing |
| `MAPBOX_PUBLIC_TOKEN` | Public `pk.` token used for browser maps |
| `DJANGO_SECRET_KEY` | A generated, private random value |
| `DJANGO_DEBUG` | `false` |

Use the values from your local `.env` for the Mapbox tokens. Generate a production Django secret with `uv run python -c "import secrets; print(secrets.token_urlsafe(48))"`.

Vercel preview domains are accepted automatically. For a custom domain, set `DJANGO_ALLOWED_HOSTS` to its hostname; the production URL provided by Vercel is also accepted.

After deployment:

- Add your deployment URL to the public Mapbox token's allowed URLs.
- Open `/api/health`; it should return `{"status":"ok"}`.
- Submit a trip and confirm routes, checkpoint weather, and the forecast load.

The frontend's assets are served by Vercel. API requests retain their `/api` paths when routed to Django. Trips are stateless; the weather cache and request throttle are local to each function instance.
