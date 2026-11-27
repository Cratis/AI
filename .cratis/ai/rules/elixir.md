---
applyTo: "**/*.ex,**/*.exs"
paths:
  - "**/*.ex"
  - "**/*.exs"
---

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

## Anti-patterns to avoid

Check new Elixir against the official anti-pattern pages (code, design, process and meta-programming
anti-patterns in the Elixir documentation). The ones that matter most here:

- **Never create atoms from input.** `String.to_atom/1` on a name that a user, a file or a wire message
  supplies leaks atoms. Compare as strings, or map through an explicit table or
  `String.to_existing_atom/1`. A bounded, developer-written set of names is acceptable.
- **Match the shape you need.** Use `%{key: value} = map` or `Map.fetch!/2` for required data; `Map.get/3`
  and `opts[:key]` are for optional data, and a default must not hide a missing required value
  (`Map.get(actor, :id) || "unknown"`). Prefer `%{parts: parts} <- state` to `x when x != nil <- state`.
- **Do not rescue to find out whether something exists.** Check with `function_exported?/3` (after
  `Code.ensure_loaded?/1`) or a pattern match. `rescue _ ->` that returns a default swallows real errors;
  rescue narrowly, around foreign code only.
- **Do not let `with ... else` carry business logic.** Make each step return a tagged result
  (`:ok` or `{:error, reason}`) so `else` is unnecessary or has one clause per distinct failure. Do not
  mix a boolean into a `with` (`true <- cond`); wrap it in a function that returns a tagged result.
- **Return one shape.** Do not let an option or an argument change the return type or select between
  different outcomes (`outcome: "applied" | "failed"` choosing the event); use two functions or commands.
  Use `{:error, :not_found}` rather than `{:ok, nil}` when absence is a failure for the caller.
- **Keep parameter lists short.** Three or four. When a function needs more, or discards most of them,
  pass one map or struct. Do not keep an unused parameter.
- **Supervise processes.** No bare `Task.start/1` or `spawn` for work that must not fail silently; start it
  under a `Task.Supervisor` in the supervision tree. A process dictionary value does not reach a `Task`.
- **Libraries do not read global application configuration.** Take options from the caller. An
  application may call `Application.get_env/2` for its own settings, ideally in one settings module.
  Compile-time config belongs in `Application.compile_env/3`.
- **Macros earn their place.** Use a macro for syntax a function cannot take (a declaration DSL, a block)
  and `use` only to define or register something, not to import functions.
- **Stringly typed values stay at the boundary.** Wire strings (ids, ISO 8601 times, enum names) are fine in
  events and commands; decide on atoms or structs inside the code.

### Cohesion over file count

Do not split code only because a file is long or holds several modules. **High cohesion wins**: keep a
slice's command, its events and its specs next to each other, and a view's markup with the LiveView that
owns it. A module is too big when it has several reasons to change, not when it has many lines. These
anti-pattern fixes must not scatter a vertical slice across folders.

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
