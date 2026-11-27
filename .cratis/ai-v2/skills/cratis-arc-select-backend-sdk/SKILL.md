---
name: cratis-arc-select-backend-sdk
description: Use when adding an Arc command or query to a native service and checking whether its backend SDK supports the requested capability. Not for Chronicle client lifecycle (use cratis-chronicle-select-client).
compatibility: Requires the service's native toolchain and resolved Arc module. The example uses Go.
---

# Choose an Arc backend for the required behavior

## Keep an existing MVC action

Use Arc's .NET ASP.NET Core MVC integration when the release must keep an existing MVC action with its binding and authorization. Keep MVC enabled in `AddCratisArc` and keep controller routes mapped. An eligible attribute-routed `[HttpPost]` action gets a `POST <action-route>/validate` selector without converting it to a model-bound command. Verify it with the same credentials, content type and payload as execution, and confirm the action was not called. Check for `[AspNetResult]` opt-outs. Before promising a port, prove the same routing, binding, authorization and validate-only behavior on the target host; a working command pipeline is not MVC compatibility.

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
