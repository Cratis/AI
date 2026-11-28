# Register the command in Go

Bind request fields to a struct and return `(result, error)` from the method. Register the method expression before building the host:

```go
type Greet struct {
    Name string `json:"name" validate:"required"`
}

func (c Greet) Handle(_ context.Context) (string, error) { return "Hello, " + c.Name, nil }
```

Use `commands.Register[Greet](builder, commands.Handle(Greet.Handle))` and return any registration error. There is no reflective command scan. A returned struct by itself is a response, not an appended event: use the Chronicle integration for persistence and verify the selected history separately.

Use `commands.WithProvide(provide, handle)` to bind a preparation function and a handler that consumes its result. Finish registration before `Build`; it seals composition. When the Chronicle integration is available return `chronicle.Events(event)` to request persistence, not the bare response struct.
