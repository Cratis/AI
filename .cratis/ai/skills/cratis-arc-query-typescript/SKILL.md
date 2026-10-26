---
name: cratis-arc-query-typescript
description: Use when declaring Arc Node.js read-model queries or observable endpoints. Not for React proxy consumption, server commands or Chronicle event materialization.
license: MIT
---

# Add a query to an Arc read model in TypeScript (Node.js server)

In Arc for TypeScript a read model is a decorated class, and its reads are
**static** methods on it marked `@query()`. Each query becomes a route; Arc binds
the arguments, resolves services, pages and sorts, and wraps every answer in the
same `QueryResult` envelope. There is no controller to write.

Arc for TypeScript is a **source preview**: `@cratis/arc.core` and the other
server packages are not published to npm, and the API may change. `@cratis/arc`
is the separate, published **client** that generated query proxies import in a
frontend. Project setup, the builder, and hosts are in
`cratis-arc-command-typescript`.

## Verified product sources

Read [references/product-sources.md](references/product-sources.md) for the source files; RxJS is an optional peer for RxJS sources.

## Declare a read model and its queries

`Samples/Tasks/Features/Tasks/Listing/Listing.ts`:

```typescript
import { field } from '@cratis/fundamentals';
import { query, readModel, service } from '@cratis/arc.core';
import type { BehaviorSubject } from 'rxjs';
import { TaskId } from '../TaskId.js';
import { TaskTitle } from '../TaskTitle.js';
import { Tasks } from '../Tasks.js';

@readModel()
export class TaskItem {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    @query(service(Tasks))
    static allTasks(tasks: Tasks): TaskItem[] { return tasks.all(); }

    @query()
    static taskById(id: TaskId, tasks: Tasks): TaskItem | undefined { return tasks.byId(id); }

    @query()
    static observeAllTasks(tasks: Tasks): BehaviorSubject<TaskItem[]> { return tasks.observeAll(); }
}
```

Arc serves a method only when all three hold:

- the class carries `@readModel()` (from `@cratis/arc.core`) and is exported under
  the discovery root,
- the method is `static`,
- the method carries `@query(...)`.

Any other static method is an ordinary helper with no route. `@query()` on an
instance or private method throws when the class loads; `@roles`, `@authorize`,
`@allowAnonymous` or `@path` on a static method without `@query()` fails at
`build()`. The `@field` declarations (from `@cratis/fundamentals`) describe the
shape Arc encodes on the way out and that the proxy generator uses for the
frontend model — keep one on every wire property.

## Bind every parameter

Each parameter is one of three kinds:

| Descriptor | Binds |
| --- | --- |
| `argument(name, Type, { optional?, elementType? })` | A named argument from the query string or `QUERY` body |
| `service(Token)` | A service from the request's scope (or the subscription's, for an observable query) |
| `queryOptions()` | The request's paging and sorting, as `QueryOptions` |

TypeScript erases parameter types, so Arc learns them one of two ways:

- **Generated artifact metadata** (the samples): with `builder.useGeneratedMetadata(metadata)`
  installed before discovery, bare `@query()` is enough. A primitive, concept, or
  array of them becomes a named argument; a concrete class becomes a service. That
  is how `taskById(id: TaskId, tasks: Tasks)` binds.
- **Explicit descriptors**, one per parameter in signature order:
  `@query(argument('id', TaskId), service(Tasks))`. Explicit descriptors always
  win over generated ones.

A parameter nobody describes fails at `build()` with `Unbound parameters on
<Type>.<method>` (or `Missing parameter metadata` for a bare `@query()` without
metadata). TypeScript error TS1241 on `@query(...)` means the descriptors do not
match the parameters. Regenerate metadata after every change and gate CI with
`arc-proxygenerator --check-metadata`.

### Arguments

```typescript
@query(argument('tags', Array, { elementType: String }),
       argument('limit', Number, { optional: true }))
static search(tags: string[], limit: number | undefined): Item[] { /* ... */ }
```

- Type an optional argument `number | undefined`, not `limit?: number`.
- GET names match case-insensitively; numbers, booleans, `Guid` and concepts are
  converted from text. An undeclared argument, an invalid value, or a repeated
  non-array key answers 400 `malformedRequest`.
- `page`, `pageSize`, `sortBy`, `sortDirection` are reserved and never reach your
  arguments.
- A query cannot take generic type arguments from HTTP.

## Return what the caller should see

| The method returns | The caller gets |
| --- | --- |
| An array of the model | `data` is the array; Arc pages and sorts it in memory on request |
| One model | `data` is the object |
| `undefined` or `null` | HTTP 200, `isSuccess: true`, **no** `data` property |
| `queryPage(items, totalItems, sorting?)` | `data` is `items`; `paging` reports your totals |
| An observable source | A live query (below) |

- A method can be `async` or return a promise of any of these.
- **Absence is an answer, not an error.** Declare `TaskItem | undefined` when
  absence is possible — with generated metadata, returning `undefined` from a
  method declared `TaskItem` fails.
