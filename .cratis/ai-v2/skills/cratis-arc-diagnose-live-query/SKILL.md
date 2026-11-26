---
name: cratis-arc-diagnose-live-query
description: Use when an observable query endpoint connects but the expected update never arrives. Not for adding an endpoint (cratis-arc-expose-query).
---

# Locate the first missing emission

1. Start from the actual generated query route, transport, scoped test identity and disposable namespace. Establish what storage should contain before and after one permitted registration. **Done:** one known ID and expected change distinguish this operation from other writers. If the read model never materializes, stop at the observer rather than debugging React.
2. Open a direct query GET with `Accept: text/event-stream` and buffering disabled, authenticating through the fixture's protected client. Wait for a ready, successful `data:` frame before triggering the change. A snapshot with `waitForFirstResult=true` is useful for the initial read but disposes after one result. **Done:** the baseline frame is known; an HTTP 200, heartbeat or 202 not-ready result does not count.
3. Register Aster once and compare keyed storage, next direct frame, then the browser's subscription and rendered row. Bound the wait and close the connection. **Done:** name the first missing signal: absent storage row, missing server delivery, or received frame without rendered state. If the second frame is denied, inspect current access/emission guards rather than removing them. Record IDs and verdicts, never headers, credentials or whole payloads. For a received frame with a stale screen, pass the generated query and row key to `cratis-arc-react-bind-slice`.
