# Go: check a typed command reply

In an empty directory with Go 1.26 or later run `go mod init example.org/library` and `go get github.com/cratis/arc.go@v0.1.4`. Save this as `register_author_test.go`:

```go
package library_test

import (
    "context"
    "testing"

    "github.com/cratis/arc.go/commands"
)

type RegisterAuthor struct{ Name string }
type AuthorRegistered struct{ Name string }

func (c RegisterAuthor) Handle(context.Context) (AuthorRegistered, error) {
    return AuthorRegistered{Name: c.Name}, nil
}

func TestNativeReply(t *testing.T) {
    var registry commands.Registry
    if err := commands.Register(&registry, commands.Handle(RegisterAuthor.Handle)); err != nil {
        t.Fatal(err)
    }
    pipeline, err := registry.Build(commands.PipelineOptions{})
    if err != nil { t.Fatal(err) }
    result, err := commands.Execute[AuthorRegistered](context.Background(), pipeline, RegisterAuthor{Name: "Aster"})
    if err != nil { t.Fatal(err) }
    value, ok := result.Response()
    if !result.IsSuccess() || !ok || value.Name != "Aster" { t.Fatal("missing author reply") }
}
```

Run `go mod tidy` and `go test -run TestNativeReply .`. Expect `PASS`. The returned `AuthorRegistered` is a typed response; this handler does not append a Chronicle event.

The root version does not version nested modules. The Chronicle integration in this checkout requires Chronicle.Go v0.9.1. No independent release tags for the integration or tools were verified: do not append `@v0.1.4` to their module paths. Use the tagged checkout for the sample or stay on the standalone pipeline.
