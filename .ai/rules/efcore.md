---
applyTo: "**/*.cs"
paths:
  - "**/*.cs"
profile: application
---

# Entity Framework Core Instructions

> **⚠️ APPLIES ONLY TO PROJECTS USING ENTITY FRAMEWORK CORE**
> If your project does not reference `Microsoft.EntityFrameworkCore` or any EF Core packages, **ignore this entire file**. These rules are irrelevant outside of EF Core contexts.
<!-- markdownlint-disable-next-line MD028 -- two deliberately separate callout boxes, not one blockquote split by a stray blank line -->

> **What is framework, and what is app convention.** `Cratis.Arc.EntityFrameworkCore` supplies the base contexts (`ReadOnlyDbContext`, `BaseDbContext`), the cross-database column helpers, `UseDatabaseFromConnectionString`, and the DI registration extensions — those are **real API** and this rule is authoritative about them. Project layout, table-name constants, migration file naming, and how migrations are applied are **per-app decisions**; sections marked *app convention* describe one common arrangement, and a repo that does it differently is not wrong. `.agents/PROJECT.md` in the consuming repo wins over anything here. The **add-ef-migration** skill is the step-by-step counterpart to this rule and draws the same line.

## Project Structure *(app convention)*

Many Cratis applications split EF Core across three projects. Confirm the arrangement in the repo you are in before assuming it:

| Project | Responsibility |
|---------|----------------|
| `Database` | Migrations only – no entities, no DbContexts |
| `Core` | Entities and feature DbContexts (co-located with features) |
| `Infrastructure` | DbContext registration, migration runner, cross-cutting EF setup |

**Where that split exists, the point of it is**: `Database` must NEVER import from `Core`. A migration describes a schema at a point in time and must not drift when an entity is refactored, so migrations reference only table-name constants (strings) and EF migration types. The dependency chain is:

```text
Core → Infrastructure → Database
```

## DbContext Base Types

Always use the Cratis Arc base types — never inherit directly from `DbContext`:

- **`ReadOnlyDbContext`** — for all read model / projection contexts (the vast majority)
- **`BaseDbContext`** — only for writable contexts that own state (e.g. device state, infrastructure state)

```csharp
// ✅ Read model context
public class StartupPhaseDbContext(DbContextOptions<StartupPhaseDbContext> options)
    : ReadOnlyDbContext(options)
{
    public DbSet<StartupPhase> StartupPhases => Set<StartupPhase>();
    public DbSet<PersonnelAssignment> PersonnelAssignments => Set<PersonnelAssignment>();
}

// ✅ Writable (state-owning) context
public class DeviceStateDbContext(DbContextOptions<DeviceStateDbContext> options)
    : BaseDbContext(options)
{
    public DbSet<DeviceState> DeviceStates => Set<DeviceState>();
}
```

Use the primary constructor pattern. Expose `DbSet<T>` as expression-bodied properties using `Set<T>()`.

## Feature Contexts — Not God Contexts

Create one focused DbContext per feature or tightly-related feature group. Never aggregate unrelated entities into a single context.

```csharp
// ❌ God context
public class AppDbContext : DbContext
{
    public DbSet<Mission> Missions { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<Station> Stations { get; set; }
    // ... many more
}

// ✅ Focused feature context
public class StartupPhaseDbContext(DbContextOptions<StartupPhaseDbContext> options)
    : ReadOnlyDbContext(options)
{
    public DbSet<StartupPhase> StartupPhases => Set<StartupPhase>();
    public DbSet<PersonnelAssignment> PersonnelAssignments => Set<PersonnelAssignment>();
}
```

Co-locate the DbContext file with its feature:

```text
Missions/Ongoing/StartupPhase/
├── StartupPhase.cs
├── StartupPhaseDbContext.cs
└── ...
```

## State Mutation — The Golden Rule

> **Never mutate state directly through a DbContext.**

All state changes must flow through events and Chronicle projections. Direct writes bypass the audit trail and event log.

```csharp
// ❌ Direct mutation — forbidden
dbContext.StartupPhases.Add(new StartupPhase(...));
await dbContext.SaveChangesAsync();

// ✅ Correct: emit an event, let the projection handle writes
[Command]
public record UpdateStartupPhase(MissionId MissionId, ...) { ... }
```

Only infrastructure projection code, the Chronicle event engine, and reference data sync may write through DbContexts.

## Registration

Use the Cratis Arc `Cratis.Arc.EntityFrameworkCore` extension methods:

```csharp
// Register a single writable DbContext
services.AddDbContextWithConnectionString<DeviceStateDbContext>(connectionString, optionalConfigure);

// Auto-discover and register ALL ReadOnlyDbContext subtypes from given assemblies
services.AddReadModelDbContextsWithConnectionStringFromAssemblies(
    connectionString,
    configureOptions,
    [Assembly.GetExecutingAssembly()]);
```

Configure the database provider using `UseDatabaseFromConnectionString`, which auto-detects PostgreSQL vs SQLite from the connection string:

```csharp
options.UseDatabaseFromConnectionString(connectionString);
```

Centralize all DbContext setup in a single `AddApplicationDbContexts` extension method per layer.

## Multiple Database Support

