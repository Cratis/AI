<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Pitfalls

- **Nested lists, enums and derived types are not supported** in schemas or generated proxies.
- **The tenant is selection, not membership.** Authorize it.
- **There is no tenant resolver chain**, and Arc does not require or enforce a tenant.
- **`/.cratis/tenants` and `/.cratis/users` list; they do not select.**
- **A subscription runs with the context of the request that created it.** For SSE that is the
  control `POST`.
- **`Arc.Notifier` is one node.** Broadcast across nodes yourself.
- **In-memory sorting and paging.** A large list needs `%Arc.Page{}` from the database.
- **A query with no `authorize` or `allow_anonymous()` is a decision you have not made.**
- **Replay memory is per node.** Signed forwarded-identity and on-behalf-of replay caches
  live in a process per application and node, and verification fails closed when the
  application is not started.
- **`X-Allowed-Severity` is read on commands only**, as a number, capped at `Warning`.
- **`/.cratis/me` never sets or reads a `.cratis-identity` cookie.**
- **MongoDB**: no `IMongoCollection` injection; no OIDC access tokens; no geospatial or
  convention-pack features; `Join<T>` watchers are expressed as several `watch:` entries.
- **A `.ts` in `lib` is ignored by Mix** (a feature, not a bug); the proxy file marker is
  what protects hand-written files from being overwritten.
- **Do not copy .NET idioms**: no `[Command]` attributes, no DI-injected `IEventLog`. Events are
  returned from `handle/2` as `{:append, ...}`.
