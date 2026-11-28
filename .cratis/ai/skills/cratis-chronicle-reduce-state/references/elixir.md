# Return the next Elixir struct

Use `Cratis.Chronicle.Reducers.Reducer, model: Balance` and declare `@handles CreditPosted`. In `reduce(%CreditPosted{} = event, previous, context)`, initialize a missing balance then return the new struct with `id: context.event_source_id` and the new total. Handle other event structs with separate clauses. Fetching current external balances in `reduce/3` makes replay nondeterministic.
