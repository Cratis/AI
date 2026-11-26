---
name: cratis-arc-select-backend-sdk
compatibility: Native backend toolchain and its resolved Arc module.
description: Use when adding Arc behavior to a Node, JVM, Go or Elixir backend instead of a C# host. Not for Chronicle client lifecycle (cratis-chronicle-select-client).
---

# Admit one native backend capability

1. Identify the process that *runs* the behavior, its resolved module and release, and one outcome a caller needs. A React proxy is not a Node command host; a Java caller is not a Kotlin coroutine. **Done:** record a tuple such as Go / `github.com/cratis/arc.go` / version from `go list -m github.com/cratis/arc.go` / typed command response.
2. Default to that release's native public declaration and a consuming test in the requested language. Match receiver, registration, invocation and response, not just the feature name in the Arc capability matrix. Read references/native-command-query.md when selecting a handler or read. **Done:** identify the imports and a test that crosses the requested boundary. If either is missing, report exactly what is unverified; do not translate a .NET example or switch runtimes without agreement.
3. Exercise that one outcome. For example, register this Go handler with `commands.Handle(ConfirmName.Handle)` and execute it through the registry's pipeline:

```go
type ConfirmName struct{ Name string }

func (c ConfirmName) Handle(context.Context) (string, error) { return c.Name, nil }
```

   **Requires (Go example):** Check `go version` against the application's `go.mod`. If unavailable, run the check in the application's Go build environment.

   Run `go test -v ./...` from the application module. **Done:** the test for the native handler runs and asserts a successful envelope with a present typed response matching the submitted name. This verifies an in-process reply, not HTTP routing or an appended fact.
4. Split composite requests at the first unproved boundary. Read references/identity-storage.md when identity, tenancy or persistence enters the request; read references/native-tests-and-proxies.md when the deliverable includes generated clients or browser behavior. **Done:** each claimed capability has a native consumer observation; list any remaining gap separately. For an event-store client rather than Arc's command pipeline, pass the runtime and store requirement to [Choose the Chronicle client layer](../cratis-chronicle-select-client/SKILL.md).
