<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Observable queries and hubs

A client reads one `@observe` query four ways from one route: a plain `GET`, direct
Server-Sent Events (`Accept: text/event-stream`), a direct WebSocket upgrade, or a shared
hub that carries many subscriptions on one connection.

## The two hubs

Both speak one protocol (`Connected`, `Subscribe`, `Unsubscribe`, `QueryResult`,
`Unauthorized`, `Error`, `Ping`/`Pong`) through `Arc.Plug.HubSession`.

| | WebSocket | Server-Sent Events |
| --- | --- | --- |
| Open | `GET /.cratis/queries/ws` | `GET /.cratis/queries/sse`; first event is `Connected` with the connection id |
| Subscribe | a `Subscribe` message | `POST /.cratis/queries/sse/subscribe` with `{connectionId, queryId, revision, request}` |
| Unsubscribe | an `Unsubscribe` message | `POST /.cratis/queries/sse/unsubscribe` |

- A subscription carries a revision, so a delayed subscribe cannot bring back a cancelled one.
- **An SSE control request must come from the caller that opened the stream.** An unknown
  connection or a different caller is `404`; a malformed body is `400`.
- The tenant of an SSE subscription is that of the control `POST`, not the stream.
- Each subscription goes through the ordinary pipeline, so authorization, filters and the
  tenant apply as for a `GET`.
- The generated React client uses the WebSocket hub by default;
  `QueryTransportMethod.ServerSentEvents` selects SSE.

## Transfer modes

`ObservableQueryTransferMode.Full` sends a snapshot every time. `Delta` sends a snapshot
first and then only the change set (`added`, `replaced`, `removed`); with no preference
each emission carries both. The hub computes the change set per subscription by comparing
with the previous emission, so **a source needs nothing extra**. Items match on an `id`
member (any case); without one the change set has additions and removals only. An ordered
or paged query always sends the snapshot too, because position matters.

## What triggers a re-run

- `watch: [ReadModel]` re-runs when Chronicle changes that read model.
- `watch: [Arc.MongoDB.watch(Doc)]`, or any `{module, target}` for a module implementing
  `Arc.Watch`, re-runs when that source reports a change.
- `topics: ["name"]` re-runs on `Arc.Notifier.notify(MyApp.Arc, "name")`. It reaches
  **subscriptions on the same node only**; across nodes broadcast with `Phoenix.PubSub`
  and notify in each receiver.

Re-runs are debounced by 25 ms. A subscription is a `:temporary` process: a failure ends
it and the client resubscribes.

## Authentication of browser connections

Use cookies. A plug in front of `Arc.Plug` can turn a sign-in cookie and a tenant cookie
into the headers Arc reads (the showcase's `Samples.Web.CookieIdentity` does, for a demo).
