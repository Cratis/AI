# Hosting and storage for Arc for TypeScript

Verified against `Cratis/Arc.TypeScript` `main` at commit `94d398d` (tag
`v0.33.0` plus three commits): `Documentation/overview.md`, `hosts/**`,
`mongodb/getting-started.md`, `sql/getting-started.md`,
`chronicle/registration-options.md`, and the `Express`, `Fastify`, `Hono`,
`MongoDB`, `Drizzle` and `Chronicle` package exports. None of these packages is
published to npm; install them from a clone or packed tarballs.

## The host only delivers requests

The core owns the application model; a host delivers requests to it. Commands,
queries, validators and services do not change when the host changes. Build the
application once, in its own module, so every host imports the same instance:

```typescript
// arc.ts
import { ArcApplication } from '@cratis/arc.core';
import { Tasks } from './Features/Tasks/Tasks.js';
import { metadata } from './Features/generatedMetadata.js';

const builder = ArcApplication.createBuilder();
builder.useGeneratedMetadata(metadata);
builder.services.addSingleton(Tasks);
await builder.discover(new URL('./Features/', import.meta.url));
export const arc = await builder.build();
```

| Host | Package and entry point | Framework peer |
| --- | --- | --- |
| Standalone Node host | `@cratis/arc.core`: `app.run()` or `app.start()` | none |
| Your own `node:http`/`node:https` server | `@cratis/arc.core`: `createArcNodeHandler(server)` | none |
| Express 5 | `@cratis/arc.express`: `app.use(cratisArc(arc))` | `express` `^5.0.0` |
| Fastify 5 | `@cratis/arc.fastify`: `app.register(cratisArc, { arc })` | `fastify` `^5.0.0` |
| Hono 4 | `@cratis/arc.hono`: `app.use(cratisArc(arc))`; Node: `serveCratisArc` | `hono` `^4.0.0`; optional `@hono/node-server` `^1.19.11` |
| Fetch API host | `@cratis/arc.core/fetch`: `app.fetch(request)` | none |

Every adapter dispatches only exact raw-path matches on a fixed internal origin
(a crafted `Host` header cannot select an operation), hands Arc the unparsed
body, and passes a cancellation signal that becomes `context.signal`. The
framework owns its listener: close it, then `await arc.dispose()`.

## Express

```typescript
import express from 'express';
import { cratisArc } from '@cratis/arc.express';
import { arc } from './arc.js';

const app = express();
const middleware = cratisArc(arc);
app.use(middleware);           // before any body parser
app.use(express.json());
const listener = app.listen(3000, '127.0.0.1');
middleware.injectWebSocket(listener);

process.once('SIGTERM', () => {
    void (async () => {
        try { await middleware.close(listener); }
        finally { await arc.dispose(); }
    })();
});
```

- Mount `cratisArc(arc)` **before** `express.json()` or any body parser. A parser
  that runs first consumes the body, and every command answers 400
  `malformedRequest`.
- Express middleware does not see Node `upgrade` requests; attach observable
  WebSockets with `middleware.injectWebSocket(listener)`.
- `cratisArc(arc, native)` takes a callback returning trusted native context,
  used with the `nativePrincipal: true` builder option to pass a principal your
  own session or token middleware already verified.

## Fastify

```typescript
import Fastify from 'fastify';
import cratisArc from '@cratis/arc.fastify';
import { arc } from './arc.js';

const app = Fastify();
await app.register(cratisArc, { arc });
await app.listen({ port: 3000, host: '127.0.0.1' });
process.once('SIGTERM', () => { void app.close().then(() => arc.dispose()); });
```

- The plugin is encapsulated, with its own catch-all raw-body parser; your
  parsers are unchanged. WebSockets are on by default (`webSockets: false`
  disables them).
- Fastify's `bodyLimit` (1 MiB by default) applies before Arc's
  `hosting.maxBodyBytes`; raise both for larger bodies, or Fastify answers 413.
- Arc's routes exist once the app is ready (after `listen`, `ready`, or the
  first `inject`). Do not register your own routes on Arc's paths.

## Hono

```typescript
import { Hono } from 'hono';
import { cratisArc, serveCratisArc } from '@cratis/arc.hono';
import { arc } from './arc.js';

const app = new Hono();
app.use(cratisArc(arc));
app.get('/health', context => context.text('ok'));
const hosted = await serveCratisArc(app, arc, { port: 3000, hostname: '127.0.0.1' });
process.once('SIGTERM', () => { void hosted.dispose().then(() => arc.dispose()); });
```

