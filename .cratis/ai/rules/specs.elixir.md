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

Use the **scenarios** of Arc and Chronicle for Elixir: the counterpart of the C# `Specification` with its
`CommandScenario`, `EventScenario`, `ReadModelScenario`, `ReactorScenario` and `QueryScenario`. Facts are given,
the behavior happens **once** (`setup_all`: the shared lifecycle), and each `test` is one expectation, a
`should_*` function that starts the test name with **`should`**:

```elixir
defmodule MyApp.Authors.ForRegisterAuthor.WhenRegistering.WithAValidName do
  use Cratis.Arc.Test.CommandScenario,
    application: MyApp.Arc,
    event_types: [MyApp.Authors.AuthorRegistered]

  alias MyApp.Authors.{AuthorRegistered, RegisterAuthor}

  setup_all %{scenario: scenario} do
    scenario =
      scenario
      |> given_events("ada", %AuthorRegistered{name: "Ada"})
      |> execute(%RegisterAuthor{id: "grace", name: "Grace"}, as: principal("tester", ["maintainer"]))

    %{scenario: scenario}
  end

  test "should be successful", %{scenario: scenario}, do: should_be_successful(scenario)

  test "should append the author as registered", %{scenario: scenario} do
    should_have_appended(scenario, %AuthorRegistered{name: "Grace"}, event_source_id: "grace")
  end
end
```

A scenario is an immutable value: **given** and **because** functions (`given_events/3`, `execute/3`, `query/5`,
`append/3`) return the next scenario, **should** functions return the one they checked, so they chain. Use
`lifecycle: :per_test` (and `setup`) only for a spec whose tests change the shared state. Only the events the
behavior appended count for `should_have_appended`, not the given ones.

| Scenario | Module | Use for |
|---|---|---|
| Command | `Cratis.Arc.Test.CommandScenario` | a command through the real pipeline: result, validation, authorization, constraints, events |
| Query | `Cratis.Arc.Test.QueryScenario` | a query's arguments, authorization and data (the in-memory kernel runs no read-model queries) |
| Event | `Cratis.Chronicle.Testing.EventScenario` | an event's constraints (`unique/2`, `unique_event_type/1`), concurrency, sequence numbers |
| Read model | `Cratis.Chronicle.Testing.ReadModelScenario` | what a projection or reducer builds from given events, by module and key |
| Reactor | `Cratis.Chronicle.Testing.ReactorScenario` | the events a reactor produced and whether it failed |

For assertions on any other value use `Cratis.Arc.Test.Should` (`should_equal`, `should_contain_only`,
`should_match`, ...): the value first, so they pipe, and they return it. A plain `ExUnit.Case` with `assert` is
fine for a pure function; there is no scenario to set up.

- Name the expected result, not the call: `test "should refuse a duplicate label"`.
- A file with several unrelated scenarios is several files; do not use `describe` to group them.
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
| Command | `CommandScenario` (the real pipeline, in-memory Chronicle) | result, events appended (types and data), what the integration was asked |
| Reactor / automation | `ReactorScenario` (the real reactor against the in-memory kernel) | the command it ran, the event that records the outcome |
| Read model, projection | `ReadModelScenario`, or the events folded (`State`) for the pure part | the document, never `Process.sleep` |
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
