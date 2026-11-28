# Start a Node host

Use the Node application builder when the server should load host configuration. Explicit options override configuration; the Fetch entry point does not load configuration files. In the Library example (`Features/` is example-specific), the generated metadata and features are in the same package as the entry point:

```typescript
import { ArcApplication } from '@cratis/arc.core';
import { metadata } from './Features/generatedMetadata.js';

const builder = ArcApplication.createBuilder();
builder.useGeneratedMetadata(metadata);
await builder.discover(new URL('./Features/', import.meta.url));
const app = await builder.build();
await app.run({ port: 3000 });
```

Register dependencies required by the discovered features before building.

## Embed in an existing listener

Mount Arc on the existing host instead of starting a second listener. For live queries, use the adapter's upgrade support; a finite HTTP query does not prove WebSocket registration. In native-principal mode, supply verified caller context to the upgrade bridge as well as HTTP.

| Host | Mount and upgrade |
| --- | --- |
| Express | Mount `cratisArc(arc)` before body parsers; reading the body first makes commands answer 400 `malformedRequest`. Express middleware does not see upgrades; call `middleware.injectWebSocket(listener, upgradeNative)` for live queries (`upgradeNative` is needed in native-principal mode; the Express HTTP callback never sees upgrades). Use `middleware.shutdown(listener)`. |
| Fastify | `app.register(cratisArc, { arc })` installs raw-body handling and upgrades. WebSockets are on unless `webSockets: false`; do not attach another handler. The registration's `native` callback covers HTTP and upgrades. Raise both Fastify's `bodyLimit` (1 MiB default; Fastify answers 413 above it) and Arc's `hosting.maxBodyBytes` when accepting larger bodies. |
| Hono on Node | On an existing listener, mount `cratisArc(arc, native)` and call `middleware.injectWebSocket(listener)` for live queries. If starting a Hono listener, use `serveCratisArc(app, arc, { port, native })` to attach upgrades automatically; pass `native` to the middleware too in native-principal mode. |
| `node:http` | Create the request listener with `createArcNodeHandler(arc.server)`. This handles HTTP, not upgrades; for WebSockets wire `attachNodeWebSockets(listener, arc.server, upgradeNative)` separately. |

Coordinate shutdown with `shutdownArcHost(arc.server, closeListener)` from `@cratis/arc.core/hosting`, or Express's wrapper above. Pass the adapter's transport-aware close/dispose callback when it provides one. Listener-only `close()` does not drain Arc participants or dispose Arc services.

## Deployment configuration

The Node builder applies, in increasing priority: `appsettings.json`, `appsettings.{Environment}.json`, `Cratis__` environment variables, then explicit code options. For example, `Cratis__Arc__CorrelationId__HttpHeader=X-Request-ID` overrides the files, and `correlationId: { httpHeader: 'X-Code-ID' }` overrides that variable. Use `configuration: { file, env }` to supply a file path or URL and an environment map explicitly. The `@cratis/arc.core/fetch` builder and `new ArcServer(options)` do not bind configuration files or `Cratis__` overrides. Development identity and detailed exception responses are independent settings.

Set transport options under `query`. `Query:KeepAliveInterval` in configuration is `hh:mm:ss`; `query.keepAliveIntervalMs` in code is milliseconds (`0` disables it in code only).

- Bound concurrent work with `maxObservableSubscriptions`, `maxObservableHubConnections`, their `PerCaller` variants, and `maxObservableHubSubscriptionsPerConnection`.
- Bound queued frames with `maxObservableInboundFrames` and `maxObservableOutboundFrames`; bound individual frames with `maxObservableInboundFrameBytes` and `maxObservableOutboundFrameBytes`.
- Configure `allowedOrigins`, `observableHandshakeTimeoutMs`, and `observableShutdownTimeoutMs` for the deployed transport. Use `cratis-arc-diagnose-live-query` if snapshots work but live subscriptions fail.

## Run trusted host work in a scope

Verify the caller and authorize the work before creating `const scope = server.services.createScope(context)`. This captures the execution context at scope creation. Run trusted work with `server.runInScope(scope, callback, options)`; per-call options are only `correlationId` (a valid UUID) and `signal` (an extra abort signal linked to the scope's signal). Dispose the caller-owned scope after the work settles. Scope creation and `runInScope` are not authentication or authorization. Never build a trusted principal from unverified request values.
