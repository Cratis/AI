# Declare the Elixir constraint module

Use `Cratis.Chronicle.Events.Constraint` in the module. Within `unique name: "UniqueProjectName" do`, declare `on ProjectCreated, [:name]` and `removed_with ProjectRemoved`. Load both event modules and the constraint with the supervised application. Inspect the detailed append result for the named violation; a local name lookup is not the reservation.

Use `unique_event_type` for a once-per-source event, not a globally unique property. Choose whether replacing a value releases its old claim or retains it; declare a `remove_constraint` on the releasing event if appropriate. `closes_stream` closes a scope rather than reserving a value. Restrict the scope before racing appenders and inspect the specific violation, not just `{:error, _}`.
