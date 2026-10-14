<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Upgrading from older clients

Source: `Cratis/Chronicle.Elixir` (`Source/chronicle/mix.exs`, `mix.lock`, `lib/chronicle/wire_result.ex`, `jobs.ex`, `event_sequences/event_log.ex`, `read_models.ex`, `seeding.ex`).

## Dependencies and wire compatibility

The wire contracts target the current Chronicle kernel generations, with renamed RPCs and unwrapped response envelopes. No public Elixir API was removed, but unauthorized or excepted command responses return `{:error, reason}` rather than looking successful. `Jobs.get/2` lists jobs then finds the id client-side; `append_many_for_event_sources/2` uses its dedicated RPC rather than the single-source path.

- Use the `~>` requirement for the published release you intend (`{:cratis_chronicle, "~> 3.10"}` style) and the Elixir version `mix.exs` declares.
- grpc 1.x and Mint are direct dependencies; do not carry a mandatory `GRPC.Client.Supervisor` child forward from an older grpc setup.
- Contracts resolve from the lockfile. Pair the kernel with the installed contracts descriptor; named event source definitions need a kernel that supports them (see below).
- The first append on each channel runs a compatibility check, shared until reconnect. `{:error, {:incompatible_server, response}}` is a version/descriptor problem, not a transient append rejection. Update kernel and contracts as a compatible pair; do not bypass the preflight. Failed transport calls return `{:error, %GRPC.RPCError{}}`.

## Behavior to review in an older application

An application written against an older client may have relied on behavior that is now corrected:

| Behavior | Review |
| --- | --- |
| Reducers register successfully and process from the log start | Old events reach reducers that previously failed registration |
| Multi-word projection fields and AutoMap populate | Remove camelCase-string workarounds; inspect fields that were formerly empty |
| `unique(:owner_email)` and `remove_constraint` registration work | Uniqueness is enforced and release events can remove constraints |
| `ReadModels.query/2` is zero-based, default page 0 | Change first-page callers to `page: 0`; `page: 1` is the second page |
| Seeding skips an event source with existing events | Already-stored duplicates are not removed |
| Tail/next sequence lookups do not narrow implicitly to `"Default"` | Audit callers that depended on implicit routing narrowing |

Rejected appends (including concurrency/constraint failures) return `{:error, reason}`, never `:ok`; batch append metadata survives the rich append RPC. Handle errors on single, batch and transactional paths.

Declared `unique(..., message: ...)` violation messages are preserved on single, batch and transactional appends. Retain the constraint name and diagnostics when handling violations rather than assuming every message came from the kernel.

Requires `cratis_chronicle` 3.10.0 and Chronicle kernel 19.30.0 for named event source definitions.
