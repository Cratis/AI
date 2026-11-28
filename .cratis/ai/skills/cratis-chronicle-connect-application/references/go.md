# Dial and scope the Go store

`chronicle.NewClient` constructs a client; `chronicle.Dial(ctx, options...)` connects and returns startup errors. Check the error before deferring `client.Close()`. Select `store, err := client.EventStore(ctx, chronicle.StoreName("library"), chronicle.WithNamespace("test"))` and handle its error separately. Use a bounded context and validated TLS. With `WithGRPCConnection`, the channel is borrowed: its original owner closes it after the client has finished.

For a bounded shutdown use `CloseContext`. Retain startup/registration errors separately from shutdown errors; an unsupported legacy hook is not evidence that registration completed.
