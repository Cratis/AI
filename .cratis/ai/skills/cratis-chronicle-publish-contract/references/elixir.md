# Publish and subscribe in Elixir

Declare `use Cratis.Chronicle.Events.EventType, id: "author-listed", public: true` on the public event only. Verify its outbox entry separately from the consumer definition. At the destination use `Cratis.Chronicle.EventStoreSubscriptions.subscribe("listing-feed", "library", fn b -> DefinitionBuilder.with_event_type(b, AuthorListed) end, opts)` with the subscription `DefinitionBuilder`. Keep the filter explicit; the overload without it selects all available types.
