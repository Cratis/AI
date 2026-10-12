<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Identity, authorization and discovery access

Verified at `Cratis/Arc.TypeScript` **v0.57.2** (GitHub pre-release, not on npm):
`Source/Core/authentication/**`, `identity/**`, `introspection/**`,
`Documentation/core/authentication.md`, `authorization.md`,
`Documentation/identity/**`, `hosts/native-principal.md`, and
`upgrading/secure-defaults.md`. This is the **TypeScript server** contract,
not the .NET authentication skill.

## Authenticate at one trusted boundary

| Boundary | Builder options | Trust requirement |
| --- | --- | --- |
| Arc verifies bearer JWTs | `authentication: [jwtBearer({ jwksUrl, issuer, audience, algorithms })]` | HTTPS JWKS URL; pin issuer, API audience and asymmetric algorithms; validate API tokens, not an ID token |
| Host middleware already verified identity | `nativePrincipal: true`, plus the adapter's verified native-context callback | Bridge HTTP and WebSocket upgrades explicitly; a raw request/header is not a principal |
| EasyAuth/AuthProxy ingress | `authentication: [microsoftIdentityPlatform()]` | Strip client `x-ms-client-principal*` headers, set trusted ones and block direct backend access |
| Application credential check | `authentication: [handler]` | Implement `AuthenticationHandler`; do not trust the display cookie |

`nativePrincipal` and Arc authentication handlers are mutually exclusive.
Handlers return `AuthenticationStatus.Anonymous` (try next), `Authenticated`
(with principal), or `Failed` (401 even for an anonymous operation). Principals
require authenticated status, string `id`, string-array `roles`; name, claims
and scheme are optional. Arc freezes the principal, roles and own claims.
With no handler, protected operations answer 403 rather than authenticating.

For Entra bearer tokens, verify against the tenant-specific issuer and API
audience. App roles and delegated scopes are different; require the one the API
actually uses. Do not put bearer tokens in query-string URLs. Native identity
must also be provided on upgrades/SSE; configuring HTTP middleware alone does
not authenticate a WebSocket upgrade. Named schemes belong in
`authenticationSchemes: { Verified: handler }` and are selected with
`@authorize({ schemes: ['Verified'] })`.

## Authorize the operation, not the UI

With no decorator, anonymous callers are permitted. `@authorize()` requires authentication;
`@authorize({ policy, roles, schemes })` adds requirements, and `@roles('A', 'B')`
accepts any listed role. Stacked requirements all pass. `@allowAnonymous()` cannot
coexist with an authenticated requirement on the same declaration. Commands
carry decorators on the **class**, never `handle`/`provide`; query methods may
override the read-model class's declaration. Policies and row filters use the
verified principal, not an input role/tenant or a hidden button.
Observable authorization runs at subscription opening; changing a role later
needs an emission guard to stop further disclosure.

## Supply identity details

`@identityDetailsProvider()` on an exported provider lets discovery register it;
`builder.add(Provider)` is also supported. Implement `IdentityDetailsProvider`
with `detailsType` (a `@field` model) or `schema` and
`provide(principal, context)`. Returning undefined denies the authenticated
caller; output must match the schema.

`GET /.cratis/me` serves principal id/name/roles plus provider `details` and sets
`.cratis-identity`. This unsigned, JavaScript-readable cookie is **display data,
never a credential**; provider details never flow into authorization. The
published React identity hooks can display it, but server protection still
belongs on every operation. Local users/tenants are development fixtures, not
production credentials; keep simulated identities on loopback hosts.

## Secure introspection defaults (0.56.0+)

`/.cratis/commands`, `/.cratis/queries`, `/.cratis/identity-details/schema`,
`/.cratis/users`, `/.cratis/tenants`, and `/openapi.json` are anonymous only in
Development by default. Elsewhere they require an authenticated principal from
Arc handlers or the native host. Without authentication, protected discovery is
unmapped (normally 404) with a startup warning. Explicitly requiring auth with
none configured fails startup.

- `introspection.requireAuthentication: false` deliberately restores anonymous
  discovery; outside Development it logs a warning. Prefer authenticating tools.
- `introspection.roles: 'Admin,Operator'` accepts any listed role, implies auth,
  and cannot combine with `requireAuthentication: false`; empty roles fail.
- `introspection.enabled: false` unmaps **catalogs and HTTP OpenAPI**, not identity
  discovery. Its access policy/diagnostics and in-process metadata remain.
- Node config: `Cratis:Arc:Introspection:Enabled/RequireAuthentication/Roles` or
  `Cratis__Arc__Introspection__Enabled/RequireAuthentication/Roles` environment keys.
- `environmentName` is code-only. Otherwise the first defined
  `DOTNET_ENVIRONMENT`, `ASPNETCORE_ENVIRONMENT`, `NODE_ENV` decides; no environment
  is Production. `development: true` enables fixture providers, not this bypass.

`/.cratis/me`, command/query invocation and observable transports are unaffected
by the discovery policy. Deployed Lens/curl/OpenAPI consumers must authenticate
or rely on a deliberate anonymous opt-out. Source-based proxy generation needs
no running host. Verify both anonymous and authenticated access after upgrades.
