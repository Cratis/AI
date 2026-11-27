<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Hosting and testing

## Plug

`plug Cratis.Arc.Plug, application: MyApp.Arc` answers `/api/...` commands and queries, `/.cratis/*`
(identity, discovery, both hubs) and passes everything else on. `max_body_bytes` is the only
request limit; there are no connection or subscription caps. `Cratis.Arc.Plug.SinglePage` serves a
built SPA (`root:`, `api_prefixes:`). Plug and Bandit are enough; no Phoenix is needed.

## Phoenix and LiveView

The same application runs in process: `Cratis.Arc.execute/3`, `Cratis.Arc.query/5`, and `Cratis.Arc.LiveView` keeps
an assign current from an observable query, with forms that show pipeline errors on the
field. Hand the endpoint the Arc plug as for Plug.

## Configuration

On the application: `chronicle:`, `authentication:`, `trust_forwarded_identity_headers:`,
`introspection:` (`:authenticated`, `:anonymous` or a policy), `tenancy:`, `filters:`,
`mongodb:`, `segments_to_skip:` (default 1), `route_prefix:`, `expose_exceptions:`,
`max_body_bytes:`, `on_behalf_of:`. Read secrets from the environment in `config/runtime.exs`.

## Testing

`use Cratis.Arc.Test.Case, application: MyApp.Arc, event_types: [...]` starts a Chronicle in-memory
test client per test and gives an `Cratis.Arc.Test.Scenario` as `:arc`; `async: true` is safe.

```elixir
result = Cratis.Arc.Test.execute(arc, {RegisterAuthor, %{"id" => Cratis.Arc.new_id(), "name" => "A"}})
Cratis.Arc.Test.assert_invalid(result, :name)
Cratis.Arc.Test.refute_appended(arc, AuthorRegistered)
```

For specs in the shape of a Specification use the scenarios: `use Cratis.Arc.Test.CommandScenario,
application: MyApp.Arc, event_types: [...]` (or `QueryScenario`) starts the kernel once per module, gives the
scenario as `:scenario`, and you chain `given_events/3`, `execute/3` (`as:` a `principal/2`) or `query/5`, then one
`should_*` per test: `should_be_successful/1`, `should_not_be_authorized/1`, `should_have_validation_errors/1,2`,
`should_have_constraint_violation/1,2`, `should_respond_with/2`, `should_have_appended/2,3`,
`should_have_appended_exactly/2`, `should_not_have_appended_any_events/1`, `should_return_items/2`. The
`Cratis.Arc.Test.Should` module is the counterpart of the C# `Should` extensions (`should_equal/2`,
`should_contain_only/2`, `should_match/2`, ...). Read `rules/specs.elixir.md` for the layout of the files.

Also `Cratis.Arc.Test.query/5`, `principal/2`, `assert_success/1`, `assert_forbidden/1`,
`assert_appended/3` and `wait_for_observers/1`. For a plain Plug application without
Chronicle, call `Cratis.Arc.execute/3` and `Cratis.Arc.query/5` with `principal:` and `tenant:` and assert
on the result. In-memory Chronicle has the limits listed in the Chronicle client skill.

## Running samples

`Samples/*/run.sh` starts (`./run.sh`) or tests (`./run.sh test`) each sample. `plug` and
`phoenix` need a Chronicle on port 35000; the showcase needs MongoDB (a replica set) only
for its MongoDB page.
