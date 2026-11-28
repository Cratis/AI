# Distinguish opening from later delivery

Collect the `Flow` directly under the selected tenant and prove both its first value and a later change. Then inspect the browser's WebSocket handshake. When a dev server runs on a different port, Spring can refuse the origin with 403 before any collector opens. Configure `cratis.arc.observable-queries.allowed-origins` narrowly for the development origin, not a wildcard. Keep the exception out of production. An open socket with no later value points instead to source buffering, tenant routing or cancellation.
