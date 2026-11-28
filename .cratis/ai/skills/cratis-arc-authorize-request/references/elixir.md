# Enforce admission at the server in Elixir

Authenticate at the request boundary before Arc evaluates operation rules. In the command module declare `authorize roles: ["editor"]`. For a rule based on claims instead, register a policy module and declare `authorize policy: :can_publish`. Read-model declarations apply across the module unless a query overrides them.

Invoke the command as a signed-in editor and then a reader. The reader should get `isAuthorized: false` without running validation or the handler. If both succeed, check the artifact's declaration: no requirement means open access. `details/1` enriches the verified identity; it does not grant access.

## Authentication

A handler returns `{:authenticated, principal}`, terminal `:failed` (a generic 401), or `:anonymous` (try the next handler). Trust forwarded identity headers such as `x-ms-client-principal` only with `trust_forwarded_identity_headers: true` behind a sanitizing ingress, or with signed forwarding that verifies the HMAC over audience, key ID, timestamp, nonce, method, path and covered identity headers. An on-behalf-of assertion verifies the RS256 signature (RSA 2048-bit minimum), issuer, audience, expiry and replay. `/.cratis/me` returns 401 if the caller is not signed in and 403 when the identity provider returns `{:unauthorized, details}`.
