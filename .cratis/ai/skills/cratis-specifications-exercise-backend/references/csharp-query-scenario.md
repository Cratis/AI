# Exercise a C# query through its pipeline

`QueryScenario<TReadModel>` from `Cratis.Arc.Testing` (namespace `Cratis.Arc.Testing.Queries`) runs a static query method on the read model through the real query pipeline: argument conversion, validation, authorization and dependency resolution. A direct method call exercises none of those.

- `await scenario.Perform(nameof(TReadModel.Method), arguments)` returns one `QueryResult`. Pass `QueryArguments` when the method takes parameters.
- `await scenario.Observe(nameof(TReadModel.Method))` returns a `QueryObservation` for an observable query. `Initial` holds the first result, including a pipeline rejection; `await observation.Next()` waits for the next one. Waiting for either the initial emission during `Observe` or the next emission can throw `TimeoutException` after five seconds unless a timeout is passed. Dispose the observation with `await using`, or the subscription outlives the spec.
- `Perform` rejects a query returning `IAsyncEnumerable<TReadModel>` with `StreamingQueryNotSupported`; use `Observe` for that shape.
- Seed with `scenario.Given.ForEventSource(id).ReadModel(instance)` or `.Events(...)` after importing `Cratis.Arc.Chronicle.Testing.Queries`.
- `Perform` takes no principal. Register an `ICurrentPrincipalAccessor` in `scenario.Services` before the first call; a denial shows as `IsAuthorized == false`.

```csharp
await using var scenario = new QueryScenario<Author>();
scenario.Given.ForEventSource(id).ReadModel(new Author(id, "Aster"));

var result = await scenario.Perform(nameof(Author.ById), new QueryArguments { ["id"] = id.Value });

result.IsSuccess.ShouldBeTrue();
```

Assert the returned row by ID as well as the success flag; an empty successful result also passes the flag. A query restricted to an authentication scheme fails closed as unauthorized here, because selecting a scheme needs a live HTTP context: prove it in an HTTP-hosted spec.
