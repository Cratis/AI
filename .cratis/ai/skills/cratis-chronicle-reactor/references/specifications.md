## Specifications

Start with `Specification` plus a direct call for pure reactor decisions,
passing the trigger and supplied values explicitly and asserting the returned
command or event. Add `ReactorScenario<TReactor>` only where invocation,
dependency wiring or side effects contribute proof. In those scenarios, drive
events with a service provider of substitutes and assert on the substitutes for
non-event side effects; for handlers that return events, assert the resulting
appends through the scenario's event store. Cover the replay path separately
when the reactor has `[OnceOnly]` or `[Replay]` handlers.

Specify the contract, not only the happy path:

- **Field lineage.** For each returned command or event, a specification asserts
  every field value against the trigger event, the injected read model, or the
  mapping the contract states. Use distinct values per source so a swapped or
  defaulted field fails.
- **Contract-authorized filtering.** A reactor skips an event only for a
  condition the contract states. Give each stated condition a specification
  that shows the skip, and one showing the neighbouring case that does act. Do
  not add a skip nobody specified.
- **Repeated delivery.** Recovery re-delivers the same event even with
  `[OnceOnly]`, so specify what the reactor does the second time (one effect, an
  idempotent write, or a receipt keyed by `ReactorDelivery`). The scenario gives
  every event it delivers its own sequence number, so firing the same event twice
  through `Given` is two deliveries, not a re-delivery; to prove the
  re-delivery guard, call the handler twice with the same `ReactorDelivery`, or
  assert it on the collaborator that holds the receipt.
- **Unrelated events.** `WithStrictEventSubscription()` belongs to
  `ReadModelScenario<T>` and only fails a specification that *seeds* an event the
  projection does not subscribe to; it does not prove a subscription set, and
  `ReactorScenario<T>` has no equivalent. For a reactor, show with a
  specification that an event outside its handlers causes no effect.
