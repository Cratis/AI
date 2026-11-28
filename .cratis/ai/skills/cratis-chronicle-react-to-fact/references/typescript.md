# Bind the Node handler explicitly

Decorate the class with `@reactor()` and the method with `@handles(OrderPlaced)`, with `OrderPlaced` registered. Without `@handles`, discovery lowercases only the first character of the event class name and leaves the rest unchanged (`URLChanged` → `uRLChanged`). TypeScript parameter annotations do not register a handler. To supply a receipt, accept `(event: OrderPlaced, context: EventContext, services: ReactorServices, delivery: ReactorDelivery)` and pass `delivery.id` plus a stable effect label to the receiver.

For new notifications only, put `@startAtTail()` on the class and `@onceOnly()` on the live effect method. If the reactor also needs to rebuild state, import `replay` from `@cratis/chronicle` and add a separate method inside the reactor class, where `rebuildState` is the application's state-only operation:

```ts
@replay(OrderPlaced)
async restoreOrder(event: OrderPlaced) {
    await this.rebuildState(event);
}
```

Do not call the live gateway from the replay handler. Force one failure after the gateway accepts the live request. The retry must present the same key, not generate a new one.
