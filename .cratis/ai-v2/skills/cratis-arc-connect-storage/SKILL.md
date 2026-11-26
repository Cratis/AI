---
name: cratis-arc-connect-storage
description: Use when wiring EF Core, MongoDB or Neo4j persistence into an Arc-only slice, or migrating its database schema. Not for Chronicle materialization (cratis-chronicle-project-view).
compatibility: Requires the .NET SDK and the application's database provider.
---

# Bind storage without introducing an event store

1. Identify the provider already owned by the application, its scoped service, migration owner and tenant-to-storage mapping. Reject missing tenant selection. **Done:** an isolated database or schema is available and no production target is a fallback. Do not add Chronicle solely to separate commands and queries.
2. Inject the provider's typed dependency into the handler/query method. For EF register `WithEntityFrameworkCore` on the Arc builder and bind the application's context to its provider and connection. Inject that scoped context, save, then reload using a fresh context so the change tracker cannot satisfy the assertion. Apply pending migrations only to the disposable fixture first. With MongoDB use the tenant's typed collection; observation needs a change-stream-capable deployment. With Neo4j keep the session bound to the intended database and dispose it after the operation. **Done:** a second request reloads the committed value at the expected key.
3. Seed the same key with a different name in another tenant and repeat the read after the write. **Done:** tenant B's value is unchanged and the migration preserves existing fixture rows. If reload fails, compare the selected database, serializer mapping and acknowledged write before changing the CQRS contract. For a projection driven by events, hand the mapping to [Project a view](../cratis-chronicle-project-view/SKILL.md).

For example, give entries a tenant-scoped key in the EF model:

```csharp
public record Entry(string Tenant, int Id, string Name);
public class Store(SqliteConnection connection) : DbContext
{
    public DbSet<Entry> Entries => Set<Entry>();
    protected override void OnConfiguring(DbContextOptionsBuilder options) => options.UseSqlite(connection);
    protected override void OnModelCreating(ModelBuilder model) => model.Entity<Entry>().HasKey(x => new { x.Tenant, x.Id });
}
```

Run `dotnet test -c Release` in the application's provider-spec project. Expect a fresh context to reload both tenants' distinct values after migration.
