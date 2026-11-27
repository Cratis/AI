---
name: cratis-arc-select-backend-sdk
description: Use when choosing or evaluating an Arc backend SDK for a command, query or existing ASP.NET Core MVC endpoint. Not for Chronicle client lifecycle (use cratis-chronicle-select-client).
compatibility: Requires the service's native toolchain and resolved Arc module. The example uses Go.
---

# Choose an Arc backend for the required behavior

## Match the host integration

Keep the existing host for a new Library slice. If porting, choose the SDK that runs in the target host and check the required operation against the installed dependency before committing to the port.

| Host | Identify the installed artifact | Run the host project's check |
| --- | --- | --- |
| Node server | Arc.TypeScript: `@cratis/arc.core` and the host adapter if used; `@cratis/arc` and `@cratis/arc.react` are client packages | `npm test` for a project with a test script |
| Spring Boot / JVM | Arc.Kotlin: `io.cratis:arc-spring-boot-starter` | `./gradlew test` |
| Elixir / OTP | Arc.Elixir: `cratis_arc` | `mix test` |
| Go | Arc.Go: `github.com/cratis/arc.go` | `go test ./...` |

If HTTP is required, call the route on the actual host. Choose ASP.NET Core when you need to retain its MVC controller behavior. For an attribute-routed MVC `[HttpPost]` command action without an `[AspNetResult]` opt-out, send the same body and credentials to `POST <action-route>/validate`: MVC binding and authorization still run, but the action body does not. An in-process test cannot prove that behavior.

## Check command execution in a native SDK

Identify the resolved package and requested operation, inspect the package's declarations and run its native test. If either the API or runnable setup is missing, report that gap rather than translating C# attributes. This example uses Go.

1. From the Go service root run `go list -m github.com/cratis/arc.go` for the version, then `go list -m -f '{{.Dir}}' github.com/cratis/arc.go` for its location. Read `commands` and its `_test.go` files there.
2. In `features/authors/registration/command_test.go`, register the handler, build a command pipeline and submit the request. Check both execution success and the returned name.
3. Run `go test ./features/authors/registration` from the module root.

```go
package registration_test

import (
    "context"
    "encoding/json"
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

A Go `type AuthorId string` is distinct from `string` but `encoding/json` reads and writes it as a JSON string. In the same file, verify its wire shape when the ID leaves the process:

```go
func TestAuthorIdJSON(t *testing.T) {
    const id AuthorId = "11111111-1111-4111-8111-111111111111"
    data, err := json.Marshal(id)
    if err != nil || string(data) != `"11111111-1111-4111-8111-111111111111"` {
        t.Fatalf("JSON=%q err=%v", data, err)
    }
    var decoded AuthorId
    if err := json.Unmarshal(data, &decoded); err != nil || decoded != id {
        t.Fatalf("decoded=%q err=%v", decoded, err)
    }
}
```

## When it goes off the usual path

- **The Go command test passes but the port needs proxy generation:** check `go list -m github.com/cratis/arc.go/tools` in the module that owns tool dependencies. The root `arc.go` module does not prove the generator is installed.
- **The MVC client relies on validation without execution:** test `POST /api/features/authors/registration/validate` with `Content-Type: application/json` and `{"id":"11111111-1111-4111-8111-111111111111","name":""}`. The registration route must bind the request and report the name error without invoking the action.

## Avoid

- Don't infer a Chronicle append or HTTP route registration from a successful handler reply.

## Related skills

- [Name a domain value](../cratis-fundamentals-name-value/SKILL.md) in C#.
- [Select the Chronicle client](../cratis-chronicle-select-client/SKILL.md) for event-store connectivity.
