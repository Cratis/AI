# Chronicle boundaries

Read when consistency, tenancy or personal data decides where a boundary falls. These are
target facts; the `.play` model declares only part of them (`versions.md` in
`cratis-screenplay-toolchain`).

## Pins
Chronicle **v19.32.0** (`f17a2ff`): CHR0012 (nullable event properties) and CHR0034 (PII on an
event-source id) are present. Three runtime defects are **open at v19.32.0**: #3744 (SQL and
InMemory providers do not settle unique claims), #4123 (constraint index updates run after commit
and fail silently) and #4131 (composite unique constraints collide when a component contains the
separator). Arc **v22.50.5** has `[ProtectedDecision]` (since v22.39.0, needs Chronicle 19.23 or
later); Stage-rendered apps pin Arc 22.25.0 and Chronicle client 19.8.1, so it is not available
there (see `consistency-and-concurrency.md` section 3). Re-check the issues before relying on a
constraint in a new release.
A concurrency scope's first append is unchecked by default at v19.32.0; see
`consistency-and-concurrency.md` section 4.

## Identity, routing and claims
Name four things separately: the event store/namespace, the business event-source identity, any
process streams that route work, and the scope of each invariant. Use source/stream
classification to separate genuinely independent work inside one identity; do not split a
business identity just to reduce contention. Tags classify occurrences; they do not isolate
tenants.

A value constraint protects a claim across sources within its configured scope; an event-type
constraint protects one occurrence per source. List every event that claims, changes or
releases the value, including correction and import paths. Post-commit index maintenance is not
atomic durability (Chronicle#4123); composite separator collisions are tracked in #4131; the
SQL and InMemory providers do not settle unique claims (Chronicle#3744).

## State used for decisions
Materialized views may lag. A passive read folds events on demand but does not protect the
interval between reading and appending. A guarded decision read adds that protection for an
admitted projection and key shape (including absence) when the dependency is enrolled in the
same protected commit. Name the actual target mechanism and deployment assumptions; do not
invent guards from sequence numbers, and do not assume joins, reducers, other namespaces or
external services qualify. Current `reads`/`concurrency` declarations supply no such runtime
protection: keep the invariant and its race outcome as explicit target requirements.

## Tenancy and personal data
A namespace scopes event positions, claims, observer progress and encryption keys. State
whether uniqueness and completion are per tenant or genuinely cross-tenant.

Decide the data subject before the event and view shape. One data subject per event and per
stream; one per read-model instance. Never put PII on the event-source id and never mark the
identifier's concept `@pii` or `@sensitive`: Chronicle cannot encrypt a source id (analyzers CHR0034 and CHR0052; Screenplay reports PLAY0515). Use a surrogate `Uuid`
identity and carry the value as a `@pii` property (personal data) or a `@sensitive` property (operational secret). Bearer tokens, magic links and
signed URLs are never facts; record a keyed hash or a reference.

Redaction (payload replacement keeping the sequence slot) and crypto-erasure serve compliance
only; they are asynchronous, namespace-local and do not erase external copies. Model erasure as
an owned workflow, not as a flag or a claim that history is undeletable. Domain correction is a
new fact.
