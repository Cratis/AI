# Read and stage the Elixir decision in the same process

For a registered `Seat` projection keyed by seat ID, use the same client and namespace options throughout:

```elixir
alias Cratis.Chronicle.EventSequences.EventLog
alias Cratis.Chronicle.ReadModels.DecisionReads

Cratis.Chronicle.decide(fn _unit ->
  case DecisionReads.get(Seat, seat_id, opts) do
    {:ok, %{instance: nil}} -> EventLog.append(seat_id, %SeatBooked{by: borrower}, opts)
    {:ok, _occupied} -> {:error, :already_booked}
    {:error, reason} -> {:error, reason}
  end
end, opts)
```

Use the result of `decide`, not the buffered append, to decide whether the booking succeeded. `get` requires a unit of work; a detached lookup alone does not protect the later append. Race a booking from a separate process before commit and require a decision conflict rather than two successful reservations.

## Admit the model before using it

Decision reads require `cratis_chronicle` 3.13.0 or later. `DecisionReads.admit/2` and `admit_for_stream/2` check the shape without I/O and return `{:ok, event_types}` or `{:error, reason}`. A passive reducer (`active: false`) can be admitted; an active one cannot. `get` and `get_detached` raise `DecisionReadRefused` for a refused shape: fix the declaration instead of treating it as a race. Diagnose `:reducer`, `:join`, `:hierarchy`, `:not_event_log`, `:open_ended_event_types`, `:no_event_types`, `:not_event_source_keyed` and `:unsupported_event_type_id` from the shape. A read can also refuse with `:all_streams_not_supported`, `:stream_scope_not_supported` or `:fold_incomplete`. A racing commit instead returns `{:error, %DecisionConflict{}}` from `decide/2`; re-read and decide again.

## Protect an explicit tail

Use `ConcurrencyScope.at_tail/2` for a named scope, or `ConcurrencyScope.expecting_no_matching_event(event_source_id: true, event_types: [SeatBooked])` for a known-first write (`cratis_chronicle` 3.11.0+). Leaving the sequence number unset turns the check off; it does not assert absence.

## Choose the default optimistic strategy

`concurrency: [default: :optimistic, check_first_append: true]` on the client checks the routed tail for appends without an explicit or definition-derived scope. Set `check_first_append: true` to protect an empty scope too. Two unequal explicit scopes for one source in a batch fail with `{:error, {:duplicate_concurrency_scope, id}}`. Do not discard a predicate to make the append work.
