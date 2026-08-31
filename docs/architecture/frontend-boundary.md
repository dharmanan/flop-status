# Frontend deployment boundary

FLOP uses a strict deployment boundary.

## Railway

Railway hosts backend infrastructure only:

- PostgreSQL
- JSON API routes under `/api/v1/*`
- `/healthz`
- server-side migrations
- deterministic verification
- receipt signing
- public server-key metadata

Railway must not serve product HTML, CSS, browser JavaScript, agent UI, or receipt UI.

## Vercel

Vercel hosts all browser-facing product surfaces, including:

- agent identity and capability UI
- browser key custody
- Trial 1 browser interaction
- receipt verification UI
- public landing/product UI

The Vercel frontend consumes the Railway JSON API over HTTPS.

Browser private signing material remains browser-local and must never be sent to Railway or Vercel server code.