The application supports both PostgreSQL (ASP.NET mode) and SQLite (MAUI mode) from the same code. The provider is selected at runtime via the connection string — `UseDatabaseFromConnectionString` handles the detection.

Never hardcode a provider (e.g. `UseSqlite` or `UseNpgsql`) in application code. Always use `UseDatabaseFromConnectionString`.

## Migrations

Hand-write migrations rather than generating them with `dotnet ef migrations add`, so the schema stays reviewable and provider-neutral.

Where the three-project split above is in use, migrations live exclusively in the **`Database`** project, never in `Core` or `Infrastructure`. *(app convention)*

### Organization *(app convention)*

Each entity category has its own folder with versioned migration files:

```text
Database/
├── Missions/
│   ├── v1_0_0.cs
│   └── v1_1_0.cs
├── Users/
│   └── v1_0_0.cs
└── WellKnownTables.cs
```

### Naming *(app convention)*

Version files using the pattern `v{major}_{minor}_{patch}.cs` and place them inside a namespace matching their folder:

```csharp
namespace Database.Missions;

public class v1_0_0 : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) { ... }
    protected override void Down(MigrationBuilder migrationBuilder) { ... }
}
```

The migration ID is composed as `{folder}_{ClassName}` (e.g. `Missions_v1_0_0`).

### Cross-Database Column Helpers — real Arc API

Always use the `Cratis.Arc.EntityFrameworkCore` column helpers to define columns. These abstract over the type-name differences between providers, so the same migration runs on SQLite, PostgreSQL, and SQL Server. There are **two families**, for the two shapes an EF Core migration takes.

**`ColumnsBuilder` extensions** — inside a `CreateTable(columns: table => new { … })`. Every one takes the `MigrationBuilder` as its second argument, because that is how the helper discovers the target provider:

| Helper | Use for |
|--------|---------|
| `table.StringColumn(mb, maxLength?, nullable?, defaultValue?)` | Text / varchar columns |
| `table.NumberColumn<T>(mb, nullable?, defaultValue?)` | Integer, long, or numeric columns |
| `table.BoolColumn(mb, nullable?, defaultValue?)` | Booleans |
| `table.GuidColumn(mb, nullable?)` | UUID / GUID columns |
| `table.DateTimeOffsetColumn(mb, nullable?)` | Timestamps with timezone |
| `table.AutoIncrementColumn(mb)` | Identity / serial columns |

**`MigrationBuilder` extensions** — for altering an existing table: `AddStringColumn`, `AddNumberColumn<T>`, `AddBoolColumn`, `AddGuidColumn`, `AddDateTimeOffsetColumn`, `AddAutoIncrementColumn`, plus the spatial `AddPointColumn` / `AddLineStringColumn` / `AddPolygonColumn`.

Never use raw EF `table.Column<string>()` etc. — it bakes in one provider's type names.

```csharp
// ✅ Cross-database migration
migrationBuilder.CreateTable(
    name: WellKnownTables.Missions,
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
        table.PrimaryKey("PK_Missions", x => x.Id);
        table.ForeignKey("FK_Missions_Urgency", x => x.UrgencyId,
            WellKnownTables.MissionUrgencies, "Id", onDelete: ReferentialAction.SetNull);
    });
```

### Table Names *(app convention)*

Referring to a table by a shared constant rather than a magic string keeps `CreateTable`, `AddColumn`, and every later migration in agreement:

```csharp
// ❌ Magic string
migrationBuilder.CreateTable(name: "Missions", ...);

// ✅ Constant
migrationBuilder.CreateTable(name: WellKnownTables.Missions, ...);
```

**There is no framework type for this.** Chronicle's `WellKnownTableNames` is kernel-internal (`Source/Kernel/Storage.Sql`) and not available to applications — an app declares its own class in whatever project owns migrations:

```csharp
// Your app's own class, not something Cratis ships.
public static class WellKnownTables
{
    public const string Missions = "Missions";
}
```

Follow whatever the repo already does; if it uses plain strings, keep using plain strings.

### Applying Migrations *(app convention)*

**There is no `ApplyAllMigrations` extension method in Cratis** — neither Arc nor Chronicle ships one. How migrations get applied at startup is the app's decision. The two common choices:

- Call EF Core's own `context.Database.MigrateAsync()`, which is what Chronicle's kernel does internally.
- Write a custom runner that discovers `Migration` subclasses from the migrations assembly, checks the EF history table, and applies pending migrations in version order within a transaction.

Either way the same code path serves every supported provider; do not branch on provider at the call site.

## Auto-Discovery

The Cratis Arc `IImplementationsOf<T>` mechanism discovers DbContext types at runtime:

- `IImplementationsOf<BaseDbContext>` — all `DbContext` subtypes across all loaded assemblies.
- `DiscoverAndFilterDbContextTypes<ReadOnlyDbContext>(assemblies)` — discovers the read-model contexts; the registration helpers (`AddReadModelDbContextsWithConnectionStringFromAssemblies` / `AddReadModelDbContextsFromAssemblies`) build on it.
- To isolate **writable** contexts, filter the discovered set on assignability — `types.Where(t => !typeof(ReadOnlyDbContext).IsAssignableFrom(t))` — rather than a dedicated extension.
