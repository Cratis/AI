# Exercise an Elixir backend

Use the Arc ExUnit case with the application's Arc module. It supplies a per-test runtime rather than calling a handler outside the pipeline:

```elixir
use Cratis.Arc.Test.Case, application: Library.Arc, event_types: [BookRegistered]

test "rejects the missing title", %{arc: arc} do
  result = Cratis.Arc.Test.execute(arc, %RegisterBook{title: ""})
  Cratis.Arc.Test.assert_invalid(result, :title)
end
```

For colocated specs without the `_test` suffix, follow “Discover colocated specs” in the `specs.elixir` rule and require a nonzero test count from the focused directory.

For an authorization rule use `principal(name, roles)` and `assert_forbidden` from `Cratis.Arc.Test`. For a query spec, call `Cratis.Arc.Test.query(arc, read_model, name, args)` with the scenario from the case and assert the returned rows. If setup already owns an isolated Chronicle client, build the scenario with `Cratis.Arc.Test.scenario(application, client)`; neither command nor query needs global configuration.

For an HTTP host or LiveView test that reads application configuration, set `configure: true` on the case, or call `Cratis.Arc.Test.configure(application, client)` during explicit setup. It changes shared application configuration and restores it on exit. Keep these and `observable: true` tests non-async.

For an append contract use `Cratis.Chronicle.Testing.Case` and its `chronicle` context. Import `Cratis.Chronicle.Testing.Assertions` to check a named constraint violation and `assert_appended` or `refute_appended` against the same client. An unsupported in-memory RPC returns `{:error, {:not_supported_in_memory, rpc}}`; move that proof to a running kernel rather than asserting on the unsupported result.

Pass `client: client` on each Chronicle operation so the action and assertions use the same isolated store. Use `start_supervised_client/1` when managing setup explicitly. A synchronous in-memory reactor dispatch is not a gRPC observation test.

## Exclude seeded events from the asserted effects

Use a `Cratis.Chronicle.Testing.Case` per-test client. Register the real event types and reducer or reactor in `event_types:`, `reducers:` or `reactors:` as needed. A shared given can append history in `setup`; wait for it before taking the baseline. For example, with an account reducer and a reactor that acknowledges a deposit:

```elixir
:ok = EventLog.append(id, %AccountOpened{initial_balance: 50}, client: client)
:ok = Testing.wait_for_observers(client)
seeded = length(Testing.appended_events(client, id))

:ok = EventLog.append(id, %FundsDeposited{amount: 25}, client: client)
:ok = Testing.wait_for_observers(client)

new_events = Testing.appended_events(client, id) |> Enum.drop(seeded)
assert Enum.map(new_events, & &1.event) == [%FundsDeposited{amount: 25}, %DepositAcknowledged{}]
assert {:ok, %AccountReadModel{balance: 75}} = Testing.read_model(client, AccountReducer, id)
```

`Testing` is `Cratis.Chronicle.Testing`; `EventLog` is `Cratis.Chronicle.EventSequences.EventLog`. Assert only the effect the artifact owns: omit the reactor and its acknowledgement when the only promise is the reduced balance. A non-`:ok` wait fails the spec; do not read state as if dispatch succeeded.

## Wait for a specific append on a running kernel

Use `ExUnit.Case` with `@moduletag :integration` and a per-test setup. Set `CHRONICLE_INTEGRATION_CONNECTION_STRING` to a disposable kernel. `Integration` below is `Cratis.Chronicle.Testing.Integration`.

```elixir
setup do
  {:ok, client} = Integration.setup_isolated_client(event_types: [AccountOpened], reducers: [AccountReducer])
  %{chronicle: client}
end

test "projects an opened account", %{chronicle: client} do
  assert {:ok, %{sequence_number: sequence}} =
           EventLog.append_with_result("account-1", %AccountOpened{initial_balance: 50}, client: client)
  assert is_integer(sequence)
  assert {:ok, %{success: true, failed_partitions: []}} =
           Integration.wait_for_observers(sequence, client: client)
  # Assert the account through the application's read surface here.
end
```

Use a non-async case for the default registered client name; parallel clients need distinct names. The helper creates a unique store and namespace and stops the client on exit, but does not delete its store or namespace. The wait assertion fails on transport errors and reported observer failures, rather than treating a successful RPC as successful observation.
