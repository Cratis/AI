---
name: cratis-arc-go
description: Use when building an Arc.Go HTTP command or read-model query with handwritten typed adapters and the root module. Not for Chronicle-only clients or unpublished Go integrations and generators.
license: MIT
compatibility: Go 1.26 or later; root module only.
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Arc HTTP CQRS in Go

> **Experimental v0:** minor releases may break APIs; pin the module version you test against.
> Companion guidance: Chronicle.Go and Fundamentals.Go.

**Only `github.com/cratis/arc.go`, the root module, is tagged.** Chronicle and
MongoDB integrations, `arc-gen`, `arc-vet` and framework-host recipes are separate
**source previews**, not installable released modules. Do not prescribe
those tools, promise generated proxies, or claim returned events append to
Chronicle in this root-module setup. Arc commands can return ordinary responses
without an event store.

## Verified product sources

| Product | Source checked |
| --- | --- |
| Arc.Go (`github.com/cratis/arc.go`) | `builder.go`, `application.go`, `server.go`, `lifecycle.go`, `commands/registration.go`, `commands/result.go`, `queries/registration.go`, `queries/example_test.go`, `authentication/microsoft_identity.go`, `example_test.go`, `arctest/example_test.go` |

[Source](https://github.com/Cratis/Arc.Go)
is authoritative. A README that says there is no tagged Go release is stale.
The [parity document](https://github.com/Cratis/Arc.Go/blob/main/Documentation/parity.md)
reports bounded **Partial** conformance; a paired snapshot HTTP checkpoint with
strict matches does not establish command, authentication, HEAD or whole-product parity.

## Declare, register and host a command

Install `github.com/cratis/arc.go` at your chosen release in a consumer module. This complete
package exposes a greeting with explicit handwritten registration:

```go
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

package greeting

import (
	"context"

	arc "github.com/cratis/arc.go"
	"github.com/cratis/arc.go/commands"
)

// Greet requests a greeting for a name.
type Greet struct {
	Name string `json:"name" validate:"required"`
}

// Handle produces the response without transport concerns.
func (c Greet) Handle(_ context.Context) (string, error) {
	return "Hello, " + c.Name, nil
}

// Build registers Greet and seals application composition without starting it.
func Build() (*arc.Application, error) {
	builder, err := arc.NewBuilder(arc.Options{})
	if err != nil {
		return nil, err
	}
	if err := commands.Register[Greet](builder, commands.Handle(Greet.Handle)); err != nil {
		return nil, err
	}
	return builder.Build()
}

// Run serves loopback HTTP until the caller cancels its context.
func Run(ctx context.Context) error {
	app, err := Build()
	if err != nil {
		return err
	}
	return app.Run(ctx, "127.0.0.1:8080")
}
```

The caller owns signals and error reporting. After calling `Run`, post
`{"name":"Ada"}` as JSON to `/api/greet`; the Arc envelope contains
`"response":"Hello, Ada"`. An empty name returns 400. `/api/greet/validate`
runs authorization/validation without the handler. This sample is public, not
an authorization baseline for private business operations.

`NewBuilder` and `Build` perform no listener or business-callback activation.
Build seals composition; do not mutate registries afterward or independently
build registries borrowed from the root builder. For an externally owned HTTP
server, explicitly `Start(ctx)` before `ServeHTTP` and `Shutdown(ctx)` with a
bounded cleanup context. `Run` owns the server path instead.

Use explicit `json` names and named concepts. A typed `commands.Handle` adapter
supports the result above; do not assume reflective C# discovery. `Provide`
preparation uses an explicit typed adapter, not an automatically found method.
Ordinary `(value, error)` results become Arc outcomes. Inspect the returned error
**and** `IsSuccess`/authorization/validation/exception flags. `Response()` carries
presence separately from legitimate zero values; `StatusCode()` preserves Arc's
200/403/400/500 precedence. Failed outcomes discard responses.

## Query a read model

Read [typed query registration](references/queries.md) when defining snapshot
queries, paging or observable sources. A value-receiver namespace method can
represent a static-equivalent query, but must still be explicitly registered.
A comment directive alone does not activate discovery or publish an endpoint.

Root-module observable queries support SSE and WebSocket with emission guards.
Use a lifecycle-bearing `observable.Source` with `queries.RegisterObservable`,
not an arbitrary channel returned from a snapshot registration. Preserve query
identity, authorization/validation on emissions, backpressure and joined cleanup;
SSE and WebSocket framing are not interchangeable. Consult the tagged
[observable query guide](https://github.com/Cratis/Arc.Go/blob/main/Documentation/backend/go/queries/observable-queries.md)
before choosing transport or delta behavior. Do not generalize its supported
profile to an unpublished MongoDB/Chronicle provider.

## Identity and tenancy are security boundaries

`authentication.MicrosoftIdentityPlatform` is an explicitly registered,
borrowed handler, not a JWT validator. With zero options it ignores forwarded
identity headers. Enable `MicrosoftIdentityOptions.TrustForwardedIdentityHeaders`
only behind a credential-validating ingress that strips caller-supplied
`x-ms-client-principal*` headers, writes verified replacements and prevents direct
backend access. Base64 and headers are not authentication proof.

Keep identity enrichment (`/.cratis/me`), endpoint authorization and tenant
membership distinct. Resolve the tenant from trusted request context; never
interpret a caller's tenant selection as permission to access it. Wire explicit
policies for private operations and verify both denial and cross-tenant isolation
before exposing the server. Do not copy .NET identity-provider or attribute APIs
into Go code.

## Verify and route

- Use `arctest.NewScenario`, `NewCommand` and `NewQuery` for in-process pipeline
  contracts; close the scenario with a bounded cleanup context. Validation-only
  assertions must prove no handler invocation/response.
- Test HTTP routes/envelopes, invalid input, authorization, presence/zero/null,
  observable cancellation and lifecycle ownership in addition to compilation.
- Inline operations have commit-aware recovery, not a generic rollback promise;
  consult tagged operation sources before implementing effects or compensation.
- A Chronicle-only client belongs in `cratis-chronicle-client-go`, not this skill.
- Check the module's `go.mod` for the Fundamentals.Go it requires; the separate concepts skill is not a required dependency upgrade.
