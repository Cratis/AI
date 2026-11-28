# Bind the Node command handler

Export a `@command()` class from the feature. Describe input properties with `@field` and keep injected services on the handler signature. `TaskId`, `TaskTitle` and the `Tasks` service are your application's types:

```typescript
import { command } from '@cratis/arc.core';
import { field } from '@cratis/fundamentals';

@command()
export class RegisterTask {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    handle(tasks: Tasks): TaskId {
        tasks.register(this.id, this.title);
        return this.id;
    }
}
```

Register the service and load current generated metadata, or supply explicit binding descriptors. TypeScript erases parameter types. Build the host to detect unbound dependencies; explicit descriptors take precedence over generated inference. For an event-producing handler return the fact to the configured Chronicle integration and check that the owning ID's history contains it once.

When observers must see an append before the reply, `completionTimeoutMs` bounds the wait for every observer. A timeout can follow a committed append: do not repeat a non-idempotent command to fix a slow observer. Compensation has its own cooperative `commandCompensationTimeoutMs`; it does not revert a committed event. Use `eventSourceIdResponse` when the response is the history ID rather than the event itself.

## Prepare inputs on the command instance

An optional `provide()` runs on the same command instance after authorization and validation, before `handle()`. A plain return value is the first `handle()` argument, before injected services. For several prepared values, return `tuple(a, b)` and bind each handler parameter explicitly: `@inject(provided(A), commandContext(), provided(B))` supplies the two prepared instances by runtime type and the context between them. Use service tokens for injected services. On a command, use `@inject` only on `provide()` or `handle()`; the preparation method itself cannot consume a `provided(...)` token.

Return `rejected(validation(...))` from `provide()` when the prepared record is missing: the caller receives 400 and `handle()` is not called. Prove both outcomes in the spec. Hand off severity and rejection details to “Reject from `provide()` or `handle()`” in `cratis-arc-validation-typescript`.

## Route and protect returned events

Return `eventForEventSourceId({ eventSourceId: otherId, event })` when an event belongs to a nondefault history. For a decision involving two histories, keep the exact server-observed `bigint` positions with the decision reads and return one scoped batch; do not sample the tails after `handle()`.

```ts
import { eventForEventSourceId, eventsWithConcurrencyScopes } from '@cratis/arc.chronicle';

// From handle(), after deciding from the two observed histories:
return eventsWithConcurrencyScopes([
    eventForEventSourceId({ eventSourceId: originalId, event: originalEvent }),
    eventForEventSourceId({ eventSourceId: otherId, event: otherEvent }),
], {
    [originalId]: { eventSourceId: true, sequenceNumber: observedOriginalPosition },
    [otherId]: { eventSourceId: true, sequenceNumber: observedOtherPosition },
});
```

Use `cratis-chronicle-protect-decision` for the design. With `ChronicleKernelScenario`, advance a guarded history after observation and assert that the stale-position refusal appends nothing from the batch to either history.
