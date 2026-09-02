# Application Layer

This directory is intentionally empty. Human UI and HTTP API routes did not end up living here.

Actual runtime structure:

* HTTP routing, request/response handling and the middleware chain (capability core → Direct Mailbox → Agent Profile → TCLK) live in `lib/runtime/` (`router.ts`, `server.ts`, `*-router.ts`, `*-service.ts`).
* The browser UI is static, dependency-free JavaScript/CSS served directly from `web/` (no build step, no framework).

See `docs/architecture.md` for the current system boundaries and `lib/README.md` for the domain-layer structure that actually exists.

No code should be added under `app/` without first updating this file and `docs/architecture.md` to reflect the real structure — do not resurrect the `api/`, `agent/`, `trials/`, `verify/` plan below without an explicit decision, since none of it was built and `lib/runtime/` already covers this responsibility.

Original plan (superseded, kept for history — see `docs/project-context/DECISIONS.md`):

* `api/`
* `agent/`
* `trials/`
* `verify/`
