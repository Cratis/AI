---
applyTo: "**/Deployment/**,**/*AuthProxy*,**/*Capabilit*,**/Mcp/**"
paths:
  - "**/Deployment/**"
  - "**/*AuthProxy*"
  - "**/*Capabilit*"
  - "**/Mcp/**"
---
# The AuthProxy is the first and the last line of defense; applications never authenticate

Every line is **[contract]** (binding; see [`general.md`](./general.md)). The AuthProxy is the only
component that decides who a caller is, and it does so before a request reaches an application. An
application trusts the identity and tenant the proxy forwards and contains no code that decides who
a caller is. A surface that reaches an application without the proxy having authenticated the
caller is a security hole, however well the application checks it afterwards.

## The application never authenticates

- **No code in an application checks a caller's credential to grant access:** no bearer-token,
  JWT, API-key, personal-access-token, password or signature check on a request, no middleware,
  filter or `Authorization` header reader that decides who is calling. Do not build one, and do
  not copy one from another Cratis product. Move an existing one to the proxy.
- **Last line means unreachable around the proxy.** An application accepts traffic only from the
  proxy: a network policy lets only the proxy reach its listener, and it trusts only the identity
  and tenant headers the proxy writes (the proxy strips inbound copies). Where available, verify the
  proxy's forwarded-identity signature; that verifies the proxy, not the caller.
- **The application may issue and revoke, never verify.** It may mint a token (signed with a
  private key that never leaves it, public key published through issuer metadata and JWKS), set
  expiry, record revocation, and answer the proxy's introspection question about a token's state
  without reading any credential to do so. It may answer the proxy's back-channel question for
  client credentials. The proxy validates every token on every call.

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
  sender's signature, public metadata (`/.well-known/oauth-protected-resource*`, issuer metadata
  and public keys) and an introspection endpoint that only reports whether a presented token is
  active. Each entry names the narrowest prefix, and the reason sits beside it.

## How a non-browser caller gets in

Declare the route on the AuthProxy so the proxy authenticates before the request is forwarded:

- **Bearer route with an issuer.** `BearerRoutes` with `PathPrefix`, `Issuers`, `Audiences` and
  `RequiredScopes`. The proxy validates the signature, `iss`, `aud`, `exp`/`nbf` and scopes, reads
  the tenant from a single tenant claim, and forwards the principal. Set `Introspection` on the
  issuer so a revoked token stops working within seconds.
- **Client credentials.** The caller posts a client id and secret to `/.cratis/token`; the proxy
  asks the application's internal back-channel endpoint whether they are good, mints a short-lived
  token scoped to one route prefix and the tenant the application named, and validates it on every
  call.
- **Personal access tokens** (`PersonalAccessTokens` on a bearer route) are recognized by the proxy
  but not authenticated by it, so the backend would have to authenticate each one. Do not use them.

## Tenancy

- The organization comes from the token's tenant claim, resolved by the proxy (`Claim` strategy,
  or `Route`/`Host`/`SubHost` constraints that refuse a token for another tenant with `403`). It
  never comes from a header, a query string, a request body or a tool argument.
- A credential belongs to one tenant. Someone in several organizations holds one per organization.
- The application still enforces the tenant and membership it receives. That is authorization of
  the forwarded identity, not authentication, and a second layer.

## Prove it before shipping

- A Pulumi mock spec reads the rendered AuthProxy configuration and fails when a path that serves
  a credential-bearing endpoint is in `AnonymousPaths` or `PassCallerAuthorizationPaths`.
- A spec or scan fails when application code reads the `Authorization` header or validates a JWT,
  key or password on a request.
- Calling the endpoint through the proxy without a token gives `401`; with a token for another
  tenant `403`; with a spoofed `x-cratis-tenant-id` or `x-ms-client-principal*` header the header
  is ignored; a request that skips the proxy is refused by the network.
