# Select the Elixir application dependency

For a Mix application that will supervise Chronicle work, add the application client to `deps`, for example:

```elixir
{:cratis_chronicle, "4.0.2"}
```

Resolve dependencies. The client should appear in the application's dependency graph with its own `:cratis_chronicle_contracts` requirement (`~> 19.188` for this example). If only the contracts package is present, add the application dependency rather than starting generated message modules as workers. Verify that the supervised application performs its intended operation against a disposable namespace before deployment.
