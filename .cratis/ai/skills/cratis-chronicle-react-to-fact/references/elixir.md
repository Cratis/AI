# Match the registered Elixir event

For a future-only notification, declare `use Cratis.Chronicle.Reactors.Reactor, start_at_tail: true, once_only: true`. Add `@handles OrderPlaced` before the handler and pattern-match `def handle(%OrderPlaced{} = event, context)`. The handler can pass `context.delivery_id` to the receiver; scope distinct effects separately. Return `:ok` only after the receiver accepts the operation. A GenServer restart must not discard the receiver's receipt.

To verify, deliver the same order twice and inspect the durable receiver, not the number of callback entries. `once_only` controls replay; it is not a guarantee that the callback executes once during normal delivery.

If the input is actually an external snapshot rather than a committed event, consider a capture instead. The kernel supports `api` and `events` sources with root-level `append` rules; do not rely on nested, map or child scopes executing. Confirm the resulting event, not just a client definition.
