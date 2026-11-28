# Exercise the Go command pipeline

## Contents

- RegisterBook pipeline spec
- Other guarantees

## RegisterBook pipeline spec

Use `arctest.New` with the configured Arc builder. This spec goes beside the `RegisterBook` handler from `cratis-arc-declare-command`, in the same Go package, and uses its `RegisterBookCommand` registration. It requires a verified checkout or version of the nested Chronicle integration; the root Arc version alone does not supply it.

Run the spec with `go test`. Each case uses its own scenario and recording participant; the recorder observes staging and commit attempts but does not connect to Chronicle.

```go
package library

import (
    "context"
    "reflect"
    "slices"
    "testing"

    arc "github.com/cratis/arc.go"
    "github.com/cratis/arc.go/arctest"
    "github.com/cratis/arc.go/commands"
    "github.com/cratis/arc.go/integrations/chronicle"
    "github.com/cratis/arc.go/validation"
)

func TestRegisterBook(t *testing.T) {
    for _, tc := range []struct {
        name, title string
        wantAppend  bool
    }{
        {name: "empty title"},
        {name: "whitespace title", title: " \t"},
        {name: "valid title", title: "Aster", wantAppend: true},
    } {
        t.Run(tc.name, func(t *testing.T) {
            bookID := BookID("book-17")
            writes := &recordingTransaction{}
            builder, err := arc.NewBuilder(arc.Options{Namespace: "Library"})
            requireNoError(t, err)
            integration, err := chronicle.New(chronicle.Options{
                StoreResolver: func(context.Context, commands.CommandContext) (chronicle.Coordinates, error) {
                    return chronicle.Coordinates{Store: "library", Namespace: "Default"}, nil
                },
                Transactions: writes,
                Events:       bookEventCatalog{},
            })
            requireNoError(t, err)
            requireNoError(t, integration.Install(builder))
            requireNoError(t, RegisterBookCommand(builder))
            command := arctest.NewCommand[RegisterBook, commands.NoResponse](arctest.New(t, builder))

            result, err := command.Execute(t.Context(), RegisterBook{BookID: bookID, Title: tc.title})
            requireNoError(t, err)
            if !tc.wantAppend {
                forTitle := slices.ContainsFunc(result.Details().ValidationResults, func(finding validation.Result) bool {
                    return finding.Severity == validation.Error && slices.Contains(finding.Members, "title")
                })
                if !result.IsAuthorized() || result.IsValid() || !forTitle || result.HasExceptions() {
                    t.Fatalf("expected title validation refusal, got %+v", result.Details())
                }
                if len(writes.entries) != 0 || writes.commits != 0 {
                    t.Fatalf("refusal staged %d events and attempted %d commits", len(writes.entries), writes.commits)
                }
                return
            }

            if !result.IsSuccess() || len(writes.entries) != 1 || writes.commits != 1 {
                t.Fatalf("expected success with one event and commit, got %+v / %+v", result.Details(), writes)
            }
            entry := writes.entries[0]
            event, ok := entry.Event.(BookRegistered)
            if entry.Source != chronicle.EventSourceID(bookID) || !ok || event.Title != tc.title {
                t.Fatalf("expected BookRegistered for %q with title %q, got %+v", bookID, tc.title, entry)
            }
        })
    }
}

type bookEventCatalog struct{}

func (bookEventCatalog) Descriptors() []chronicle.EventDescriptor {
    return []chronicle.EventDescriptor{{
        Type:     reflect.TypeFor[BookRegistered](),
        Identity: chronicle.EventType{ID: "book-registered", Generation: 1},
        Validate: func(any) error { return nil },
    }}
}

type recordingTransaction struct {
    entries []chronicle.Entry
    commits int
}

func (r *recordingTransaction) Begin(context.Context, chronicle.Coordinates) (chronicle.Participant, chronicle.CompletionOwner, error) {
    return r, r, nil
}

func (r *recordingTransaction) Stage(_ context.Context, batch chronicle.Batch) error {
    r.entries = append(r.entries, batch.Entries...)
    return nil
}

func (r *recordingTransaction) Commit(context.Context) (chronicle.CommitResult, error) {
    r.commits++
    return chronicle.CommitResult{Report: commands.CompletionReport{Disposition: commands.Committed}}, nil
}

func (*recordingTransaction) Rollback() error { return nil }

func requireNoError(t *testing.T, err error) {
    t.Helper()
    if err != nil {
        t.Fatal(err)
    }
}
```

## Other guarantees

For a response-producing command, use the declared client response type, not a returned effect, and assert the response. For an observable query use `NewObservableQuery` and close the subscription. The typed scenario does not exercise JSON binding; use a hosted request for that and a running kernel for persistence or delivery.
