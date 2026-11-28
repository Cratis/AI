# Inspect the selected supervised client

In the running application, pass the client name and namespace of the write to **both** reads. For example, with the client registered as `:bank_chronicle`:

```elixir
opts = [client: :bank_chronicle, namespace: "Default"]
Cratis.Chronicle.Observers.get_all(opts)
```

On `{:ok, observers}`, find the configured observer ID. If present, read `Cratis.Chronicle.FailedPartitions.get_for(observer_id, opts)` and inspect only failures for the affected partition. Report a lookup error as an error rather than an empty list. Do not switch to the default client if an explicitly named client is unavailable.
