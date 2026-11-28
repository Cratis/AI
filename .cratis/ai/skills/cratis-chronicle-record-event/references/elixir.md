# Inspect the detailed Elixir result

In the event module declare `use Cratis.Chronicle.Events.EventType, id: "author-registered"` and `defstruct [:name]`. Use `Cratis.Chronicle.EventSequences.EventLog.append_with_result(author_id, %AuthorRegistered{name: name}, opts)` in the intended client and namespace. On `{:ok, result}` retain the position. For `{:error, result}` inspect structured constraint or concurrency violations when present; a transport error is not a confirmed refusal.

`append` gives the ordinary success/error tuple. When the request really depends on observer progress, use `append_and_wait_for_completion` and inspect completion separately from acceptance. `variant_of` and `enters_on` describe read-model membership; do not use a variant name as the source ID of the append.
