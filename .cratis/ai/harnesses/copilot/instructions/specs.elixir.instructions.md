---
applyTo: "**/for_*/**/*.exs, **/when_*/**/*.exs, **/mix.exs, **/test_helper.exs"
paths:
  - "**/mix.exs"
  - "**/test_helper.exs"
  - "**/for_*/**/*.exs"
  - "**/when_*/**/*.exs"
---
<!-- cratis-ai: generated Copilot instructions. Do not edit; rules/ is the source. -->

# Specify Elixir behavior

Use ExUnit tests with native fixtures. For an Arc command exercise the pipeline through `Cratis.Arc.Test`; for Chronicle use `Cratis.Chronicle.Testing.Case`. Seed only the relevant state, execute once and assert the accepted fact or specific refusal. Do not infer a real external delivery from an in-memory test.

## Discover colocated specs

Use `.exs` scripts with no `_test` suffix under `lib/<slice>/for_<unit>/`. Mix compiles `.ex` modules, so these colocated scripts are not compiled into releases. Put reusable compiled case helpers in `test/support/*.ex` and include that directory only in `:test`. For a project adopting this layout on Mix 1.19 or newer, configure:

```elixir
# Entries in project/0
elixirc_paths: elixirc_paths(Mix.env()),
test_paths: ["lib"],
test_load_filters: [~r{^lib/(?!.*?/given/)(?!given/)(?:.*/)?for_[^/]+/.*\.exs$}],
test_ignore_filters: [~r{/given/}, ~r{^lib/test_helper\.exs$}],

# Module-level helpers
defp elixirc_paths(:test), do: ["lib", "test/support"]
defp elixirc_paths(_), do: ["lib"]
```

Put `ExUnit.start()` in `lib/test_helper.exs`, then load shared `given/*.exs` once with `Path.wildcard("lib/**/given/*.exs") |> Enum.sort() |> Enum.each(&Code.require_file/1)`. Keep the default `test_pattern`; the load filter replaces the default `_test.exs` suffix check. Preserve any legacy test paths and their load filters until migration is complete. Use the existing `test/` layout with `*_test.exs` where custom filters are unavailable. A script outside `for_*` is not loaded by this filter. Run `mix test lib/<slice>/for_<unit>` with the real directory and require a nonzero count, then run `mix test` after a discovery change and account for every previously discovered test. Include `lib` and `test` scripts in the formatter inputs.

## Choose the boundary

Call pure functions directly. For shared `given` setup use a helper that returns a fresh context per test; perform the action in the concrete case. Use `setup_all` only for immutable inputs, never for a mutable Chronicle or application session. For example, build fresh scenario data from module-scoped constants:

```elixir
setup_all do
  %{title: "Aster"}
end

setup %{title: title} do
  given = %{title: title} |> AuthorsGiven.given_author() |> AuthorsGiven.given_catalog()
  %{given: given}
end
```

Each app-owned `given_*` function takes the previous context and returns the next. When givens append history, count only events appended after the action starts.

Use `Phoenix.LiveViewTest.render_component/2` for static component behavior and `Phoenix.LiveViewTest.live/2` when the result depends on a mounted view, such as form validation or submission.