- **Let storage failures throw.** A thrown error is a failed result with status
  500 (message redacted unless exception details are enabled). Never catch and
  return `undefined` or `[]`, or the caller cannot tell "none" from "down".
- Concepts are encoded to their primitive: a `TaskId` goes out as a UUID string.

## Route and HTTP method

The route is `/api/<discovery-namespace>/<method-name>` in kebab case —
`TaskItem.allTasks` in `Features/Tasks/Listing` is `GET /api/tasks/listing/all-tasks`.
`@path('/api/custom')` on the method overrides it; `@readModel({ namespace })`
pins the namespace across folder moves.

Every query route accepts GET and the HTTP `QUERY` method, whose JSON body is
`{ "arguments": {...}, "paging": { "page", "pageSize" }, "sorting": { "field", "direction" } }`.
`QUERY` answers carry `Cache-Control: no-store`. Use it for structured arguments.
`generatedApis: { enableQueryHttpMethod: false }` turns it off (405 with
`Allow: GET`). `@query({ httpMethod: QueryHttpMethod.Query })` only sets the
generated client's preference; it does not change the server. OpenAPI describes
queries as GET only. OpenAPI includes `POST <command route>/validate` with
operation id `<id>:validate`; paging/sorting parameters only for array/`queryPage`
queries (metadata-free arrays need `generatedReturn: { cardinality: 'many', nullable: false }`).
401 appears only when authentication can produce it. `/openapi.json` is protected
by the secure discovery defaults; read
[the identity/introspection reference](../cratis-arc-command-typescript/references/identity-and-introspection.md)
when configuring discovery access or identity.

## Page and sort

- An array result is sorted, then paged, in memory: `?pageSize=2&page=0&sortBy=title&sortDirection=desc`.
  `page` is zero-based. `pageSize` of 0 or less, or a negative page, answers
  400. Sorting in memory requires the field on every item; a non-array result
  asked to page or sort answers 400.
- In-memory complex-field sorting (object/array/map or a concept over one) answers
  400 `malformedRequest`, or a validation frame after streaming starts. Concepts
  sort by their underlying scalar value (including numeric/chronological values);
  temporal values sort naturally and null concepts join other nulls. Generated
  complex-field `sortBy` helpers are deprecated: sort on scalar fields.
- To cut the page in the data source, add `queryOptions()` and return
  `queryPage(items, totalItems)`. `items` must be exactly the requested page.
  If the request asked for sorting, pass the applied sort as the third argument —
  otherwise 400; Arc never re-sorts a page it did not cut.
- A provider can throw `QueryPagingRequired(maxPageSize)` or `InvalidQuerySort`
  to report its own limits as 400 validation results.
- The MongoDB and Drizzle integrations' `queryPage(...)` push count, sort and
  paging into the database for you. Server-side paging semantics shared with
  Arc .NET are in `cratis-arc-query-paging`.

## Declare an observable query

Return a live source and the same route serves a snapshot on GET and streams
changes to subscribers:

```typescript
@query()
static observeAllTasks(tasks: Tasks): BehaviorSubject<TaskItem[]> { return tasks.observeAll(); }
```

Arc must know a query is observable **before** registration. Generated metadata
infers it from the declared return type; without metadata, say so explicitly:
`@query({ observable: true }, service(Tasks))`. A snapshot query that returns a
live source anyway throws `SnapshotStreamError`, without subscribing or calling
`unsubscribe()` on a shared Subject. Arc releases it once through its available
async/sync disposal, `dispose`, `close`, or `return` hook;
`snapshotStreamSource(result)` is exported from core.

| Source | Snapshot GET |
| --- | --- |
| RxJS `BehaviorSubject<T>` | 200 immediately with the current value; new subscribers receive it first |
| RxJS `Subject<T>` / `Observable<T>` | 202 with `isReady: false` until the first emission; `?waitForFirstResult=true` (optionally `waitForFirstResultTimeout=<seconds>`, max 120) waits |
| RxJS `ReplaySubject<T>` | 202 even after an emission; a waiting GET receives the buffered value |
| `AsyncIterable<T>` | No current value until the first item |
| `CurrentValueSubject<T>` | Deprecated — use `BehaviorSubject` or `Subject` |

- Use `BehaviorSubject` when there is always a current value. Emit `undefined`
  for "looked, nothing there" (200, ready, no `data`); stay silent only when you
  genuinely do not know yet (202). Let errors be errors — a source error ends the
  subscription with a failed result.
- Each subscription runs the method **once**, after authorization and
  validation, with its own service scope, disposed when it ends.
  `currentContext()` from `@cratis/arc.core` returns the subscription's context;
  its `signal` aborts when the subscriber leaves.
- Paging and sorting apply to **every** emission, in memory. An observable query
  cannot return `queryPage`; narrow what the source emits instead, or use a
  database-backed observation such as MongoDB change streams or opted-in Drizzle
  observation (see the storage reference below).
