---
name: cratis-arc-expose-query
description: Use when exposing a C# read model through a static query or observable query endpoint. Not for defining how events populate it (cratis-chronicle-project-view).
compatibility: Requires the .NET SDK.
---

# Expose the read, not the projection

1. Specify the fields, cardinality and allowed scope. For Authors the item is `Author(Id, Name)`; decide whether the caller needs a snapshot or must see a registration made after opening the page. **Done:** the acceptance check names the expected key and whether a second emission is required.
2. Put a public static method on the `[ReadModel]` type. Return a scoped provider query for a snapshot. For a live list, return the provider's observable. With `IMongoCollection<Author>` supplied by the configured MongoDB integration, this method belongs on `Author`:

```csharp
    [Cratis.Arc.Authorization.Authorize(Roles = "catalog-editor")]
    public static ISubject<IEnumerable<Author>> AllAuthors(IMongoCollection<Author> collection) => collection.Observe();
```

   **Done:** the built host exposes the intended item type and parameters, not a controller wrapper or event list. Use [Authorize a request](../cratis-arc-authorize-request/SKILL.md) if visibility can change during the subscription.
3. In an isolated scope call the query as the permitted editor, then register Aster after the initial result. **Done:** the initial snapshot matches seeded rows; the live subscription subsequently includes exactly the submitted ID and name. If storage lacks the row, give the mapping to [Project a view](../cratis-chronicle-project-view/SKILL.md); if storage has it but the transport does not deliver it, pass the endpoint and expected emission to [Diagnose a live query](../cratis-arc-diagnose-live-query/SKILL.md).

Run `dotnet test -c Release` in the application's query-spec project. Expect the snapshot to match the seeded rows and a live query to deliver the new row on the original subscription.
