---
name: cratis-chronicle-client-go
description: Connect a standalone Go application to Chronicle, register events and observers, append with explicit outcomes, and materialize read models. Use for Chronicle.Go client setup, projections, reactors, gRPC ownership and safe retry decisions. Do not use for Arc HTTP commands or Chronicle kernel implementation.
license: MIT
compatibility: Go 1.26 or later; Chronicle.Go v0.9.1 with the Chronicle 19.32.3 kernel profile.
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Chronicle from Go

> **Experimental v0:** Chronicle.Go **v0.9.1**, verified kernel profile
> **Chronicle 19.32.3**. Companion guidance targets Arc.Go **v0.1.1** and
> Fundamentals.Go **v0.3.2**. Minor releases may break APIs.

This is a standalone event-store client, not an Arc HTTP framework. Use explicit
registration rather than C# attributes or assembly discovery. Events are immutable
facts represented by named structs; event-source identity is append metadata,
not an event payload property.

## Verified product sources

| Product | Tag | Source checked |
| --- | --- | --- |
| Chronicle.Go (`github.com/cratis/chronicle.go`) | `v0.9.1` | `client.go`, `options.go`, `options_transport.go`, `registry.go`, `registry_projections.go`, `registry_readmodels.go`, `registry_reactors.go`, `eventsequences/sequence.go`, `internal/decision/decision.go`, `captures/service.go`, `captures/redaction.go`, `examples/getting-started/main.go`, `examples/projections/main.go` |

[Source at v0.9.1](https://github.com/Cratis/Chronicle.Go/tree/v0.9.1)
and its [parity ledger](https://github.com/Cratis/Chronicle.Go/blob/v0.9.1/Documentation/parity.md)
qualify supported behavior. The README's older statement that observers,
projections and automatic lifecycle recovery are absent is stale; those surfaces
exist, but that does **not** mean whole-product parity.

## Register and append

Install `github.com/cratis/chronicle.go@v0.9.1` in a consumer module. This complete
package appends one event using **local development** defaults:

```go
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

package customers

import (
	"context"
	"errors"

	chronicle "github.com/cratis/chronicle.go"
	"github.com/cratis/chronicle.go/events"
)

// CustomerRegistered records a customer's display name.
type CustomerRegistered struct {
	Name string `json:"name"`
}

// AppendCustomer uses a caller-bounded context and closes its owned client.
func AppendCustomer(ctx context.Context) (err error) {
	registry := chronicle.NewRegistry()
	if _, err = chronicle.RegisterEvent[CustomerRegistered](registry,
		events.WithID("customer-registered")); err != nil {
		return err
	}
	client, err := chronicle.NewClient(
		chronicle.WithDevelopmentDefaults(), chronicle.WithRegistry(registry))
	if err != nil {
		return err
	}
	defer func() { err = errors.Join(err, client.Close()) }()
	store, err := client.EventStore(ctx, "customers")
	if err != nil {
		return err
	}
	result, err := store.EventLog().Append(ctx, "customer-42",
		CustomerRegistered{Name: "Ada"})
	if err != nil {
		return err // The write may have committed. Do not blindly retry.
	}
	return result.Err()
}
```

Registration errors and append outcomes are not optional checks. `Append` returns
both a transport error and a result; after transport success, `result.Err()` can
still report a rejection. A timeout/disconnect may hide a commit. Choose explicit
concurrency/idempotency semantics before retrying, never a generic write retry.
Use stable persisted event IDs and explicit `json` names for cross-language data.

For a runnable program and its observable append position, use the tagged
[getting-started example](https://github.com/Cratis/Chronicle.Go/blob/v0.9.1/examples/getting-started/main.go).
This compileable package does not itself start a kernel or prove a successful append.

## Connection and gRPC ownership

- `NewClient` validates and freezes declarations without network I/O; it does
  not prove readiness. `Dial(ctx, options...)` also connects. Complete all
  registrations before construction; later changes do not mutate that client.
- `WithDevelopmentDefaults` relaxes TLS certificate verification for development;
  it is not a certificate whitelist. Production needs validated TLS and explicit
  production credentials. `WithTLS` accepts TLS configuration; never use dev
  defaults as a production fix for a failed certificate.
- `WithGRPCConnection` borrows a `grpc.ClientConn`; the caller owns and closes it.
  Follow the option's explicit-authentication requirement. Close the Chronicle
  client before its borrowed collaborators. Owned connections belong to the client.
- `Close` cancels and joins owned work. Handlers must honor cancellation;
  a bounded `CloseContext` timeout means cleanup is incomplete, not successful.
  Keep short unary deadlines separate from long-lived subscriptions.
- `WithOnConnected`, `WithOnDisconnected` and `WithLoadBalancer` are explicit
  lifecycle customization points. `WithGRPCStatsHandler` borrows concurrent-safe,
  promptly returning callbacks for owned connections; it conflicts with a borrowed
  connection and does not authorize interceptors or retries.
- For SDK contributors, generate protobuf contracts only from the authoritative
  inputs using the repository's pinned Buf recipe. Preserve metadata, field numbers,
  deadlines and checkpoint boundaries; never hand-edit generated contracts.

## Read models and side effects

Read [projection registration](references/projections.md) when populating a read
model. Start with model-bound tags; use the fluent builder when that cannot express
it, then a reducer for genuinely procedural state decisions. Do not mix model-bound
mapping tags and fluent mappings for the same declaration.

`RegisterReactorHandler(registry, id, func(context.Context, E) error)` registers a
typed closure for a registered event. `RegisterReactor` explicitly registers a type;
its exported methods select events by parameter type, not by handler name. Optional
leading context and `reactors.Delivery` parameters carry cancellation and delivery
identity. `delivery.ID()` can key an external idempotency record; it is not an
exactly-once guarantee. Return supported follow-up events rather than manually
recreating effect dispatch; use projections for materialization, reactors for effects.

`reactors.OnceOnly` excludes replay; it does **not** deduplicate failed-partition
recovery. Effects may repeat after errors, cleanup failures or reconnect. Keep them
idempotent. The kernel owns recovery/quarantine and progress; do not invent resume
positions or acknowledge before successful processing and cleanup. Read the tagged
[reactor guide](https://github.com/Cratis/Chronicle.Go/blob/v0.9.1/Documentation/reactors.md)
for exact effect, replay and registration-readiness limits.

## Unsupported does not mean success

Decision guards require the verified 19.32.3 profile and compatibility preflight;
unsupported kernels return `ErrUnsupported`. Protected operations have their own
19.32.x capability gates; this release supports qualified protected revisions and
classified read-model replay routes, not every protected watch/profile.
Do not use the deprecated `readmodels.DecisionProtectedModel` or
`DecisionProtectionMetadata` compatibility hooks for new work.

Webhook source authorization cannot travel through the CDL-only capture transport.
`Save`/`Validate` refuse it with `ErrUnsupported` before dispatch. Capture credential
JSON import/export is also refused. Never serialize or log webhook credentials or
pretend a rejected configuration was applied.

## Verify

- Compile against the released module without workspace/local replacements.
- Test rejection separately from transport error and ambiguous commit recovery.
- Use `chronicletest` scenarios for event/read-model contracts within their supported
  profiles; pure decisions can use standard `testing` directly.
- Exercise registration, cancellation, reconnect, borrowed connections and joined
  cleanup against the pinned kernel before claiming runtime parity.
- Chronicle.Go v0.9.1 requires Fundamentals.Go v0.1.0; the separate concepts skill's
  v0.3.2 pin is not a required dependency upgrade.
