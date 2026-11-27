<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Commands and queries

## Fields

Types: `:string`, `:integer`, `:float`, `:boolean`, `:uuid` (a `Guid` in TypeScript),
`:date` (`DateOnly`), `:datetime`, `:map`, `{:list, type}`, a `Cratis.Chronicle.Concept` module (the
primitive it wraps) and a module that `use Cratis.Arc.Schema`. **Nested lists are not supported.**
Options: `required: true`, `nullable:`, `key: true`, `default:`, `doc:`, `min_length`,
`max_length`, `email`, `matches`, `min`, `max`, `greater_than`, `less_than`.

Use a `Cratis.Chronicle.Concept` for domain values such as an author id, so the type is declared
once and is what Chronicle records.

## Callbacks

| Callback | Use |
| --- | --- |
| `validate/2` | A cross-field or state-dependent rule: `:ok` or `{:error, result_or_results}` |
| `provide/2` | Load data once, after authorization and validation: `:ok`, `{:ok, map}` (merged into `ctx.provided`) or `{:error, results}` |
| `handle/2` | Decide |

Each callback runs only if the previous steps passed.

## Where each decision lives

A command's `handle/2` decides what to append from what `provide/2` loaded. Pick the mechanism by what the
decision is:

| Decision | Use |
| --- | --- |
| Shape or range of an input | `field` options (`required:`, `max_length:`), then a validator |
| State of the stream a rule needs (does it exist, is it suspended) | `provide/2` loading the folded state; `handle/2` refuses with a validation result |
| **Uniqueness**: a value used once, or a fact (an event type) once per stream | **A Chronicle constraint**, declared on the event type (`unique/2`, `unique_event_type/1`) or in a standalone `Cratis.Chronicle.Events.Constraint` module. The kernel checks it at append time, so it holds under concurrency. |
| A rule over many streams or a count (a tenant limit) | A read model or the integration, and accept that it can race; say so in the command's doc |
| An exceptional failure (a bug, missing infrastructure) | raise |

**Do not check uniqueness by reading first.** A `provide/2` that loads the stream or a read model to see "is
this taken" (`{:ok, %{exists?: true}} -> refuse(...)`) is a race: two commands both see it free, and both
append. Declare the constraint and let the append refuse. Arc turns the violation into a validation result with
reason `constraintViolation` (the constraint name in `reasonDetail`), so a client already handles it; give the
constraint a `:message` so the refusal reads well. Release a held value with `remove_constraint/1,2` on the event
that frees it. Read the Chronicle skill's `references/constraints.md` for the options.

## When Chronicle refuses

A constraint or concurrency rejection never raises. It is a validation result with reason
`constraintViolation` (constraint name in `reasonDetail`) or `concurrencyViolation`.

## Run from code

```elixir
result = Cratis.Arc.execute(MyApp.Arc, %RegisterAuthor{id: Cratis.Arc.new_id(), name: "Ada"}, principal: principal)
Cratis.Arc.CommandResult.success?(result)
```

Pass `{RegisterAuthor, %{"id" => "...", "name" => "..."}}` to bind a wire map first.
Options: `principal:`, `tenant:`, `correlation_id:`, `metadata:`, `validate_only: true`.

## Query options

`params: [name: type]` (`{type, optional: true}`), `many: bool` (default `true`),
`authorize:` or `allow_anonymous: true`, `http_method: :get | :query`, and for `@observe`
`watch: [...]` and `topics: [...]`. Arguments arrive cast; a missing or wrongly typed
argument is `malformedRequest` before your function runs.

`use Cratis.Arc.ReadModel, types: [id: :uuid]` overrides inferred field types for the proxies:
a struct default of `""` or `nil` reads as a string.

## Paging and sorting

`page` (zero-based), `pageSize`, `sortBy` and `sortDirection` are reserved query-string
names, matched case-insensitively; `QUERY` requests carry them in the body. A returned
list is sorted and paged **in memory**. For a large collection page in the database and
return `%Cratis.Arc.Page{items:, total:, page:, size:}`; Arc then does not touch the items.
`ctx.query` holds the requested page, page size and sorting.

## Results

`Cratis.Arc.CommandResult.to_wire/1` and `Cratis.Arc.QueryResult.to_wire/1` are the contract envelopes.
An exception becomes `exceptionMessages`; outside development the message is generic and
the detail is logged with the correlation id.
