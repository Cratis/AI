---
applyTo: "**/Deployment/**,**/*AuthProxy*,**/*Capabilit*,**/Mcp/**"
paths:
  - "**/Deployment/**"
  - "**/*AuthProxy*"
  - "**/*Capabilit*"
  - "**/Mcp/**"
---
# The AuthProxy authenticates; the application never does

Every line is **[contract]** (binding; see [`general.md`](./general.md)). The AuthProxy is the only
component that decides who a caller is. An application behind it trusts the identity and tenant the
proxy forwards and nothing else. A surface that reaches an application without the proxy having
authenticated the caller is a security hole, however well the application checks it afterwards.

## Never expose a credential-bearing path unauthenticated

- **A path that carries a credential is never an `AnonymousPaths` entry.** That includes MCP (`/mcp`),
  OpenAI-compatible and other API surfaces (`/v1`), and anything else a caller presents a token,
  key or secret to. An anonymous path is reachable by anyone who knows the URL; the proxy strips
  identity from it and does not authenticate it.
- **`PassCallerAuthorizationPaths` is not a way around this.** Forwarding the caller's
  `Authorization` header so the application verifies it moves authentication into the application.
  Use it only for a request that signs itself with its own scheme (a webhook with a signature
  header), never for a bearer token, API key or personal access token.
- **What may be anonymous:** health, static public content, a webhook receiver that verifies the
  sender's signature, and public metadata (`/.well-known/oauth-protected-resource*`, issuer
  metadata and keys). Each entry names the narrowest prefix, and the reason sits beside it.

## How a non-browser caller gets in

Declare the route on the AuthProxy as a **bearer route** or by **client credentials**, so the
proxy authenticates the token before the request is forwarded:

- **Bearer route with an issuer.** `BearerRoutes` with `PathPrefix`, `Issuers`, `Audiences` and
  `RequiredScopes`. The proxy validates the signature, `iss`, `aud`, `exp`/`nbf` and scopes, reads
  the tenant from a single tenant claim, and forwards the principal. Set `Introspection` on the
  issuer so a revoked token stops working within seconds.
- **Client credentials.** The caller posts a client id and secret to `/.cratis/token`. The proxy
  asks the application's internal verification endpoint whether they are good, mints a short-lived
  token scoped to one route prefix and the tenant the application named, and validates it on every
  call. Cratis Studio's MCP does this.
- **The application may be the issuer, never the edge verifier.** It can mint tokens (signed with
  a private key that never leaves it, public key published through issuer metadata and JWKS), set
  expiry, revoke, and answer introspection. The proxy validates them on a bearer route. The
  application does not read the `Authorization` header to decide who a caller is.
- **Personal access tokens** (`PersonalAccessTokens` on a bearer route) are recognized by the proxy
  but not authenticated by it, so the backend would have to authenticate each one. Do not use them
  for a new surface; prefer an issuer or client credentials.

## Tenancy

- The organization comes from the token's tenant claim, resolved by the proxy (`Claim` strategy,
  or `Route`/`Host`/`SubHost` constraints that refuse a token for another tenant with `403`). It
  never comes from a header, a query string, a request body or a tool argument.
- A credential belongs to one tenant. Someone in several organizations holds one per organization.
- The application still checks the tenant and membership it receives (the proxy documents that the
  backend decides membership). That is a second layer, not a substitute.

## Prove it before shipping

- Read the rendered AuthProxy configuration (Pulumi mock spec) and fail when a path that serves a
  credential-bearing endpoint is in `AnonymousPaths` or `PassCallerAuthorizationPaths`.
- Call the endpoint through the proxy without a token and expect `401`; with a token for another
  tenant and expect `403`; with a spoofed `x-cratis-tenant-id` or `x-ms-client-principal*` header
  and expect it ignored.
- The application is not reachable around the proxy: a network policy lets only the proxy reach
  its listener, or the application refuses requests without the proxy's forwarded identity.
