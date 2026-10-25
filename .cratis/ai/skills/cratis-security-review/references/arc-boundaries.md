# Arc security checks

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

Source: Arc. Each source below is a path in the Arc repository.

- Enable `TrustForwardedIdentityHeaders` only behind an authenticating ingress
  that strips caller identity headers, replaces them and prevents direct backend
  access. Headers are unsigned, not proof of identity. Without the explicit
  host-wide opt-in Arc ignores them. Custom handlers must honor the same flag.
  [Secure defaults](https://github.com/Cratis/Arc/blob/main/Documentation/upgrading/secure-defaults.mdx).
- Application code must not read `.cratis-identity`. The backend derives identity
  from the authenticated principal; the JS client only falls back to the legacy
  cookie on 404, never on 401/403. Use `clearCache()` on logout. Browser identity
  remains display state, not server authorization.
  [Backend provider](https://github.com/Cratis/Arc/blob/main/Source/DotNET/Arc.Core/Identity/IdentityProvider.cs),
  [JS provider](https://github.com/Cratis/Arc/blob/main/Source/JavaScript/Arc/identity/IdentityProvider.ts).
- Test all discovery routes outside Development. Default access is authenticated
  there, or 404 when the host cannot authenticate. Explicit
  `RequireAuthentication=false` opens discovery in every environment;
  `Enabled=false` removes catalogs, not identity discovery. Disable both switches
  when neither is needed. `[ExcludeFromDiscovery]` hides documentation/catalogs,
  not invocation or authorization.
  [Introspection](https://github.com/Cratis/Arc/blob/main/Documentation/backend/csharp/introspection/index.md).
- Check ARC0019/0020/0021: conflicting declarations, Microsoft attributes without
  the ASP.NET integration, and schemes on the standalone host. Microsoft
  `[Authorize]` is enforced only by the ASP.NET host; policies/schemes fail closed
  on supported hosts. A method declaration **replaces** the type declaration.
  Guest access requires every policy in the declaration to opt in
  (`evaluatesAnonymous`), without roles/schemes.
  Requires Arc 22.44.2 for guest endpoints to be
  reachable through HTTP even with an authenticated fallback policy. Keep an
  intentional `IFallbackAuthorizationEvaluator` baseline; it is separate from
  ASP.NET's `FallbackPolicy`.
  [Authorization descriptors](https://github.com/Cratis/Arc/blob/main/Source/DotNET/Arc.Core.CodeAnalysis/DiagnosticDescriptors.cs),
  [guest endpoint specs](https://github.com/Cratis/Arc/tree/main/Source/DotNET).
- The embedded `/.cratis/event-model` viewer defaults to Debug **and** Development.
  Explicit `Enabled=true` overrides that default: check that deployed hosts have
  not enabled it, rather than claiming Production can never map it.
  [Exposure implementation](https://github.com/Cratis/Arc/blob/main/Source/DotNET/Screenplay.Embedded/Hosting/EventModelViewerExposure.cs).
- Generated identifiers are not secrets, authorization proofs or idempotency
  keys. [Generated values](https://github.com/Cratis/Arc/blob/main/Source/DotNET/Arc.Core/Commands/ModelBound/GeneratedValueAttribute.cs).
- Arc telemetry records type/name/outcome metadata and correlation/tenant ids,
  not command/query/event payload values or validation/exception messages. Do not
  widen it with sensitive payloads or mistake this for a promise of no ids.
  [Telemetry names](https://github.com/Cratis/Arc/blob/main/Source/DotNET/Arc.Core/WellKnownTelemetryNames.cs).
- Returned reactor commands marked `[ExecuteCommandsAsSystem]` use a narrow
  disposed system scope.
  Requires Arc 22.72.0 so the system scope never carries the caller principal (earlier versions leaked it);
  manually executing commands still needs explicit actor ownership.
  [Executor](https://github.com/Cratis/Arc/blob/main/Source/DotNET/Chronicle/Reactors/CommandSideEffectExecutor.cs).
- Revocable observable data needs `IGuardObservableQueryEmission`; it applies to
  plain HTTP snapshots/waits/long polls too. Suppression withholds data; denial
  terminates/returns unauthorized. Never read the producer's ambient principal.
  [HTTP processing](https://github.com/Cratis/Arc/blob/main/Source/DotNET/Arc.Core/Queries/ObservableQueryHttp.cs).
- Query health remains explicitly anonymous and returns connection health. Audit
  exposure of connection user ids (tracked by Arc#2873), not just catalogs:
  discovery restrictions are not blanket protection of `/.cratis/*`.
  [QueryHealth](https://github.com/Cratis/Arc/blob/main/Source/DotNET/Arc.Core/Queries/QueryHealth.cs),
  [subscription client UserId](https://github.com/Cratis/Arc/blob/main/Source/DotNET/Arc.Core/Queries/QuerySubscriptionClientInfo.cs).
