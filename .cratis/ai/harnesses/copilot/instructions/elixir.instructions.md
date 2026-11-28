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

Use Elixir and OTP idioms, not translated C# or JVM shapes. Client APIs are outside this rule: choose the Chronicle client with **cratis-chronicle-select-client** and the Arc backend SDK with **cratis-arc-select-backend-sdk** where those skills are installed.

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

## Specs

Specs follow the `specs.elixir` rule: scripts in `for_*`/`when_*` folders beside the code, no `_test` suffix, `should` assertions.

Every `.ex` and `.exs` source file starts with:

```elixir
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
```

Name modules by behavior, not generic layers. Keep secrets and credential derivatives out of persistent facts. Deliver external effects after append in a reactor. When another fact requires a decision, dispatch the authorized follow-up command through `Cratis.Arc.execute/3`; do not manufacture authority from the triggering event.
