<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Pitfalls

- **Nested lists, enums and derived types are not supported** in schemas or generated proxies.
- **The tenant is selection, not membership.** Authorize it.
- **There is no tenant resolver chain**, and Arc does not require or enforce a tenant.
- **`/.cratis/tenants` and `/.cratis/users` list; they do not select.**
- **A subscription runs with the context of the request that created it.** For SSE that is the
  control `POST`.
- **`Cratis.Arc.Notifier` is one node.** Broadcast across nodes yourself.
- **In-memory sorting and paging.** A large list needs `%Cratis.Arc.Page{}` from the database.
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

## Event model and structure

| Mistake | What happens | Do this |
| --- | --- | --- |
| A read model module in the parent namespace (`ApiCredentials.Listing` beside `ApiCredentials.Listing.Reducer`) | The view is grouped with the parent feature, not its slice | Put the query module inside the slice folder (`Listing.Queries`) |
| A reactor that returns nothing | The automation slice shows no events | Return the event that records what it did |
| A view over a model another slice builds | Old Arc showed no events | Arc 1.4 reads them from the reducer; use `consumes:` for a model read from the event log |
| Reading the last module segment as the name | The model shows the `id:` | Name by `id:` and keep `display_names:` in mind |
| Slices that use events of several sub-features in the parent feature | A fact is drawn after what uses it; validation fails | Give them a sub-feature that follows the others |
| Leaving `event_model_strict` off | An incomplete model only warns | Set `arc: [event_model_strict: true]` once the model is clean |
