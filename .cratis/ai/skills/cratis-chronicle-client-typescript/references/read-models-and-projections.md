## Read models and projections

`store.readModels` — `Source/readModels/IReadModels.ts`: `getInstanceById(type, key, sessionId?)`
(`:38`), `getInstances(type, eventCount?)` (`:46`), `getSnapshotsById` (`:54`),
`watch(type): AsyncIterable<ReadModelChangeset<T>>` (`:61`), plus `materialized`
for paged access.

Two projection styles:

- **Model-bound** — decorators on the read model, from
  `@cratis/chronicle/projections`: `fromEvent`, `fromEvery`, `fromAll`, `setFrom`,
  `setFromContext`, `setValue`, `join`, `addFrom`, `subtractFrom`, `increment`,
  `decrement`, `count`, `childrenFrom`, `nested`, `clearWith`, `removedWith`,
  `removedWithJoin`, `noAutoMap`, `notRewindable`, `passive`.
- **Declarative** — `@projection(id?, readModelType?, eventSequenceId?)` on a class
  implementing `IProjectionFor<TReadModel>` with
  `define(builder: IProjectionBuilderFor<TReadModel>): void`.

Constraints are `@constraint()` on a class implementing `IConstraint` with a
`define(builder)`; the builder gives `unique(...)`, `uniqueFor(...)`,
`perEventSourceType`, `perEventStreamType`, `perEventStreamId`. **There are no
model-bound constraint decorators in this client** — the class-plus-builder form
is the only one.
