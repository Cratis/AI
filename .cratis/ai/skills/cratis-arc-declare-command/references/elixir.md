# Return the command decision in Elixir

Use one module per command. Name the field that owns the history in the schema; for a UUID event source, use a Chronicle UUID concept with `event_source_id: true`.

```elixir
defmodule Library.Authors.RegisterAuthor do
  use Cratis.Arc.Command

  schema do
    field :id, Library.Authors.AuthorId, key: true, required: true
    field :name, :string, required: true
  end

  def handle(%__MODULE__{name: name}, _ctx),
    do: {:append, %Library.Authors.AuthorRegistered{name: name}}
end
```

Validate before making decision reads. When state is required, load it in the provision step before `handle/2`, not again during the append. Return `{:ok, response}` for a response without an append. For an event, return `{:append, event}` and let Arc append it to the key's history.
