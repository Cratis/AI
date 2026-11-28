# Publish and subscribe in Elixir

In the source store (`library` here), register `AuthorListed` with `use Cratis.Chronicle.Events.EventType, id: "author-listed", public: true` and `defstruct [:name]`. Public visibility does not route the append: the default `event-log` rejects public events. For a standalone append in the producer, pass the source client and namespace in `opts` and select `outbox` explicitly:

```elixir
alias Cratis.Chronicle.EventSequences.EventLog

EventLog.append(source_id, %AuthorListed{name: name}, Keyword.put(opts, :event_sequence_id, "outbox"))
```

Check the append returns `:ok`, then verify the outbox entry independently of subscription registration. In the destination, with `AuthorListed` available and `destination_opts` selecting the client configured for the destination store, register an explicit filter:

```elixir
alias Cratis.Chronicle.EventStoreSubscriptions
alias Cratis.Chronicle.EventStoreSubscriptions.DefinitionBuilder

EventStoreSubscriptions.subscribe(
  "listing-feed",
  "library",
  fn builder -> DefinitionBuilder.with_event_type(builder, AuthorListed) end,
  destination_opts
)
```

The overload without a filter selects all available types. Check registration, then verify delivery in the destination inbox.
