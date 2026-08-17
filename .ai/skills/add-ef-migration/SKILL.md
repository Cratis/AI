---
name: add-ef-migration
description: Use this skill when asked to add a database table, column, relationship, or other schema change via Entity Framework Core in a Cratis-based project.
---

Add or update an Entity Framework Core schema change with a hand-written migration.

> **Always read the [efcore.md](../../rules/efcore.md) rule first.** It is the source of truth for project structure, base types, column helpers, and migration conventions.

> **What is framework, and what is your app's own convention.** The `Cratis.Arc.EntityFrameworkCore` package supplies the base contexts (`ReadOnlyDbContext`, `BaseDbContext`), the cross-database column helpers, `UseDatabaseFromConnectionString`, and the DI registration extensions — those are real API and this skill is authoritative about them. **Everything about project layout, table-name constants, migration file naming, and how migrations get applied is a per-app decision.** Sections marked *app convention* below describe one common arrangement; a project that does it differently is not wrong, and `.agents/PROJECT.md` in that repo wins over anything here.

## Pre-flight — Understand the project split *(app convention)*

Many Cratis applications split EF Core across three projects. Confirm the arrangement in the repo you are in before assuming it:

| Project | What lives there |
|---------|-----------------|
| **Database** | Migrations only — table-name constants and versioned migration files |
| **Core** | Entities and feature DbContexts (co-located with features) |
| **Infrastructure** | DbContext registration, migration runner, cross-cutting EF setup |

Where that split exists, the point of it is that `Database` never imports from `Core` — a migration describes a schema at a point in time and must not drift when an entity is refactored.

## Step 1 — Update or create the entity

Add, rename, or remove properties on the entity `record` in the **Core** project, co-located with its feature:

```
Missions/StartupPhase/
├── StartupPhase.cs            ← entity record
├── StartupPhaseDbContext.cs   ← feature DbContext
└── ...
```

## Step 2 — Update or create the feature DbContext

Use the Cratis Arc base types — never inherit directly from `DbContext`:

- **`ReadOnlyDbContext`** — for all read model / projection contexts (the vast majority)
- **`BaseDbContext`** — only for writable contexts that own state

```csharp
public class StartupPhaseDbContext(DbContextOptions<StartupPhaseDbContext> options)
    : ReadOnlyDbContext(options)
{
    public DbSet<StartupPhase> StartupPhases => Set<StartupPhase>();
}
```

Create one focused DbContext per feature — never a "god context" with unrelated entities.

## Step 3 — Name the table *(app convention)*

Referring to a table by a shared constant rather than a magic string keeps `CreateTable`, `AddColumn`, and every later migration in agreement. **There is no framework type for this** — Chronicle's `WellKnownTableNames` is kernel-internal and not available to applications. Apps that want it declare their own, for example:

```csharp
// Your app's own class, in whatever project owns migrations.
public static class WellKnownTables
{
    public const string StartupPhases = "StartupPhases";
}
```

Follow whatever the repo already does; if it uses plain strings, keep using plain strings.

## Step 4 — Write the migration by hand

Chronicle's own read-model tables are migrated at runtime, but an application's own EF Core schema is yours to version. Hand-write migrations rather than generating them with `dotnet ef migrations add`, so the schema stays reviewable and provider-neutral.

File layout and naming are an *app convention*. One common pattern is a version-per-file scheme mirroring the feature folders:

```
Database/
├── Missions/
│   ├── v1_0_0.cs
│   └── v1_1_0.cs
└── WellKnownTables.cs
```

```csharp
namespace Database.Missions;

public class v1_1_0 : Migration
{
    /// <summary>
    /// Apply the schema change.
    /// </summary>
    /// <param name="migrationBuilder">The migration builder.</param>
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddStringColumn(
            name: "Description",
            table: WellKnownTables.Missions,
            maxLength: 1000,
            nullable: true);
    }

    /// <summary>
    /// Reverse the schema change.
    /// </summary>
    /// <param name="migrationBuilder">The migration builder.</param>
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "Description",
            table: WellKnownTables.Missions);
    }
}
```

