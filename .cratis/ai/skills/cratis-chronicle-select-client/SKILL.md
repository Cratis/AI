---
name: cratis-chronicle-select-client
description: Use when a maintainer needs to choose a Chronicle client or consume its gRPC contracts in Go, Kotlin, TypeScript, Elixir or Python. Not for HTTP commands and queries (use cratis-arc-select-backend-sdk).
compatibility: The chosen language toolchain and a versioned Chronicle release.
---

# Choose a Chronicle client for a non-.NET service

**Application or wire tool?** For an application, choose the idiomatic client only if its tagged support and integration tests cover the operation against the intended kernel. Look for `github.com/cratis/chronicle.go`, `io.cratis:chronicle`, `@cratis/chronicle` or `:cratis_chronicle`. Don't override a client's transitive contracts to make versions appear to match. If a required observer isn't supported, host it in a [.NET worker](../cratis-chronicle-react-to-fact/SKILL.md).

For protocol inspection or building tooling, use the wire contracts instead. Start in a disposable project with the recipe for the language below. These offline checks do not register an event, start a client session or demonstrate that an application can append. Verify the exact client/kernel pair separately against a disposable namespace before choosing it.

- [Go: inspect an event type](references/go.md)
- [Kotlin/JVM: load the protocol descriptor](references/kotlin.md)
- [TypeScript: load the gRPC service definition](references/typescript.md)
- [Elixir: check the bundled protocol](references/elixir.md)
- [Python: round-trip a generated message](references/python.md)
