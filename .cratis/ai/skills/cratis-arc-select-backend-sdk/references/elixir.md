# Elixir: execute a counter command

With Elixir 1.18 or later, add `{:cratis_arc, "1.4.10"}` to an application's Mix dependencies. For a configured Plug application and test kernel use `Samples/plug` in the Arc.Elixir `v1.4.10` checkout; it resolves Arc from source at that tag.

```sh
git clone --branch v1.4.10 --depth 1 https://github.com/Cratis/Arc.Elixir.git
cd Arc.Elixir/Samples/plug
mix deps.get
mix test test/counters_test.exs
```

`Counters.Counting.IncrementCounter` uses `Cratis.Arc.Command`, marks `:id` as its key and returns `{:append, %Counters.CounterIncremented{by: by}}` from `handle/2`. In the sample's test case `arc` is the scenario supplied by `Cratis.Arc.Test.Case`:

```elixir
id = Cratis.Arc.new_id()
result = Cratis.Arc.Test.execute(arc, {Counters.Counting.IncrementCounter, %{"id" => id, "by" => 3}})
Cratis.Arc.Test.assert_success(result)
Cratis.Arc.Test.assert_appended(arc, %Counters.CounterIncremented{by: 3}, event_source_id: id)
```

An increment of 1000 fails the sample's validation. Check the result and absence of an appended event, not just whether `handle/2` returns a tuple. This path doesn't establish production connectivity.
