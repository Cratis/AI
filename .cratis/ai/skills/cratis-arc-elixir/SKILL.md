---
name: cratis-arc-elixir
description: Use when building an Elixir CQRS application with Arc for Elixir (`cratis_arc`, `cratis_arc_mongodb`) with commands, read-model queries, observable queries over WebSocket or SSE hubs, tenancy, MongoDB, identity, generated TypeScript proxies and vertical slices. Not for the Chronicle client alone, or for .NET, JVM, Go or TypeScript Arc.
license: MIT
compatibility: Elixir 1.18 or later; Plug and Bandit, or Phoenix.
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Arc for Elixir

> **Source preview.** `Cratis/Arc.Elixir` builds and tests the packages, but the API may still
> change. Pin a git ref you tested, and do not claim more than its
> `Documentation/limits-and-gaps.md` says is verified. Companion guidance:
> `cratis-chronicle-client-elixir` (events, read models and the kernel).

Arc for Elixir serves the **Arc HTTP contract**, so `@cratis/arc`, `@cratis/arc.react` and
Cratis Components work against it unchanged. A command is one module, a query is a function
on a read-model module, and neither is a controller. Events are optional: a command can
return a response and record nothing. Arc for Elixir works with **Chronicle** for events
and with **MongoDB** (`cratis_arc_mongodb`) for documents.

## Verified product sources

| Product | Source checked |
| --- | --- |
| Arc for Elixir (`cratis_arc`) | `Source/arc/lib/arc/{command,read_model,application,pipeline,tenancy,filter,watch,proxy_generator}.ex`, `lib/arc/plug/{hub_session,hub,sse_hub}.ex`, `Documentation/*.md` |
| Arc for Elixir MongoDB (`cratis_arc_mongodb`) | `Source/arc_mongodb/lib/arc/mongodb.ex`, `lib/arc/mongodb/*.ex` |
| Samples | `Samples/showcase` (every feature, plain Plug), `Samples/phoenix` (LiveView, Chronicle) |

Source is authoritative. `Documentation/` excerpts marked `# From: <path>` are verified
against the samples in CI, so prefer them to memory.

## Declare a command

```elixir
defmodule Library.Authors.Registration.RenameAuthor do
  @moduledoc "Renames an author. Only editors may."
  use Arc.Command
  authorize roles: ["editor"]

  schema do
    field :id, Library.Authors.AuthorId, key: true, required: true
    field :name, :string, required: true, min_length: 2, max_length: 50
  end

  def handle(%__MODULE__{name: name}, _ctx),
    do: {:append, %Library.Authors.AuthorRenamed{name: name}}
end
```

Only `handle/2` is required. The order is validate, `provide/2`, then `handle/2`.
`handle/2` returns `{:append, event | [events]}`, `{:append, events, response}`,
`{:ok, response}` (records nothing) or `{:error, results}`. `key: true` marks the event
source. A handler that returns an event with no key and no source id is rejected as
`frameworkFailure`. Read [references/commands-and-queries.md](references/commands-and-queries.md).

## Declare a query

```elixir
defmodule Library.Authors.Listing.Authors do
  use Arc.ReadModel, model: Library.Authors.Author, types: [id: :uuid]

  @query many: true
  def all_authors(_args, ctx), do: Chronicle.all(Library.Authors.Author, ctx.chronicle)

  @observe many: true, watch: [Library.Authors.Author]
  def live_authors(_args, ctx), do: Chronicle.all(Library.Authors.Author, ctx.chronicle)
end
```

A query is `(args, ctx)` returning `{:ok, value}` or `{:error, results}`. `@observe`
is the same function, run again whenever its inputs change and pushed to the client. Pass
`ctx.chronicle` to Chronicle calls. Read
[references/observable-queries-and-hubs.md](references/observable-queries-and-hubs.md)
before choosing a transport or a transfer mode.

## Host it

```elixir
defmodule MyApp.Arc do
  use Arc.Application, otp_app: :my_app
end

# in the supervision tree, before the endpoint
children = [MyApp.Arc, {Bandit, plug: MyApp.Router, port: 4000}]

# the router
plug Arc.Plug, application: MyApp.Arc
```

`MyApp.Arc` **must be in the supervision tree**: it owns the processes behind observable
queries. There is no global configuration; every option is on the application. Arc
discovers commands and read models under the application's namespace, with no registration.
Phoenix and LiveView use the same application in process. Read
[references/hosting-and-testing.md](references/hosting-and-testing.md).

## Rules that are easy to get wrong

- **Authorization is declared, not assumed.** A command or query without `authorize` or
  `allow_anonymous()` is not public by accident; say which you mean.
- **A tenant resolver only selects.** A header, query string or host is chosen by the caller.
  Membership is yours to check. Read [references/tenancy-and-identity.md](references/tenancy-and-identity.md).
- **`trust_forwarded_identity_headers: true` is for samples and for an ingress that sets
  the headers.** It trusts unsigned `x-ms-client-principal*` headers from any caller.
- **A browser `WebSocket` and `EventSource` cannot set headers.** Authenticate hub
  connections with cookies and a plug or handler that reads them.
- **Change streams need a replica set.** MongoDB observation does not work on a standalone
  server. Read [references/mongodb.md](references/mongodb.md).
- **Proxy generation is opt-in.** Add the `:arc` compiler, and commit the generated
  files. Read [references/proxies-and-vertical-slices.md](references/proxies-and-vertical-slices.md).
- **Organize by feature.** Backend, generated proxies and React page of a feature share a
  folder. `layout: :colocated` generates that layout.

See [references/pitfalls.md](references/pitfalls.md) for the full list, and
[references/product-sources.md](references/product-sources.md) for package facts.
