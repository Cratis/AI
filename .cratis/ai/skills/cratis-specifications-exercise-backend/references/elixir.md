# Exercise an Elixir backend

Use the Arc ExUnit case with the application's Arc module. It supplies a per-test runtime rather than calling a handler outside the pipeline:

```elixir
use Cratis.Arc.Test.Case, application: Library.Arc, event_types: [BookRegistered]

test "rejects the missing title", %{arc: arc} do
  result = Cratis.Arc.Test.execute(arc, %RegisterBook{title: ""})
  Cratis.Arc.Test.assert_invalid(result, "title")
end
```

For an authorization rule use `principal(name, roles)` and `assert_forbidden` from `Cratis.Arc.Test`. Do not combine `async: true` with the globally configured or observable case options.

For an append contract use `Cratis.Chronicle.Testing.Case` and its `chronicle` context. Import `Cratis.Chronicle.Testing.Assertions` to check a named constraint violation and `assert_appended` or `refute_appended` against the same client. An unsupported in-memory RPC returns `{:error, {:not_supported_in_memory, rpc}}`; move that proof to a running kernel rather than asserting on the unsupported result.
