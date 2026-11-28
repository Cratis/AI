# Expose a finite query before making it live

Register each finite performer with `queries.Register` on the builder; use `WithParameters` to identify request arguments. A `//arc:readmodel` comment alone does not map a route. For a live query use `queries.RegisterObservable[Task](builder, "All", queries.Function(perform), ...)`, where `perform` returns `(observable.Source[[]Task], error)` rather than a loaded slice. Handle registration errors before building. Verify one finite call, then subscribe and prove a later change arrives without another GET.

## Execute without an HTTP listener

After registering `Author.All` on a `queries.Registry` named `registry`, build and call the pipeline. Handle a Go error before inspecting the Arc result:

```go
func loadAuthors(ctx context.Context, registry *queries.Registry) ([]Author, bool, error) {
    pipeline, err := registry.Build(queries.PipelineOptions{})
    if err != nil {
        return nil, false, err
    }
    result, err := queries.Perform[[]Author](ctx, pipeline, "Author.All", queries.Request{})
    if err != nil {
        return nil, false, err
    }
    if !result.IsSuccess() {
        return nil, false, fmt.Errorf("query failed (status %d)", result.StatusCode())
    }
    authors, present := result.Data()
    return authors, present, nil
}
```

On success, `!present` means no data was returned; `present && len(authors) == 0` is an empty result. Do not start a listener just to exercise this boundary.