- Transports: `Accept: text/event-stream` on the route (direct SSE, one
  `data: <QueryResult>` frame per change), a direct WebSocket upgrade
  (`{"type":"Data","data":<QueryResult>}` frames, `Ping`/`Pong`), or the
  multiplexed hub that generated `@cratis/arc` proxies use. Framework adapters
  mount WebSockets separately; a browser on a dev-server origin needs that origin
  in `query.allowedOrigins`. Terminal inspection is `cratis-arc-observable-query-http`.

## Authorize a query

`@authorize()`, `@authorize({ policy?, roles?, schemes? })`, `@roles(...)` and
`@allowAnonymous()` work on the read-model class and on `@query()` methods. An
explicit method declaration **replaces** the class declaration; without one, the
method inherits it — so a class `@allowAnonymous()` does not bypass a method
`@roles('Reader')`. A denied caller never reaches the method (`isAuthorized:
false`).

- A role decides who may call, not which rows they see. Filter rows by the
  caller inside the method or source, from `currentContext()?.principal`, never
  from a caller-supplied argument and never on the client.
- For an observable query, authorization runs **once**, when the subscription
  opens. A revoked role does not close it; add an observable emission guard when
  access must be re-checked while the stream runs.

## Serve stored read models

The storage integrations register tenant-scoped service tokens; a query never
chooses a database itself.

Read [references/storage-examples.md](references/storage-examples.md) for worked MongoDB, Drizzle and Chronicle query examples.

- MongoDB: every injected model is listed in `withMongoDB`'s `readModels`;
  `observe()` needs a replica set. Build owner filters from the verified
  principal, never from a caller-provided filter object.
- Drizzle: `drizzleReadModel(Model)` is a read-only handle; writes belong in
  commands through `drizzleDatabase()`. Live queries require opt-in
  `DrizzleObservation.InProcess` announcements or experimental PostgreSQLNotify;
  `rxjs` is a required peer of `@cratis/arc.drizzle`.
- Protected raw MongoDB reads need typed `MongoReadModels` with `readModel`
  registered with Chronicle (optional `subjectFor`). Untyped reads and
  `MongoDBWatcher.changes()` still expose stored ciphertext.

- Chronicle: `ChronicleReadModels` offers `getAll`, `getById`, `observeAll`,
  `observeById` for the current tenant's namespace. Projecting happens after the
  append, so a query right after a command can be stale; a live query updates
  when the projection catches up. Projection authoring is
  `cratis-chronicle-client-typescript`.

Read [references/storage-observation-and-compliance.md](references/storage-observation-and-compliance.md)
when implementing Drizzle observation or serving protected raw MongoDB documents.

## Specify the query

`@cratis/arc.testing` runs the real query pipeline in-process. From
`Samples/Tasks`:

Read [references/scenario-example.md](references/scenario-example.md) when you need a worked scenario context class.

- `QueryScenario.for<T>(ReadModel, 'methodName', ...artifacts)` — `T` is the
  **wire** shape (`data` is JSON-shaped; concepts arrive as strings), not a
  rehydrated model.
- `perform(arguments, { paging, sorting }?)` returns the actual `QueryResult`,
  e.g. `perform({}, { sorting: { field: 'title', direction: SortDirection.Ascending }, paging: { page: 0, pageSize: 1 } })`.
- `QueryScenario.perform()` throws `StreamingQueryNotSupportedError` for
  observable queries: use `ObservableQueryScenario` instead.
- `ObservableQueryScenario.collect(count, timeoutMs = 5000, arguments?, options?)`
  returns `{ emissions, completed, rejection }`; a rejected subscription lands in
  `rejection`, not `emissions`. Always assert the emission count.
- `withContext({ principal, tenantId })` sets a trusted caller for authorization
  specs. Register fakes before the first call; dispose every scenario.

## Route near misses

- Defining or changing a command, the builder, or hosts:
  `cratis-arc-command-typescript`.
- A query-argument rejection rule (`QueryValidator`, arguments model):
  `cratis-arc-validation-typescript`.
- Calling the generated query proxies from React: `cratis-arc-react-page`.
- Chronicle projections, reducers and reactors in TypeScript:
  `cratis-chronicle-client-typescript`.
- Inspecting an observable query with curl: `cratis-arc-observable-query-http`.
- The .NET query shape: `cratis-arc-query-paging` and the vertical-slice rules;
  Kotlin/Java: `cratis-arc-query-kotlin`.

## Verify

- Every query is a public `static` method with `@query(...)` on an exported
  `@readModel()` class; no helper is exposed by accident.
- Every parameter is bound — by generated metadata that `--check-metadata`
  confirms is current, or by descriptors in signature order.
- Declared return types admit absence where it is possible, and storage failures
  throw rather than returning empty data.
- Observable queries are declared observable (by metadata or
  `{ observable: true }`) and use a `BehaviorSubject` when a snapshot GET must
  answer 200.
- Row-level filtering uses the verified principal inside the source.
- `QueryScenario` / `ObservableQueryScenario` specs pass, including paging,
  absence, and denied callers.
- Guidance never claims the server packages are on npm, and never confuses
  `@cratis/arc` (the client) with `@cratis/arc.core` (the server).
