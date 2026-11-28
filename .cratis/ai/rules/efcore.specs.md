---
applyTo: "**/for_*/**/*.cs, **/when_*/**/*.cs"
paths:
  - "**/for_*/**/*.cs"
  - "**/when_*/**/*.cs"
profile: application
---

# Entity Framework Core Specs

These rules apply only to specs for code that uses an EF Core `DbContext`. Whether a behavior needs a spec, and at which boundary, is decided by **cratis-specifications-exercise-backend**; this rule covers only the SQLite technique once a `DbContext` spec is warranted.

EF Core specs verify database interaction logic — queries and error handling. They use SQLite in-memory databases, which are fast, isolated, and disposable. This keeps specs independent of any real database server. SQLite does not prove a migration against the production provider; rehearse migrations with **cratis-arc-migrate-relational-schema**.

These specs are for code that interacts directly with `DbContext`. For a command, event or read-model outcome in an event-sourced slice, use **cratis-specifications-exercise-backend** instead.

## Database Setup

- Use SQLite in-memory database for all `DbContext` specs — it's fast and each spec gets a clean database.
- Configure and dispose the in-memory database properly to avoid state leakage between tests. Each spec run should start with a fresh schema.

## Mocking DbContext

- `SaveChanges()` and `SaveChangesAsync()` are virtual — mock with NSubstitute.
- `DbSet<T>` methods are virtual — mock as needed.
- Pass options when substituting: `Substitute.For<YourDbContext>(options)`.

```csharp
var options = new DbContextOptionsBuilder<YourDbContext>()
    .UseSqlite("DataSource=:memory:")
    .Options;

var context = Substitute.For<YourDbContext>(options);
```

## Simulating Failures

Mock `SaveChanges` / `SaveChangesAsync` to throw exceptions for testing error handling and recovery:

```csharp
context.SaveChangesAsync(Arg.Any<CancellationToken>())
    .Throws(new DbUpdateException("Simulated failure"));
```
