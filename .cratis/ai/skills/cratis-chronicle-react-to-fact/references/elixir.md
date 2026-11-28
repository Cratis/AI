# Match the registered Elixir event

For a future-only notification, declare `use Cratis.Chronicle.Reactors.Reactor, start_at_tail: true, once_only: true`. Add `@handles OrderPlaced` before the handler and pattern-match `def handle(%OrderPlaced{} = event, context)`. The handler can pass `context.delivery_id` to the receiver; scope distinct effects separately. Return `:ok` only after the receiver accepts the operation. A GenServer restart must not discard the receiver's receipt.

To verify, deliver the same order twice and inspect the durable receiver, not the number of callback entries. `once_only` controls replay; it is not a guarantee that the callback executes once during normal delivery.

## Capture external changes

For an external snapshot use `Cratis.Chronicle.Captures.Capture` with a pinned `id:`; the default is derived from the full module name, so a rename can otherwise register another capture. Use one `api_source` or `events_source` with root-level `append` rules; do not rely on nested, map or child scopes executing. `key/1` selects the stable item property used to diff successive snapshots; for events use `key("$eventSourceId")`. Set `when:` to a changed property path, `:added` or `:removed` as appropriate; keep the target event's registered ID uppercase-initial with letters, digits and underscores so the declaration can name it.

Add the module to the client's `captures:` or discover it with `otp_app:`. The registrar skips an unchanged declaration, but saving a changed running capture stops it. Declare `start: true` if this client should start it after saving. Verify the expected emitted events (and no duplicate for an unchanged snapshot) after registration and reconnect.

## Query mined behavior

Call `Cratis.Chronicle.Patterns.get_patterns_at(scope, moment, opts)` for the intended grouping key and time. Day and time bucket are derived from the moment's own offset, not UTC. An empty result is valid: return no established pattern, not a prediction.
