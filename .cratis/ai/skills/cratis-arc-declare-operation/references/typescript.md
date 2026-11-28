# Return provider work from a Node command

In the server package using `@cratis/arc.core`, extend `CommandOperation`. Here `seats` is an application-owned provider accepting an ID and a cancellation signal:

```ts
class ReserveSeat extends CommandOperation {
    constructor(readonly id: string) { super(); }
    execute(signal: AbortSignal) { return seats.reserve(this.id, signal); }
    compensate(_failure: unknown, signal: AbortSignal) {
        return seats.cancelOwned(this.id, signal);
    }
}
```

Return `tuple(input.id, new ReserveSeat(input.id))` from the command handler. Constructing the tuple must not contact the provider. Exercise the server pipeline with a provider that accepts the reservation then fails: when nothing committed, cancellation should receive the same ID. An unknown commit needs reconciliation, not unconditional compensation. Keep the declaration on the server; a proxy call cannot enroll browser work in the pipeline.