### Cross-database column helpers — real Arc API

These are genuine `Cratis.Arc.EntityFrameworkCore` extension methods, not an app convention. Prefer them over raw `table.Column<T>()` so the same migration runs on SQLite, PostgreSQL, and SQL Server. Two families, for the two shapes EF Core migrations take:

**`ColumnsBuilder` extensions** — inside a `CreateTable(columns: table => new { … })`:

| Helper | Use for |
|--------|---------|
| `table.StringColumn(mb, maxLength?, nullable?, defaultValue?)` | Text / varchar columns |
| `table.NumberColumn<T>(mb, nullable?, defaultValue?)` | Integer, long, or numeric columns |
| `table.BoolColumn(mb, nullable?, defaultValue?)` | Booleans |
| `table.GuidColumn(mb, nullable?)` | UUID / GUID columns |
| `table.DateTimeOffsetColumn(mb, nullable?)` | Timestamps with timezone |
| `table.AutoIncrementColumn(mb)` | Identity / serial columns |

**`MigrationBuilder` extensions** — for altering an existing table: `AddStringColumn`, `AddNumberColumn<T>`, `AddBoolColumn`, `AddGuidColumn`, `AddDateTimeOffsetColumn`, `AddAutoIncrementColumn`, plus the spatial `AddPointColumn` / `AddLineStringColumn` / `AddPolygonColumn`.

Example `CreateTable`:

```csharp
migrationBuilder.CreateTable(
    name: WellKnownTables.StartupPhases,
    columns: table => new
    {
        Id = table.StringColumn(migrationBuilder, nullable: false),
        Title = table.StringColumn(migrationBuilder, maxLength: 200, nullable: false),
        ResourceId = table.NumberColumn<int>(migrationBuilder, nullable: true),
        DispatchTime = table.DateTimeOffsetColumn(migrationBuilder),
        UrgencyId = table.GuidColumn(migrationBuilder)
    },
    constraints: table =>
    {
        table.PrimaryKey("PK_StartupPhases", x => x.Id);
    });
```

## Step 5 — Register the DbContext (if new)

In the **Infrastructure** project, ensure the context is registered. Read-only contexts are auto-discovered:

```csharp
services.AddReadModelDbContextsWithConnectionStringFromAssemblies(
    connectionString,
    configureOptions,
    [Assembly.GetExecutingAssembly()]);
```

Writable contexts need explicit registration:

```csharp
services.AddDbContextWithConnectionString<DeviceStateDbContext>(connectionString);
```

## Step 6 — Update specs

Integration specs using in-memory SQLite pick up schema changes automatically via `context.Database.EnsureCreated()`. If specs break, check that the fixture uses the correct connection string and that the new migration is in the `Database` assembly.

## Step 7 — Validate

Run `dotnet build` and `dotnet test`. Fix all failures before completing.

## Key rules

Framework-level, true in any Cratis app:

- **Never** inherit `DbContext` directly — use `ReadOnlyDbContext` or `BaseDbContext`
- **Never** hardcode a provider (`UseSqlite`, `UseNpgsql`) — use `UseDatabaseFromConnectionString`, which picks the provider from the connection string
- **Never** mutate state directly through a DbContext in an event-sourced app — writes flow through Chronicle events and projections
- **Always** use the cross-database column helpers — never raw `table.Column<T>()`, which bakes in one provider's type names

App conventions — follow the repo, and `.agents/PROJECT.md` over this file:

- Hand-write migrations rather than `dotnet ef migrations add`
- How migrations are applied at startup. **There is no `ApplyAllMigrations` extension method in Cratis** — apps write their own runner, or call EF Core's `context.Database.MigrateAsync()` (which is what Chronicle's kernel does internally)
- Whether table names come from a shared constants class or plain strings
- The migration project layout and file-naming scheme
