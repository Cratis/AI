# Inspect the detailed Elixir result

In the event module declare `use Cratis.Chronicle.Events.EventType, id: "author-registered"` and `defstruct [:name]`. Register the event in the intended store. For a standalone write, pass the client and namespace in `opts` and use `Cratis.Chronicle.EventSequences.EventLog.append_with_result(author_id, %AuthorRegistered{name: name}, opts)`. On `{:ok, result}` retain `result.sequence_number`. For `{:error, result}` inspect structured constraint or concurrency violations when present; a transport error is not a confirmed refusal.

When a standalone write really depends on observer progress, use `EventLog.append_and_wait_for_completion/3`. On `{:ok, completion}`, check `completion.success` separately from append acceptance. Do not repeat an append just because the wait failed.

Both helpers send directly and bypass any active unit of work. Inside `Cratis.Chronicle.decide/2`, use `EventLog.append/3` instead. Its `:ok` means the event was buffered, not committed. Return any append error from the decision callback and report success only from the outer `decide/2` result `{:ok, _}`.

[`variant_of` and `enters_on`](../../cratis-chronicle-project-view/references/elixir.md#variants) describe read-model membership; do not use a variant name as the source ID of the append.

## Append through a declared event source

With `cratis_chronicle` 3.10.0 and kernel 19.30.0 or later, declare and include this module in `event_sources: [AccountEventSource]`:

```elixir
defmodule AccountEventSource do
  use Cratis.Chronicle.EventSources.EventSource, name: "Account"
  stream "Transactions", concurrency: [:event_source_id, :event_stream_id]
end
```

In a multi-source batch, put the definition on each routed entry; batch defaults apply to entries without a source:

```elixir
alias Cratis.Chronicle.EventSequences.{EventForEventSourceId, EventLog}

EventLog.append_many_for_event_sources([
  %EventForEventSourceId{event_source_id: account_id, event: deposited,
    event_source: AccountEventSource, event_stream: "Transactions", event_stream_id: month}
], opts)
```

The named stream is validated. A contradictory explicit route refuses the whole operation, including a batch with otherwise valid entries. The declared dimensions narrow the tail that is read and checked unless you supply an explicit concurrency scope. Verify both routing and atomic refusal against the target kernel.
