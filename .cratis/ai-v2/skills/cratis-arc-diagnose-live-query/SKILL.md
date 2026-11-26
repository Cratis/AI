---
name: cratis-arc-diagnose-live-query
description: Use when a real-time query connects over SSE or WebSocket but the expected update never arrives. Not for adding an endpoint (cratis-arc-expose-query).
compatibility: The SSE diagnostic uses Node.js.
---

# Locate the first missing emission

1. Start from the actual generated query route, transport, scoped test identity and disposable namespace. Establish what storage should contain before and after one permitted registration. **Done:** one known ID and expected change distinguish this operation from other writers. If the read model never materializes, stop at the observer rather than debugging React.
2. Open a direct query GET with `Accept: text/event-stream` and buffering disabled, authenticating through the application's protected test client. Wait for a ready, successful `data:` frame before triggering the change. A snapshot with `waitForFirstResult=true` is useful for the initial read but disposes after one result. **Done:** the baseline frame is known; an HTTP 200, heartbeat or 202 not-ready result does not count.
3. Register Aster once and compare keyed storage, next direct frame, then the browser's subscription and rendered row. Bound the wait and close the connection. **Done:** name the first missing signal: absent storage row, missing server delivery, or received frame without rendered state. If the second frame is denied, inspect current access/emission guards rather than removing them. Record IDs and verdicts, never headers, credentials or whole payloads. For a received frame with a stale screen, pass the generated query and row key to [Bind the slice in React](../cratis-arc-react-bind-slice/SKILL.md).

For SSE, pipe the protected test client's unbuffered response into `node scripts/check-frames.mjs` from the skill directory, with a timeout on the client. It prints only ready-result counts. Trigger the change after result 1; expect result 2 on the same connection, then check the expected key in the application. Frame counts alone do not prove the row changed.
