# Inspect the detailed Elixir result

In the event module declare `use Cratis.Chronicle.Events.EventType, id: "author-registered"` and `defstruct [:name]`. Register the event in the intended store. For a standalone write, pass the client and namespace in `opts` and use `Cratis.Chronicle.EventSequences.EventLog.append_with_result(author_id, %AuthorRegistered{name: name}, opts)`. On `{:ok, result}` retain `result.sequence_number`. For `{:error, result}` inspect structured constraint or concurrency violations when present; a transport error is not a confirmed refusal.

When a standalone write really depends on observer progress, use `EventLog.append_and_wait_for_completion/3`. On `{:ok, completion}`, check `completion.success` separately from append acceptance. Do not repeat an append just because the wait failed.

Both helpers send directly and bypass any active unit of work. Inside `Cratis.Chronicle.decide/2`, use `EventLog.append/3` instead. Its `:ok` means the event was buffered, not committed. Return any append error from the decision callback and report success only from the outer `decide/2` result `{:ok, _}`.

`variant_of` and `enters_on` describe read-model membership; do not use a variant name as the source ID of the append.
