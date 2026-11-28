# Register the Kotlin notification

With the event registered, annotate the class `@Reactor(id = "order-notifications")` and add a typed method such as `fun orderPlaced(event: OrderPlaced, context: EventContext)`. For a live-only notification, choose `@StartAtTail` for the initial position and `@OnceOnly` for replay exclusion. Do not rotate the observer ID for routine deployments.

Scope the receiver's receipt to this observer, store, namespace, event sequence, source, `context.sequenceNumber` and effect. Sequence number alone collides across scopes. Test a retry after the receiver has accepted the notification: returning successfully must not send a second one. Cancellation or failure must not be reported as successful delivery.

For batched delivery, use `EventBatch` as the first parameter and repeat `@Observes` for each event type. Route failures and deferrals using the affected entry, not a batch-wide assumption. Per-event dispatch is based on the event parameter. Returning registered events as a list appends the event effects as one atomic batch; use `EventForEventSourceId` to route an effect explicitly. That atomicity never includes a remote gateway.