- Running on Node needs the optional `@hono/node-server`. There the adapter also
  checks the raw request-target. Other Hono runtimes cannot attest that raw-path
  defense and are not verified, even for HTTP/SSE.
- `serveCratisArc` starts a Node listener with WebSocket upgrades; it does not
  dispose `arc`.

## Fetch API entry

`@cratis/arc.core/fetch` runs the same command and query pipelines without an
Arc-owned listener. It cannot discover files, load configuration files, serve
static files, or upgrade WebSockets — `discover()` fails on its builder.
Register artifacts explicitly:

```typescript
import { ArcApplication } from '@cratis/arc.core/fetch';
import { Ping } from './Ping.js';
import { Status } from './Status.js';

const builder = ArcApplication.createBuilder();
builder.add(Ping, Status);
export const app = await builder.build();
// host: (request: Request) => app.fetch(request)
```

Import `command`, `query`, `readModel` from `@cratis/arc.core/fetch` in artifacts
served this way. Arc targets **Node-compatible** servers: Chronicle uses gRPC,
MongoDB uses TCP, and live queries need long-lived SSE/WebSocket connections.
Non-Node edge runtimes are not supported hosts for the framework or these
integrations. Bun has a smoke check only. The host owns ingress limits, trusted
principal metadata, and cancelling long-lived streams on disconnect.

## Observable-query WebSockets from a dev server

A browser WebSocket from a frontend dev server on another port is cross-origin
and is refused silently. Add that origin to `query.allowedOrigins`:

```typescript
ArcApplication.createBuilder({ query: { allowedOrigins: ['http://127.0.0.1:5173'] } });
```

## Storage integrations

Arc requires no database and no event store. Each integration is optional and
adds a builder method when imported; the exported function form is equivalent.

| Integration | Register | Inject |
| --- | --- | --- |
| MongoDB (`@cratis/arc.mongodb`, peer `mongodb` `^6.21.0`) | `import '@cratis/arc.mongodb'; builder.withMongoDB({ client, databaseNameResolver, readModels: [TaskRecord] })` or `withMongoDB(builder, options)` | `service(mongoCollection(TaskRecord))` in `@query`, or `@inject(mongoCollection(TaskRecord))`; `commandReadModel(TaskRecord)` in commands |
| SQL through Drizzle (`@cratis/arc.drizzle`, peer `drizzle-orm` `^0.45.0`) | `import '@cratis/arc.drizzle'; builder.withDrizzle({ dialect: DrizzleDialect.SQLite, database, readModels: [{ type: TaskRecord, table: tasks }] })` | `service(drizzleReadModel(TaskRecord))` for read-only query handles; `@inject(drizzleDatabase<SQLJsDatabase>())` for a writable handle in commands; `commandReadModel(TaskRecord)` |
| Chronicle (`@cratis/arc.chronicle`, experimental, peer `@cratis/chronicle` `^6.7.0`) | `import '@cratis/arc.chronicle'; builder.withChronicle({ connectionString, eventStore })` or `withChronicle(builder, options)` | Commands return events; queries take `service(ChronicleReadModels)`; `commandReadModel(Type)` |

- **MongoDB**: list every injected model in `readModels`; a model left out has
  no collection token. `@key()` marks the field stored as `_id` (otherwise a
  field named `id`). Only `server` and `database` bind from `Cratis:MongoDB`
  configuration. Change-stream observation needs a replica set.
- **Drizzle**: `withDrizzle` never creates or changes tables — own the schema
  with migrations. Every SQL access needs a tenant (`A tenant is required for
  Drizzle access` otherwise); a single-database setup resolves one fixed tenant.
  Command read-model injection needs exactly one column-level `.primaryKey()`
  declared as an Arc `@field`.
- **Chronicle**: `withChronicle` needs `eventStore` and exactly one of
  `connectionString` or `client` (`Chronicle requires eventStore and exactly one
  of connectionString or client`). It reads `Cratis:Chronicle` `connectionString`
  and `eventStore` from configuration; code wins. Call it before or after
  `discover()`, but before `add()` for Chronicle-only artifacts. With
  `connectionString`, Arc owns and disposes the SDK client; a caller-owned
  `client` is never disposed by Arc. Every append and read uses the current
  tenant as the Chronicle namespace (`Default` when none). A kernel that is not
  reachable makes Chronicle-backed requests wait, not fail.
  `chronicle://localhost:35000` without credentials uses the development client —
  local kernels only.
- `@cratis/cratis` (experimental) registers Arc and Chronicle together through
  `CratisApplication.createBuilder()` and `builder.addCratis(...)`. Unlike C#
  `AddCratis`, it installs no authentication handler; protected routes still
  need one you choose.
