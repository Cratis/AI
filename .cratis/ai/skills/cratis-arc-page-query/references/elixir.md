# Page a MongoDB query in Elixir

With `arc_mongodb` configured and the `Book` model registered, pass the query context along with the model. The helper reads the caller's page and sort from the context and counts the same filter it sends to the collection.

```elixir
def books(_args, ctx), do: {:ok, Cratis.Arc.MongoDB.page({ctx, Book}, %{})}
```

With three distinct titles, request ascending title order, page 1 and size 2. Expect only the last book, with total 3. Without a size this helper returns all matches; require a bounded request if that would be unsafe.
