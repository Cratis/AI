<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Query pipeline, filters, renderers, interceptors and hubs

## Contents

- Order of stages
- Global query filters
- Renderers (provider-owned results)
- Read-model interceptors (one shaping rule for every query)
- Read consistency with Chronicle
- Hubs and health

Source: `Cratis/Arc.TypeScript`: `Documentation/queries/{query-pipeline,query-filters,renderers,read-model-interception,read-consistency,query-health,observable-query-demultiplexer}.md`,
`Source/Core/queries/index.ts`. Use this when a query must be gated for every
caller, reshaped before it leaves the server, or served by a provider that pages
itself.

## Order of stages

| Step | Configured with | Failure |
| --- | --- | --- |
| 1 Authentication | `authentication` handlers or native principal | 401 |
| 2 Tenant | `tenancy` | 400 or 403 when required |
| 3 Read arguments | query string for GET, JSON body for `QUERY` | 400 `malformedRequest` |
| 4 Declared authorization | `@roles`, `@authorize`, `@allowAnonymous` | 403 |
| 5 Bind arguments | `argument(...)` descriptors or a Zod `schema` | 400 `malformedRequest` |
| 6 Per-request authorization | `authorize(input, context)` on low-level definitions | 403 |
| 7 Global authorization filters | scoped `AuthorizationQueryFilter` services | 403; a throwing filter fails closed with 500 |
| 8 Global ordinary filters | scoped `QueryPipelineFilter` services | 400 validation, 500 exception |
| 9 Validation | `QueryValidator`, concept validators | 400 with every result |
| 10 Perform | the query method | 500 when it throws |

Result stages then run in the same scope: **renderer** (first whose `canRender`
accepts the value), **read-model interceptors** (exact runtime class), sorting
and paging (in memory for arrays; a `queryPage` is used as is), encoding. For
an observable query the guard stages run **once** when the subscription opens;
result stages run for the snapshot and **every** emission. Emission-time access
needs an emission guard (see `cratis-arc-command-typescript`,
`identity-and-introspection.md`).

## Global query filters

`AuthorizationQueryFilter` runs first, before validator and performer
dependencies are constructed; `QueryPipelineFilter` follows. Both implement
`onPerform(context: QueryContext)` and return a `QueryResult` fragment or
nothing. Helpers: `unauthorizedQueryResult(context)` (403, no reason),
`queryFilterResult(context, { validationResults })`.

```typescript
import { authorizationQueryFilter, unauthorizedQueryResult,
    type AuthorizationQueryFilter, type QueryContext, type QueryResult } from '@cratis/arc.core';

@authorizationQueryFilter()
class TenantGate implements AuthorizationQueryFilter {
    onPerform(context: QueryContext): QueryResult | void {
        if (!context.tenantId) return unauthorizedQueryResult(context);
    }
}
// builder.add(TenantGate) -- or addAuthorizationQueryFilter(token) / addQueryPipelineFilter(token)
```

`@queryPipelineFilter()` is the matching decorator for ordinary filters.
`context` carries the bound `query`, request identity, `options` and an
`operationName` equal to the declaration identity shown in introspection.
Order inside each group: `ArcOptions` tokens, explicit builder calls, then
decorated classes in `add()` order. A token registered twice runs once; a token
in both groups fails at `build()`. Arc applies `context.allowedSeverity` to each
fragment before deciding to stop; denial always stops the chain. Filters do not
run per emission.

## Renderers (provider-owned results)

When the method returns a provider query object that counts and pages itself,
implement `QueryRenderer` with `@queryRenderer()`:
`canRender(value)` and `render(value, context, options)`, returning data or
`queryPage(items, totalItems, sorting)` with the provider's authoritative total.
Register with `builder.add(Renderer)` or `addQueryRenderer(token)`; low-level
`ArcOptions.queryRenderers`. Only the first accepting renderer runs, and the
renderer must own sorting and paging itself.

## Read-model interceptors (one shaping rule for every query)

```typescript
@readModelInterceptor()
class PublicAccountName implements ReadModelInterceptor<AccountSummary> {
    readonly model = AccountSummary;
    intercept(account: AccountSummary): AccountSummary { /* return a copy */ }
}
```

Runs on ordinary results, observable HTTP snapshots and each emission, for the
top-level result, array items and `queryPage` items. It matches the **exact
runtime class**, is not applied to deeper nested instances (for example a joined
`select` result), and a failure fails the query. Return a replacement; never
mutate a model another subscriber shares. Register with `builder.add` or
`addReadModelInterceptor(token)`; low-level `ArcOptions.readModelInterceptors`.

## Read consistency with Chronicle

A successful append commits events but does not mean an active projection shows
them yet. Choose per read: default (`models.getById(View, id)`), immediate
(mark the model-bound projection `@passive` and pass
`ChronicleReadConsistency.Immediate`), or wait after write
(`withChronicle({ ..., completionTimeoutMs })`). Chronicle waits for **every**
observer on the event log, so a lagging unrelated observer makes the wait run
to the timeout. Details: `cratis-arc-command-typescript`, `chronicle-events.md`.

## Hubs and health

One client connection can carry many subscriptions: the WebSocket hub at
`/.cratis/queries/ws` (plain `@cratis/arc` client default) and the SSE hub at
`GET /.cratis/queries/sse` with `POST .../subscribe` and `.../unsubscribe`
(`<Arc>` React provider default). `queryName` is the query's full identity.
Every subscription is authorized independently. Browser `EventSource` cannot
set an `Authorization` header, so sign-in for SSE needs the real session
cookie, not the display-only identity cookie. Control requests must come from
the caller that opened the connection. Size limits are in
`cratis-arc-command-typescript`, `configuration.md`.

`query: { enableObservableHealth: true }` registers an authenticated,
caller-scoped `/.cratis/queries/health` observable query. It lists only the
caller's own tenant and principal hub connections, subscription counts and
query groups; it is off by default.
