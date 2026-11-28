# Name the identity that owns the events

For a Chronicle-backed Arc command use a concept module for the key:

```elixir
defmodule Library.Authors.AuthorId do
  use Cratis.Chronicle.Concept, type: :uuid, event_source_id: true
end
```

Use the module as the type of the command schema's key field. Keep changeable names on the event, never in the immutable event source ID.
