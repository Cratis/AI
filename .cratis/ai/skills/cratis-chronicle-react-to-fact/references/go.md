# Register the Go factory and preserve delivery identity

Register the input and any returned event with `chronicle.RegisterEvent`. Register the reactor using `chronicle.RegisterReactor[*ConfirmOrders](registry, factory, reactors.WithID("confirm-orders"), reactors.OnceOnly("Reserve"))`. The factory returns the receiver with its gateway; the handler's event parameter selects its input, not the method name.

A method receiving `(ctx context.Context, event OrderPlaced, delivery reactors.Delivery)` can call the gateway with `delivery.ID()` and return `(OrderConfirmed, error)`. Return the error on failure rather than producing a success event. Add `reactors.StartAtTail()` at registration if a new observer must ignore existing orders. Keep the gateway's receipt across retries and do not redo an irreversible effect in a replay handler.
