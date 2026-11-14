<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Tenancy and identity

## Three decisions

| Decision | Who |
| --- | --- |
| Selection: which tenant is this request for | `Arc.Tenancy` |
| Membership: may this caller use it | You, in a command, query, policy or `Arc.Filter` |
| Storage isolation: where the data lives | Chronicle namespace and the MongoDB database |

**A resolver only selects.** Do not treat a header, query value or host as evidence of
membership.

## Resolvers

```elixir
config :my_app, MyApp.Arc, tenancy: [resolver: :header]
```

`:header` (default; `header:`, default `x-cratis-tenant-id`), `:query` (`query_parameter:`,
default `tenantId`), `:claim` (`claim_type:`, default `tenant_id`; ties selection to the
authenticated principal), `:subdomain` (`base_domain:` required), `:fixed` or `:development`
(`tenant_id:`), or a module implementing `Arc.Tenancy` (`resolve(conn, principal, options)`).
There is **no chain of resolvers**. The `:subdomain` resolver accepts only exactly one label
before a registrable base domain and otherwise falls back to the client-controlled header, so
strip the header at the ingress; the application refuses to start with an unusable base
domain. `nil`, `""` and `"Default"` are all the default tenant. The result is `ctx.tenant`.

A named tenant becomes the Chronicle `namespace:` of calls through the context, unless an
explicit `namespace:` is given. `:arc_tenant` is Logger metadata.

## Authentication and identity

Authentication handlers return `{:authenticated, principal}`, `:failed` (terminal, generic
401) or `:anonymous` (the next handler tries). `Arc.Authentication.MicrosoftIdentityPlatform`
reads `x-ms-client-principal`, `-id` and `-name`; **forwarded headers are trusted only with
`trust_forwarded_identity_headers: true`**, or when signed (HMAC with audience, key id,
timestamp, nonce and method/path coverage). An RS256 on-behalf-of assertion is checked for
signature (RSA 2048+), issuer, audience, expiry and replay.

Identity for the frontend: `use Arc.Identity.Provider, details: MyApp.IdentityDetails`;
`/.cratis/me` answers 401 not signed in, 403 when the provider says `:unauthorized`, else the
identity with `details`. The provider receives the tenant (`Arc.Identity.Context.tenant`).
`/.cratis/users` and `/.cratis/tenants` list development users and tenants for tools such
as Lens; they do not decide the request's tenant.

## Authorize a namespace

An `Arc.Filter` implements `on_command(ctx, descriptor)` and `on_query(ctx, descriptor, query)`
returning `:ok` or `{:unauthorized, reason}`. Register with `filters: [MyFilter]`. Filters run
**after authorization and before validation**, for every artifact; match the descriptor's
`namespace` to scope one. A refusal is `403` and the artifact never runs.
