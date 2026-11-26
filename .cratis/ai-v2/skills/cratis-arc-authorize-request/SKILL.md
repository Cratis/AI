---
name: cratis-arc-authorize-request
description: Use when configuring authentication, authorization or permissions for an Arc query or command. Not for partitioning tenant data (cratis-arc-isolate-tenant).
---

# Enforce access before data leaves the server

1. Identify who authenticates the caller and which principal reaches Arc. Accept forwarded identity headers only behind an ingress that authenticates, strips incoming copies and is the sole route to the app. Otherwise leave trust disabled. **Done:** an arbitrary client-supplied actor cannot become a catalog editor.
2. Require the server permission on the command and separately on the read method. For a live query whose membership can change, register an `IGuardObservableQueryEmission` checking current server-side access before each delivery. A connection-time role check alone does not detect revocation. **Done:** an insufficient caller sees neither rows nor side effects, even without the UI. If the task is to scope the rows within granted access, use `cratis-arc-isolate-tenant`.
3. Exercise anonymous, insufficient and authorized callers against the real dispatch/transport. After a permitted subscription's initial response, revoke access then produce another update. **Done:** only the authorized operation succeeds, denied writes leave the stream unchanged, and no new protected payload crosses the connection after revocation. A guard runs at delivery, not on a timer; don't assert instant idle disconnect. Record verdicts and fixture IDs only, never tokens or claims dumps.
