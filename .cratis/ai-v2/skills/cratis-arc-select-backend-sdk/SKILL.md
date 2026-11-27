---
name: cratis-arc-select-backend-sdk
description: Use when choosing or evaluating an Arc backend SDK for a command, query or existing ASP.NET Core MVC endpoint. Not for Chronicle client lifecycle (use cratis-chronicle-select-client).
compatibility: Requires the service's native toolchain and resolved Arc module. The example uses Go.
---

# Choose an Arc backend for the required behavior

## Match the host integration

Keep Arc on ASP.NET Core when an endpoint depends on MVC routing, binding or authorization. Keep controller integration enabled and routes mapped. For an attribute-routed `[HttpPost]` command action without an `[AspNetResult]` opt-out, Arc accepts `POST` at the action's route plus `/validate`. MVC still binds and validates the input, but Arc skips the action body. Verify required host behavior before porting; matching wire contracts or successful in-process execution do not prove compatibility.

## Check command execution in a native SDK

Identify the resolved package and requested operation, inspect the package's declarations and run its native test. If either the API or runnable setup is missing, report that gap rather than translating C# attributes. This example uses Go.

1. From the Go service root run `go list -m github.com/cratis/arc.go` for the version, then `go list -m -f '{{.Dir}}' github.com/cratis/arc.go` for its location. Read `commands` and its `_test.go` files there.
2. In `features/authors/registration/command_test.go`, register the handler, build a command pipeline and submit the request. Check both execution success and the returned name.
3. Run `go test ./features/authors/registration` from the module root.

```go
package registration_test

import (
    "context"
    "testing"
    "github.com/cratis/arc.go/commands"
)

type AuthorId string
type RegisterAuthor struct {
    Id AuthorId
    Name string
}
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
    result, err := commands.Execute[AuthorRegistered](context.Background(), pipeline,
        RegisterAuthor{Id: "11111111-1111-4111-8111-111111111111", Name: "Aster"})
    if err != nil { t.Fatal(err) }
    value, present := result.Response()
    if !result.IsSuccess() || !present || value.Name != "Aster" {
        t.Fatalf("success=%t present=%t value=%v", result.IsSuccess(), present, value)
    }
}
```

## Avoid

- Don't infer a Chronicle append or HTTP route registration from a successful handler reply.
- Don't infer validation-only behavior from execution. To check it, POST to the command route's `/validate` suffix and verify that authorization and validation run without invoking the handler. Without an HTTP test, report that behavior as unverified.

## Related skills

- [Select the Chronicle client](../cratis-chronicle-select-client/SKILL.md) for event-store connectivity.
