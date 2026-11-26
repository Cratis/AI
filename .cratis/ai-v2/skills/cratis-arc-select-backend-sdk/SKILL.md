---
name: cratis-arc-select-backend-sdk
description: Checks whether a native Arc SDK supports a requested backend capability. Use when adding an Arc command or query to a Node, JVM, Go or Elixir service. Not for Chronicle client lifecycle (use cratis-chronicle-select-client).
compatibility: Native backend toolchain and its resolved Arc module.
---

# Check the requested capability in the native SDK

Choose the implementation from the service's own package and toolchain. A shared HTTP contract tells the client how to call an operation, not how to declare it in Go or Java.

1. Name the target language, resolved package version and exact capability requested. For the Library's Go service read `go.mod` and confirm the version actually resolved by the Go toolchain. Command validation and command execution are different capabilities.
2. Locate an example for that capability in the resolved native SDK. Identify its declarations, registration and check in that language.
3. Run the native check in the target project. Report the behavior it exercised; don't generalize from a handler test to the entire endpoint pipeline.
4. If the native surface or runnable setup is unknown, report that gap instead of supplying translated C# code.

## Test the Library's Go command handler

In a Go module that resolves `github.com/cratis/arc.go`, put this test in `features/authors/registration/command_test.go`. Use the module's existing version; run `go list -m github.com/cratis/arc.go` to see it. From the module root run `go test ./features/authors/registration`.

```go
package authors_test

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
    registry := commands.NewRegistry()
    commands.Register(registry, commands.Handle(RegisterAuthor.Handle))
    pipeline := commands.NewCommandPipeline(commands.PipelineOptions{Registry: registry})
    result, value := commands.Execute[AuthorRegistered](context.Background(), pipeline,
        RegisterAuthor{Id: "11111111-1111-4111-8111-111111111111", Name: "Aster"})
    if !result.IsSuccess() || !result.HasResponse || value.Name != "Aster" {
        t.Fatalf("result=%+v value=%v", result, value)
    }
}
```

This tests the Go pipeline's returned value. It does not register an HTTP endpoint or append a Chronicle event.

## Check validation separately

For `RegisterAuthor`, take the route from the running Library service's command contract rather than deriving it from the name. From the API client's point of view the wire operation is:

```text
POST <command-route>/validate
```

Check that the validator and authorization policy run without invoking the handler. To recommend how to *implement* that endpoint in a Go service, first identify the Go registration and exercise that behavior with its resolved module. A passing native command-execution test alone leaves validation untested.

## Avoid

- Don't translate `[Command]` into an invented native annotation.
- Don't take a matching URL as a guarantee of matching dependency injection.
- Don't present a check of one language's SDK as support in another.

## Related skills

- [Select the Chronicle client](../cratis-chronicle-select-client/SKILL.md) for event-store connectivity rather than Arc command support.
