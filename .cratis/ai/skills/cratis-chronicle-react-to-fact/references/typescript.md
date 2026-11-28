# Bind the Node handler explicitly

Decorate the class with `@reactor()` and the method with `@handles(OrderPlaced)`, with `OrderPlaced` registered. Without `@handles`, the method name must be the exact camelCase of the event class name; TypeScript parameter annotations do not register a handler. To supply a receipt, accept `(event: OrderPlaced, context: EventContext, services: ReactorServices, delivery: ReactorDelivery)` and pass `delivery.id` plus a stable effect label to the receiver.

For new notifications only, put `@startAtTail()` on the class and `@onceOnly()` on the live effect method. If rebuilding state, use a separate replay handler and do not call the live gateway from it. Force one failure after the gateway accepts the request. The retry must present the same key, not generate a new one.
