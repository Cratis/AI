<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Commands and queries

## Fields

Types: `:string`, `:integer`, `:float`, `:boolean`, `:uuid` (a `Guid` in TypeScript),
`:date` (`DateOnly`), `:datetime`, `:map`, `{:list, type}`, a `Chronicle.Concept` module (the
primitive it wraps) and a module that `use Arc.Schema`. **Nested lists are not supported.**
Options: `required: true`, `nullable:`, `key: true`, `default:`, `doc:`, `min_length`,
`max_length`, `email`, `matches`, `min`, `max`, `greater_than`, `less_than`.

Use a `Chronicle.Concept` for domain values such as an author id, so the type is declared
once and is what Chronicle records.

## Callbacks

| Callback | Use |
| --- | --- |
| `validate/2` | A cross-field or state-dependent rule: `:ok` or `{:error, result_or_results}` |
| `provide/2` | Load data once, after authorization and validation: `:ok`, `{:ok, map}` (merged into `ctx.provided`) or `{:error, results}` |
| `handle/2` | Decide |

Each callback runs only if the previous steps passed.

## When Chronicle refuses

A constraint or concurrency rejection never raises. It is a validation result with reason
`constraintViolation` (constraint name in `reasonDetail`) or `concurrencyViolation`.

## Run from code

```elixir
result = Arc.execute(MyApp.Arc, %RegisterAuthor{id: Arc.new_id(), name: "Ada"}, principal: principal)
Arc.CommandResult.success?(result)
```

Pass `{RegisterAuthor, %{"id" => "...", "name" => "..."}}` to bind a wire map first.
Options: `principal:`, `tenant:`, `correlation_id:`, `metadata:`, `validate_only: true`.

## Query options

`params: [name: type]` (`{type, optional: true}`), `many: bool` (default `true`),
`authorize:` or `allow_anonymous: true`, `http_method: :get | :query`, and for `@observe`
`watch: [...]` and `topics: [...]`. Arguments arrive cast; a missing or wrongly typed
argument is `malformedRequest` before your function runs.

`use Arc.ReadModel, types: [id: :uuid]` overrides inferred field types for the proxies:
a struct default of `""` or `nil` reads as a string.

## Paging and sorting

`page` (zero-based), `pageSize`, `sortBy` and `sortDirection` are reserved query-string
names, matched case-insensitively; `QUERY` requests carry them in the body. A returned
list is sorted and paged **in memory**. For a large collection page in the database and
return `%Arc.Page{items:, total:, page:, size:}`; Arc then does not touch the items.
`ctx.query` holds the requested page, page size and sorting.

## Results

`Arc.CommandResult.to_wire/1` and `Arc.QueryResult.to_wire/1` are the contract envelopes.
An exception becomes `exceptionMessages`; outside development the message is generic and
the detail is logged with the correlation id.
