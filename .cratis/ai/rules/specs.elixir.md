---
applyTo: "**/for_*/**/*.exs, **/when_*/**/*.exs"
paths:
  - "**/for_*/**/*.exs"
  - "**/when_*/**/*.exs"
---

# Specify Elixir behavior

Use ExUnit tests with native fixtures. For an Arc command exercise the pipeline through `Cratis.Arc.Test`; for Chronicle use `Cratis.Chronicle.Testing.Case`. Seed only the relevant state, execute once and assert the accepted fact or specific refusal. Do not infer a real external delivery from an in-memory test.
