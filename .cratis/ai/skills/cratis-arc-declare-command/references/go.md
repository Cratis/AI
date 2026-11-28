# Register the command in Go

Bind request fields to a struct and return `(result, error)` from the method. Register the method expression before building the host; there is no reflective command scan. For example, `Greet.Handle` returns a client reply, whereas `RegisterBook.Handle` requests an append through the Chronicle integration:

```go
package library

import (
    "context"

    arc "github.com/cratis/arc.go"
    "github.com/cratis/arc.go/commands"
    "github.com/cratis/arc.go/integrations/chronicle"
)

type Greet struct {
    Name string `json:"name" validate:"required"`
}

func (c Greet) Handle(context.Context) (string, error) { return "Hello, " + c.Name, nil }

func RegisterGreet(builder *arc.Builder) error {
    return commands.Register[Greet](builder, commands.Handle(Greet.Handle))
}

type BookID string

type RegisterBook struct {
    BookID BookID `json:"bookId"`
    Title  string `json:"title" validate:"required"`
}

type BookRegistered struct {
    Title string `json:"title"`
}

func (c RegisterBook) Handle(context.Context) (chronicle.EventBatch, error) {
    return chronicle.Events(chronicle.EventForSource(
        chronicle.EventSourceID(c.BookID), BookRegistered{Title: c.Title},
    )), nil
}

func RegisterBookCommand(builder *arc.Builder) error {
    return commands.Register[RegisterBook](builder, commands.Handle(RegisterBook.Handle),
        commands.WithNoResponse[RegisterBook]())
}
```

For the append example, register `BookRegistered` in the Chronicle event catalog and install the integration on the builder before `Build`. Use `cratis-chronicle-record-event` if installed for the Go event registration steps. The integration is a nested module: the root Arc version does not version it. Use a verified integration checkout or version as described in `cratis-arc-select-backend-sdk`; without the integration use the standalone reply example and don't claim an append.

A plain return is not a request to persist. Use `chronicle.Events` to group event values and `chronicle.EventForSource` to name an individual event's target explicitly. Verify that target in a pipeline spec. For preparation before a decision, use `commands.WithProvide(provide, handle)` to bind the preparation function and consume its typed result. Finish registration before `Build`; it seals composition.
