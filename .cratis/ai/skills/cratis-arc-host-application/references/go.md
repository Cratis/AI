# Start a Go host

Create the builder with `builder, err := arc.NewBuilder(arc.Options{})`. Before `builder.Build()`, register each model-bound command, for example `commands.Register[Greet](builder, commands.Handle(Greet.Handle))` for a command whose `Handle` returns a greeting. Return registration and build errors instead of starting a partially configured host.

Let `app.Run(ctx, "127.0.0.1:8080")` own the listener. Invoke the greeting command with a known name and check the returned greeting. When another HTTP server owns the listener, start Arc explicitly, route requests through its `ServeHTTP`, and shut Arc down with the server rather than also calling `Run`.
