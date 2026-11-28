# Read and stage the Elixir decision in the same process

For a registered `Seat` projection keyed by seat ID, use the same client and namespace options throughout:

```elixir
Cratis.Chronicle.decide(fn _unit ->
  case DecisionReads.get(Seat, seat_id, opts) do
    {:ok, %{instance: nil}} -> EventLog.append(seat_id, %SeatBooked{by: borrower}, opts)
    {:ok, _occupied} -> {:error, :already_booked}
    {:error, reason} -> {:error, reason}
  end
end, opts)
```

Here `DecisionReads` and `EventLog` are the application's aliases for the read-model and event-log modules. Use the result of `decide`, not the buffered append, to decide whether the booking succeeded. `get` requires a unit of work; a detached lookup alone does not protect the later append. Race a booking from a separate process before commit and require a decision conflict rather than two successful reservations.
