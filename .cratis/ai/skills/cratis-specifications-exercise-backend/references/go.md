# Exercise a Go backend

Register the application's commands on its Arc builder. In a `testing.T` test, `github.com/cratis/arc.go/arctest` starts the pipeline and registers cleanup:

```go
fixture := arctest.New(t, builder)
scenario := arctest.NewCommand[Greeting, string](fixture)
result, err := scenario.Execute(t.Context(), Greeting{Name: "Ada"})
if got := arctest.RequireResponse(t, result, err); got != "Hello, Ada" {
    t.Fatalf("response = %q", got)
}
```

With `NewScenario(ctx, builder)` the caller owns `Close(ctx)`. Use `NewQuery[R](fixture, name).Perform(...)` for snapshot queries. On refusal assert the validation reason or authorization, not only an unsuccessful result.

Use `github.com/cratis/chronicle.go/chronicletest` for `NewEventScenario`, `NewReadModelScenario[M]` or `NewReactorScenario[R]`. Seed with `scenario.Given(ctx, source, events...)` and check its error. Choose `Config{Registry: registry, Engine: chronicletest.Kernel, ConnectionString: url}` when the proof depends on a kernel. Call `RequireFidelity(t, scenario.Fidelity(), chronicletest.Constraints)` before testing a constraint: it verifies the engine supports the layer, not that the claim was rejected. Assert the rejection separately.

Assert the returned effect with `chronicletest.ShouldHaveProduced[T](t, scenario.Produced(), predicate)`. For a model, check both `Exists` and the actual value on the result of `Instance(ctx)`; a missing row is not a successful zero-valued model.
