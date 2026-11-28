# Expose a finite query before making it live

Register each finite performer with `queries.Register` on the builder; use `WithParameters` to identify request arguments. A `//arc:readmodel` comment alone does not map a route. For a live query use `queries.RegisterObservable[Task](builder, "All", queries.Function(perform), ...)`, where `perform` returns `(observable.Source[[]Task], error)` rather than a loaded slice. Handle registration errors before building. Verify one finite call, then subscribe and prove a later change arrives without another GET.
