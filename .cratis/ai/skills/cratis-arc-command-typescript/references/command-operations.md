<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Inline command operations and aggregate decisions

## Contents

- Several business outcomes
- Declare work, do not execute it twice
- Recovery follows commit facts
- Chronicle aggregates (experimental)

Source: `Cratis/Arc.TypeScript` (source preview, not on npm):
`Source/Core/commands/CommandOperation.ts`, operation execution/recovery code,
`Source/Chronicle/ChronicleCommandScope.ts`, `commandAggregate.ts`,
`Documentation/commands/operations/reference.md`, and
`Documentation/chronicle/aggregates/**`.

## Several business outcomes

Proxy generation accepts alternatives resolving to the same client type:
literal unions retain their type; distinct concepts may fall back to their shared
primitive. Different client types, even identical-shaped DTO classes, fail
generation: use one response DTO with a status field. A .NET-style arbitrary
Result error DTO is ordinary response data, not rejection; use `response(...)`
for data and `rejected(...)`/`denied(...)` for failures.

## Declare work, do not execute it twice

Extend `CommandOperation` from `@cratis/arc.core`. Return an instance from
`handle()`; a direct call only returns the declaration. Arc executes it in the
pipeline, never sends it to the client. Use `operations(first, second)` for an
explicit sequential batch — a plain array is not a batch. Combine with one
client response using `tuple(response(value), operation)`.

```typescript
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { CommandOperation, command, response, tuple } from '@cratis/arc.core';

// In-memory demonstration, not a durable external-effect implementation.
const calls: string[] = [];
class Notify extends CommandOperation {
    execute(signal: AbortSignal): void {
        signal.throwIfAborted();
        calls.push('notify');
    }
    compensate(_failure: unknown, signal: AbortSignal): void {
        signal.throwIfAborted();
        calls.push('undo notification');
    }
}

@command()
export class SendNotification {
    handle() { return tuple(response('declared'), new Notify()); }
}
```

`executeDependencies` / `compensateDependencies` are service-token arrays;
Arc resolves dependencies before starting any operation and passes them after
the signal (after `failure, signal` for compensation). Do not call the same write
in `handle()` as well as returning the operation.

## Recovery follows commit facts

Arc records entry **before** calling execute, completes scopes before deciding
recovery, and compensates entered operations in reverse order, including one
that threw. The separate cooperative `commandCompensationTimeoutMs` budget
(default 30,000 ms) is shared by compensations, not the cancelled request signal.
A callback ignoring its signal cannot be forcibly stopped; late completion is
`BudgetExpired`.

| `CommandCommitDisposition` | Compensation after failure |
| --- | --- |
| `NoCommit`, `NotCommitted` | Attempt |
| `Committed` | Suppress |
| `Unknown`, `Mixed` | Do not guess: indeterminate recovery, not success |

Direct-call `result.recovery` / `operationOutcomes` describe execution and
recovery; they are not serialized to HTTP. `CommandScenario` results offer
`shouldHaveExecutedOperation(Type)`, `shouldHaveCompensatedOperation(Type)`,
`shouldHaveNoOperationInvocations()`, and `shouldHaveIndeterminateRecovery()`.
Specify success, throwing/partially-entered operations, cancellation, compensation
failure/budget expiry, and unknown commit facts.

With Chronicle, `tuple(event, operation)` stages the event, executes the operation,
then completes the append scope before deciding compensation. Known append
rejection compensates; unknown/partial acknowledgment does not claim rollback.
The tagged `Documentation/commands/operations/index.md` still says events and
operations cannot combine; `ChronicleCommandScope.ts` and the live integration
specs establish the supported combination at this tag.

There is no distributed transaction, automatic retry, durable recovery journal
or crash recovery. Compensation success is not proof an external effect was
undone. After-commit durable work belongs in an idempotent reactor/outbox/workflow.

## Chronicle aggregates (experimental)

`AggregateRoot` and `commandAggregate` come from `@cratis/arc.chronicle`.
Bind `@inject(commandAggregate(Order))` to an `Order` extending AggregateRoot.
Arc rehydrates the command's **explicit key**, in the tenant namespace and the
command's source/stream route. No key fails before handle; loading another id is
not supported. Each aggregate type loads once per command.

`apply(event)` stages events in the command's batch; a successful command appends
them even when handle returns nothing. `return order.commit()` is optional;
never return the same event again. Rejection discards staged events. The route's
tail is captured at load and appended as an exact concurrency scope; another
append to the route rejects the entire batch. Projection reads may lag this
rehydrated state. Use ChronicleKernelScenario for aggregate/concurrency specs,
not the in-memory scenario. Registered event-source-definition routing for Arc
commands/aggregates is **not** supported.
