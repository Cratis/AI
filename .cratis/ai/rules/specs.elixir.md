---
applyTo: "**/for_*/**/*.exs, **/when_*/**/*.exs"
paths:
  - "**/for_*/**/*.exs"
  - "**/when_*/**/*.exs"
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# How to Write Elixir Specs

Extends the base [specs.md](./specs.md) with Elixir conventions. The philosophy is the same: a spec
describes a **behavior** in the language of the domain, the folder tree reads as a sentence, and one
scenario lives in one file. ExUnit is the runner; nothing else is needed.

## Specs are scripts beside the code, never in a release

A spec is an `.exs` file (a script). `mix compile` and `mix release` only ever build `.ex` files, so a spec
beside the code it specifies is **never part of a release**, the same outcome the C# build gets by removing
`when_*` files from Release builds and the TypeScript build gets by not importing them. Do not rename specs
to `.ex`. Shared helpers that must be compiled (a `Case` module) live in `test/support/*.ex`, which only the
`:test` environment adds to `elixirc_paths`.

**No `_test` suffix.** ExUnit's default pattern is `*_test.exs`, but the folder already says it is a spec
(`for_*`/`when_*`), exactly as in C# and TypeScript. Point `mix test` at the folders instead:

```elixir
# mix.exs: project/0
elixirc_paths: elixirc_paths(Mix.env()),
test_paths: ["lib"],
# A spec is any script in a `for_*` folder; `given/` holds shared contexts, which specs load themselves.
test_load_filters: [&(String.contains?(&1, "/for_") and not String.contains?(&1, "/given/"))],

defp elixirc_paths(:test), do: ["lib", "test/support"]
defp elixirc_paths(_env), do: ["lib"]
```

`test_load_filters` **replaces** the default `test_pattern`; do not set both. `test_helper.exs` (`ExUnit.start()`)
stays beside the specs, in the first of `test_paths`. Let `mix format` cover the scripts
(`inputs: ["{config,lib,test}/**/*.{ex,exs}"]`).

## Folder and file structure

```
<feature or slice>/
└── for_<unit>/                          ← "For the unit..."
    ├── given/
    │   └── a_<context>.exs              ← shared context, loaded by the specs that need it (not a spec)
    ├── when_<behavior>/                 ← "...when doing this..." (a folder when there are several outcomes)
    │   ├── and_<condition>.exs          ← one scenario per file
    │   ├── with_<data>.exs
    │   └── without_<requirement>.exs
    └── when_<simple_behavior>.exs       ← a single file for a single scenario
```

The unit is the module, command, read model, component or function under specification:
`for_rotate_secret`, `for_data_table`, `for_patterns`. Use the prepositions and the rules of
[specs.md](./specs.md) (`and_`, `with_`, `without_`, `having_`, `given_`), including: **never put `when` in a
file or non-`when_` folder name** (`and_ory_fails.exs`, not `when_ory_fails.exs`, under `when_adding/`).

Folder names are `snake_case`. A spec's **module name mirrors its path** below the application's namespace,
`PascalCase`, so it can never clash with the module it specifies and is never named `...Test`:

```elixir
# lib/access/credentials/adding_credentials/for_add_credential/when_adding/with_selected_vessels.exs
defmodule Prism.Access.Credentials.AddingCredentials.ForAddCredential.WhenAdding.WithSelectedVessels do
  use ExUnit.Case, async: true
```

## One scenario, several `should` assertions

The `setup` establishes the context and performs the behavior once per assertion (ExUnit runs `setup` for each
`test`); each `test` states one expectation and starts with **`should`**, so the file reads as a sentence:

```elixir
defmodule Prism.Access.ApiCredentials.ForState.WhenDerivingTheStatus do
  use ExUnit.Case, async: true

  alias Prism.Access.ApiCredentials.State

  test "should be active by default" do
    assert State.status(%State{id: "c", exists?: true}, ~U[2026-03-01 12:00:00Z]) == :active
  end
end
```

- `test "should refuse a duplicate label"`, not `test "a duplicate label is refused"` and not
  `test "refuses..."`. Name the expected result, not the call.
- A file with several unrelated scenarios is several files. Split `describe` blocks into
  `when_<behavior>/<preposition>_<condition>.exs` files; do not use `describe` to group scenarios.
- Assert on the **contract**: the result, the events appended, what a collaborator was asked to do. Do not
  assert on internals, and do not spec logging or trivial delegation.
- `doctest Module` belongs in its own spec (`when_building/with_the_documented_examples.exs`).

## Shared context: `given/`

Contexts that several specs share (a table of people, a started kernel) go in `for_<unit>/given/<name>.exs`
as a module, and a spec loads it by relative path. The filter above keeps `given/` out of the specs ExUnit
runs, so it is loaded once, by the spec that needs it:

```elixir
Code.require_file("../given/people.exs", __DIR__)

defmodule Prism.Access.Components.DataTable.ForDataTable.WhenFiltering.WithASingleFilter do
  use ExUnit.Case, async: true

  alias Prism.Access.Components.DataTable.ForDataTable.Given.People
  import People, only: [names: 1, table: 1]
  ...
```

A context that needs a compiled module (a `Case` with `setup`, an in-memory stand-in) is a `test/support/*.ex`
module that the spec `use`s, like `Prism.Access.Case` in a Cratis application: it starts the in-memory
Chronicle kernel and gives `exec/3`, `facts/2` and the stand-ins.

## What to specify, by kind

| Kind | Run it through | Assert |
|---|---|---|
| Command | the real pipeline (`Cratis.Arc.Test.execute/3`, in-memory Chronicle) | result, events appended (types and data), what the integration was asked |
| Reactor / automation | the real reactor against the in-memory kernel | the command it ran, the event that records the outcome |
| Read model, projection | the events folded (`State`, projection function) | the document, never `Process.sleep` |
| Pure function | a direct call | return values; one file per rule |
| LiveView / component | `Phoenix.LiveViewTest` (`render_component/2`, `live/2`) | the markup that matters: structure, state classes, the events wired, not every attribute |

The in-memory Chronicle kernel does not run read-model queries; specs that need them use the development kernel
and say so in the file.

## Pitfalls

- A spec outside a `for_*` folder is **silently not run**. After adding the filter, check the count: `mix test`
  must report at least what it did before.
- Do not name a spec `*_test.exs` while the filter is on: it is picked up only when it sits in a `for_*` folder.
- `Code.require_file` paths are relative to the spec (`__DIR__`), so moving a spec means fixing the path.
- Specs are scripts: aliases and imports go inside the module; the first line outside it is only for
  `Code.require_file`.
