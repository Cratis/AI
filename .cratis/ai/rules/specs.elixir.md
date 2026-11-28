---
applyTo: "**/for_*/**/*.exs, **/when_*/**/*.exs, **/mix.exs, **/test_helper.exs"
paths:
  - "**/mix.exs"
  - "**/test_helper.exs"
  - "**/for_*/**/*.exs"
  - "**/when_*/**/*.exs"
---

# Specify Elixir behavior

Use ExUnit tests with native fixtures. For an Arc command exercise the pipeline through `Cratis.Arc.Test`; for Chronicle use `Cratis.Chronicle.Testing.Case`. Seed only the relevant state, execute once and assert the accepted fact or specific refusal. Do not infer a real external delivery from an in-memory test.

## Discover colocated specs

Keep specs as `.exs` under `lib/<slice>/for_<unit>/`, without a `_test` suffix. On Elixir 1.19 or newer, add these entries to `project/0` in `mix.exs`:

```elixir
test_paths: ["lib"],
test_load_filters: [
  &(String.ends_with?(&1, ".exs") and String.contains?(&1, "/for_") and
      not String.contains?(&1, "/given/"))
],
test_ignore_filters: [&String.contains?(&1, "/given/")],
```

Leave `test_pattern` at the default: it selects candidate files, and the load filter replaces the default `_test.exs` suffix check. In `lib/test_helper.exs`, call `ExUnit.start()` and load shared `given/` scripts once with `Code.require_file/2`; they are not test files. Run `mix test lib/<slice>/for_<unit>` with the real directory substituted and require a nonzero test count. For older Elixir versions keep the project's working `*_test.exs` discovery until upgrading Mix.
