---
applyTo: "**/*.ex,**/*.exs"
paths:
  - "**/*.ex"
  - "**/*.exs"
---
<!-- cratis-ai: generated Copilot instructions. Do not edit; rules/ is the source. -->

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Elixir Conventions

Use Elixir and OTP idioms, not translated C# or JVM shapes. These conventions
are grounded in `Cratis/Chronicle.Elixir` 4.x (`Source/chronicle/mix.exs`,
`.formatter.exs`, and `lib/cratis/chronicle/`) and `Cratis/Arc.Elixir` 1.4.x
(`lib/cratis/arc/`). Client-specific APIs belong in the
**cratis-chronicle-client-elixir** skill, Arc APIs in **cratis-arc-elixir**.

## Build and format

- Use Elixir 1.18 or later (`~> 1.18`); the packages build on 1.19.
- Run `mix compile --warnings-as-errors`, `mix test`, and
  `mix format --check-formatted` with the project's formatter inputs.
- Use two-space indentation and let `mix format` own layout.
- Chronicle exports no `locals_without_parens` formatter configuration. Accept
  parentheses around its DSL calls; do not assume `import_deps` supplies them.

## Code shape

- PascalCase module names; snake_case functions, variables and struct fields.
- Use structs for event/read-model data and pattern-matching clauses for
  dispatch. Schema-bearing structs need typed defaults; `nil` is not a type
  declaration and registers as string in this client.
- Preserve tagged results such as `:ok`, `{:ok, value}`, and `{:error, reason}`.
  Handle expected remote failures explicitly rather than using a success-only
  match in a long-lived process.
- Put long-lived processes under the application's supervision tree. Wait for
  actual client readiness, not merely a successful supervisor start.
- Process-local context is not inherited by `Task` processes; pass required
  context explicitly at that boundary.
- Document public APIs with `@moduledoc`, `@doc`, and `@spec`; use `Logger` for
  operational logging and keep credentials out of messages and crash reports.
- Use American English in identifiers, comments and documentation.

## Event-sourced applications on Arc and Chronicle

Read the **cratis-arc-elixir** and **cratis-chronicle-client-elixir** skills before touching a slice.

- **Folders are Module, Feature, Slice, and sub-features nest.** One folder per behavior, named for what
  it does as a gerund (`RotatingSecrets`); the command inside is the verb. Group slices that act on one
  thing into a sub-feature (`Secrets`, `Credentials`, `Viewing`), and put a reactor with the facts it
  reacts to, not in a folder named for the third party it calls. No folders named for a kind of file.
- **Names are ids.** `use Cratis.Arc.Command, id: "rotate-secret"`, an event type's `id:`, a reactor's
  `id:`; the model shows the id in PascalCase, so a module can be renamed without renaming the model.
- **A command and its events live in one file**, events first. An event is past tense, one fact, and
  never carries a secret.
- **Every slice tells a whole story**: a state change has a command and the events it appends; a view
  has a read model and consumes events (`consumes:` when it reads the event log); an automation reacts to
  an event, runs a command and records the fact that command appends, so the event model shows what it
  did. A reactor that calls a third party does not append events itself: it runs a `:system` command
  (`Cratis.Arc.execute/3`) that records the outcome, and the command lives in the reactor's slice folder.
- **Order is the story**: a slice that uses events of several sub-features goes in a sub-feature after
  them. Build with `arc: [event_model_strict: true]` so an incomplete model fails the build.
- **Third parties are integrations behind a behaviour**, with an in-memory stand-in for specs; only
  reactors write to them.

Every `.ex` and `.exs` source file starts with:

```elixir
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
```
