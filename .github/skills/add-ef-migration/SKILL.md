---
name: add-ef-migration
description: Use this skill when asked to add a database table, column, relationship, or other schema change via Entity Framework Core in a Cratis-based project.
---

Add or update an Entity Framework Core schema change with a migration.

## Step 1 — Update the entity

Add, rename, or remove properties on the entity `record` or `class`:

```csharp
public record MyEntity
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    // Add new property here
    public string? Description { get; init; }
}
```

## Step 2 — Update the DbContext

In `OnModelCreating`, configure the new column/table:

```csharp
modelBuilder.Entity<MyEntity>(entity =>
{
    entity.HasKey(e => e.Id);
    entity.Property(e => e.Name).HasMaxLength(200).IsRequired();
    entity.Property(e => e.Description).HasMaxLength(1000);
});
```

## Step 3 — Add the migration

```bash
dotnet ef migrations add <MigrationName> \
  --project <DbContextProject> \
  --startup-project <StartupProject> \
  --output-dir Migrations
```

**Migration naming:** PascalCase, descriptive — e.g. `AddProjectDescriptionColumn`, `CreateSlicesTable`.
Never use `Update`, `Fix`, or `Change` without specifics.

Review the generated migration:
- `Up()` adds exactly what was intended
- `Down()` correctly reverses the change
- No unintended tables/columns included

## Step 4 — Apply the migration

```bash
dotnet ef database update \
  --project <DbContextProject> \
  --startup-project <StartupProject>
```

## Step 5 — Update specs

Integration specs using in-memory SQLite pick up schema changes automatically via `context.Database.EnsureCreated()`. If specs break, check that the fixture uses the correct connection string.

## Step 6 — Validate

Run `dotnet build` and `dotnet test`. Fix all failures before completing.
