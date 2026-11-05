<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Hosting and testing

## Plug

`plug Arc.Plug, application: MyApp.Arc` answers `/api/...` commands and queries, `/.cratis/*`
(identity, discovery, both hubs) and passes everything else on. `max_body_bytes` is the only
request limit; there are no connection or subscription caps. `Arc.Plug.SinglePage` serves a
built SPA (`root:`, `api_prefixes:`). Plug and Bandit are enough; no Phoenix is needed.

## Phoenix and LiveView

The same application runs in process: `Arc.execute/3`, `Arc.query/5`, and `Arc.LiveView` keeps
an assign current from an observable query, with forms that show pipeline errors on the
field. Hand the endpoint the Arc plug as for Plug.

## Configuration

On the application: `chronicle:`, `authentication:`, `trust_forwarded_identity_headers:`,
`introspection:` (`:authenticated`, `:anonymous` or a policy), `tenancy:`, `filters:`,
`mongodb:`, `segments_to_skip:` (default 1), `route_prefix:`, `expose_exceptions:`,
`max_body_bytes:`, `on_behalf_of:`. Read secrets from the environment in `config/runtime.exs`.

## Testing

`use Arc.Test.Case, application: MyApp.Arc, event_types: [...]` starts a Chronicle in-memory
test client per test and gives an `Arc.Test.Scenario` as `:arc`; `async: true` is safe.

```elixir
result = Arc.Test.execute(arc, {RegisterAuthor, %{"id" => Arc.new_id(), "name" => "A"}})
Arc.Test.assert_invalid(result, :name)
Arc.Test.refute_appended(arc, AuthorRegistered)
```

Also `Arc.Test.query/5`, `principal/2`, `assert_success/1`, `assert_forbidden/1`,
`assert_appended/3` and `wait_for_observers/1`. For a plain Plug application without
Chronicle, call `Arc.execute/3` and `Arc.query/5` with `principal:` and `tenant:` and assert
on the result. In-memory Chronicle has the limits listed in the Chronicle client skill.

## Running samples

`Samples/*/run.sh` starts (`./run.sh`) or tests (`./run.sh test`) each sample. `plug` and
`phoenix` need a Chronicle on port 35000; the showcase needs MongoDB (a replica set) only
for its MongoDB page.
