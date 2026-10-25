<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Read-model indexes

Verified at Chronicle **v19.110.1**: `Source/Clients/DotNET/ReadModels/IndexAttribute.cs`,
`CompositeIndexAttribute.cs` and
[indexing documentation](https://github.com/Cratis/Chronicle/blob/v19.110.1/Documentation/read-models/indexing.mdx).

`[Index]` is no longer MongoDB-only. SQL index support starts in 19.105.0;
composite and descending indexes are available in 19.110.0. Import
`Cratis.Chronicle.ReadModels`.

```csharp
[ReadModel]
[CompositeIndex(nameof(CustomerId), nameof(Created), IsDescending = new[] { false, true })]
public record OrdersByCustomer(
    Guid Id,
    [property: Index] Guid CustomerId,
    [property: Index(IsDescending = true)] DateTimeOffset Created);
```

- `[Index]` targets a property or record parameter; `[CompositeIndex]` targets
  a class and is repeatable. Composite property order matters.
- Dotted paths name nested properties. `IsDescending` is one flag on `[Index]`,
  an array on `[CompositeIndex]`; omit the array for all ascending or provide
  one flag per property. Empty/duplicate/unknown paths and mismatched flag
  counts are refused at registration. Indexes are not uniqueness constraints.
- MongoDB and SQL create indexes at read-model registration. PostgreSQL uses
  GIN for collection paths, which cannot be combined in a composite index with
  ordinary fields. SQL Server and SQLite skip collection indexes with a warning.
- SQL Server indexed string columns honor `MaxLength`, `StringLength` or
  `Length`; otherwise the bound is 450 characters. Overlong writes fail the
  projection partition. Replay existing read models to apply bounded columns.
- Indexes on reused nested types are expanded for every path (19.110.1), not
  just the first occurrence. Test the actual store's query behavior and inspect
  its schema; an in-process scenario does not prove physical indexes exist.
