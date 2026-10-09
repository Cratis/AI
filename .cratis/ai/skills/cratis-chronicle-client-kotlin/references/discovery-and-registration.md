## Discovery and registration

`ClientArtifacts` scans the classpath with ClassGraph
(`artifacts/ClientArtifacts.kt:66-98`), and `ClientArtifacts.default` is a
process-wide lazy singleton (`:156`). What it looks for (`:66-98`):

| Kind | Rule |
| --- | --- |
| event types | `@EventType` |
| event type migrations | implements `IEventTypeMigration` |
| read models | `@ReadModel` |
| declarative projections | implements `IProjectionFor` |
| model-bound projections | `@FromEvent` **and** the synthetic `FromEvent$Container` |
| reactors | `@Reactor` |
| reducers | `@Reducer` |
| constraints | implements `IConstraint` |
| seeders | implements `ICanSeedEvents` |
| webhooks | implements `IWebhookDefiner` |
| captures | implements `ICapture` |
| reactor middlewares | implements `IReactorMiddleware` or `BlockingReactorMiddleware` |
| reactor argument resolvers | implements `IReactorMethodArgumentResolver` or `BlockingReactorMethodArgumentResolver` |

> The `FromEvent$Container` entry is not incidental: Kotlin's `@Repeatable`
> replaces repeated annotations with a synthetic container, so a class carrying
> more than one `@FromEvent` is **not** annotated with `@FromEvent` at runtime.
> A scan that looks only for the annotation silently misses every multi-event
> projection.

Registration order is fixed and matters
(`artifacts/ArtifactRegistrations.kt:59-91`): event types and migrations →
unowned read models → constraints → model-bound constraints → projections →
webhooks → reactors → reducers → captures → seeders. Reactors and reducers are
started only on the first pass (`:78-82`).

**Registration re-runs on every reconnect.** `EventStore.kt:226-241` launches a
coroutine on `Dispatchers.IO` collecting the connection lifecycle and
re-registers each time. The connection id rotates on every disconnect because
the kernel keys observer subscriptions by it
(`connection/ConnectionLifecycle.kt:24-32`), so observers must re-register — and
they do.

`store.awaitRegistration()` (`IEventStore.kt:92`) waits for the first pass.
`store.registerAll()` (`:83`) runs it by hand when
`autoDiscoverAndRegister = false`.
