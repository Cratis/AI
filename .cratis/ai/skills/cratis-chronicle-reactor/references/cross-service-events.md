# Cross-service events

This reference holds the outbox and inbox routing for cross-service facts.

### Cross-service events

Cross-service facts route through the outbox and inbox rather than a shared log.
The producer appends its public contract event to the outbox sequence; the
consuming observer listens on the implicit inbox sequence for the source store.
Chronicle creates or reuses that subscription from the observer's `[EventStore]`
metadata, or from `[EventStore]` on the event type or its assembly. Put
`[assembly: EventStore("<source-store>")]` in a contracts project when every
event there originates from one service.
