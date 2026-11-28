# Exercise an Elixir backend

Use the Arc ExUnit case with the application's Arc module. It supplies a per-test runtime rather than calling a handler outside the pipeline:

```elixir
use Cratis.Arc.Test.Case, application: Library.Arc, event_types: [BookRegistered]

test "rejects the missing title", %{arc: arc} do
  result = Cratis.Arc.Test.execute(arc, %RegisterBook{title: ""})
  Cratis.Arc.Test.assert_invalid(result, :title)
end
```

For colocated specs without a `_test` suffix, follow the Mix discovery setup in `specs.elixir.md`; require a nonzero test count from the focused directory.

For an authorization rule use `principal(name, roles)` and `assert_forbidden` from `Cratis.Arc.Test`. For a query spec, call `Cratis.Arc.Test.query(arc, read_model, name, args)` with the scenario from the case and assert the returned rows. If setup already owns an isolated Chronicle client, build the scenario with `Cratis.Arc.Test.scenario(application, client)`; neither command nor query needs global configuration.

For an HTTP host or LiveView test that reads application configuration, set `configure: true` on the case, or call `Cratis.Arc.Test.configure(application, client)` during explicit setup. It changes shared application configuration and restores it on exit. Keep these and `observable: true` tests non-async.

For an append contract use `Cratis.Chronicle.Testing.Case` and its `chronicle` context. Import `Cratis.Chronicle.Testing.Assertions` to check a named constraint violation and `assert_appended` or `refute_appended` against the same client. An unsupported in-memory RPC returns `{:error, {:not_supported_in_memory, rpc}}`; move that proof to a running kernel rather than asserting on the unsupported result.

Pass `client: client` on each Chronicle operation so the action and assertions use the same isolated store. Use `start_supervised_client/1` when managing setup explicitly. A synchronous in-memory reactor dispatch is not a gRPC observation test.
