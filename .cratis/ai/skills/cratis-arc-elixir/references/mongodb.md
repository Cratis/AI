<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# MongoDB (`cratis_arc_mongodb`)

```elixir
{:cratis_arc_mongodb, "~> 0.0"}

config :my_app, MyApp.Arc,
  mongodb: [server: System.get_env("MONGODB_URL"), database: "library", naming_policy: :camel_case]

children = [MyApp.Arc, {Arc.MongoDB, application: MyApp.Arc}, MyApp.Endpoint]
```

Start `Arc.MongoDB` **after** the Arc application. `server` and `database` are required; a
missing one raises on first use. **Change streams need a replica set or sharded cluster**;
a single node started with `--replSet` is enough. Keep credentials out of source control.

Other options: `direct_connection`, `database_resolver`, `server_resolver`,
`connection_resolution`, `pool_size` (default 5).

## Documents

```elixir
use Arc.MongoDB.Document, types: [id: :uuid, created_at: :datetime]
defstruct id: "", name: "", created_at: ~U[1970-01-01 00:00:00Z]
```

Types: `:string`, `:integer`, `:float`, `:boolean`, `:uuid` (binary subtype 4), `:object_id`,
`:datetime` (UTC), `:date` (UTC at noon), `{:list, t}` (never `nil` when read), `:map`, a
`Chronicle.Concept`, a struct module. `id` is stored as `_id`. Use a datetime default of
`~U[1970-01-01 00:00:00Z]` if the generated TypeScript should be non-optional.

Naming policies: `:none`, `:camel_case`, `:snake_case` or a module (`property_name/1`,
`collection_name/1`). `collection:` names a collection explicitly.

## Using a collection

Every function takes `{ctx, DocumentModule}` (or an `Arc.MongoDB.Collection`): `all`, `find`,
`find_one`, `find_by_id`, `count`, `page`, `insert`, `insert_many`, `save`, `update`,
`update_many`, `delete`, `delete_many`, `create_index`, `provide`. The context selects the
tenant's database.

- **Atom filter keys are struct fields** (translated to stored names and values); **string
  keys are raw MongoDB** (`"$or"`, dotted paths). A field the struct lacks raises instead of
  matching nothing.
- A broken unique index returns `{:error, :duplicate}`, not an exception.
- `page` pages and sorts in the database from what the client asked.
- `update` takes an operator map: `%{"$set" => %{title: "New"}}`.

## Tenancy

The default tenant uses `database`; a named tenant uses `database+tenant`. Change it with a
`database_resolver` (`resolve(tenant, options)`). Naming a database is not authorizing the
caller; **changing the naming of a database in use is a data migration.**

`connection_resolution` places tenants on servers and credentials of their own by
`:default`, a rule (`{:template, ...}`), an endpoint (`{:http, ...}`) or a module
implementing `Arc.MongoDB.ConnectionResolver`, following the shared connection-resolution
contract. Answers are cached by purpose and tenant (never by credential) until a minute before
expiry; an authentication failure drops the cached answer. **An OIDC `accessToken` is refused**:
the Elixir driver has no such mechanism.

## Observation

```elixir
@observe many: true, watch: [Arc.MongoDB.watch(Book)]
def live_books(_args, ctx), do: {:ok, Arc.MongoDB.all({ctx, Book}, sort: [title: :asc])}
```

One database-level change stream is shared by every observer of a database; it resumes
from its token, notifies observers on reopening and closes when the last observer leaves.
Observation says a collection changed; the query decides what to send. A query that watches
the collection another query writes to is how one change updates several lists.

## Test

`Arc.MongoDB.Test.unique_database/1`, `connect`, `available?` and `drop_databases/3`. Tests
that need MongoDB should skip when none answers (`MONGODB_URL`).
