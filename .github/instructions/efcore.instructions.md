---
applyTo: "**/*.cs"
---

# Entity Framework Core Instructions

> **⚠️ APPLIES ONLY TO PROJECTS USING ENTITY FRAMEWORK CORE**
> If your project does not reference `Microsoft.EntityFrameworkCore` or any EF Core packages, **ignore this entire file**. These rules are irrelevant outside of EF Core contexts.

## Project Structure

Responsibilities are split across three projects:

| Project | Responsibility |
|---------|----------------|
| `Database` | Migrations only – no entities, no DbContexts |
| `Core` | Entities and feature DbContexts (co-located with features) |
| `Infrastructure` | DbContext registration, migration runner, cross-cutting EF setup |

**Critical dependency rule**: `Database` must NEVER import from `Core`. Migrations reference only `WellKnownTables` constants (strings) and EF migration types. The dependency chain is:

```
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

```
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

Centralise all DbContext setup in a single `AddApplicationDbContexts` extension method per layer.

## Multiple Database Support

The application supports both PostgreSQL (ASP.NET mode) and SQLite (MAUI mode) from the same code. The provider is selected at runtime via the connection string — `UseDatabaseFromConnectionString` handles the detection.

Never hardcode a provider (e.g. `UseSqlite` or `UseNpgsql`) in application code. Always use `UseDatabaseFromConnectionString`.

## Migrations

Migrations live exclusively in the **`Database`** project, never in `Core` or `Infrastructure`.

- Folder per entity category with versioned files using `v{major}_{minor}_{patch}.cs` naming.
- Always reference table names from `WellKnownTables` constants — never use magic strings.
- Always use Cratis Arc column helpers (`StringColumn`, `GuidColumn`, `NumberColumn<T>`, `DateTimeOffsetColumn`) — never raw `table.Column<T>()` — to ensure cross-database compatibility.
- Apply migrations via `ApplyAllMigrations(connectionString)` — never use `dotnet ef database update`.

→ For step-by-step migration creation, invoke the **`add-ef-migration`** skill.

## Auto-Discovery

The Cratis Arc `IImplementationsOf<T>` mechanism discovers types at runtime:

- `IImplementationsOf<BaseDbContext>` — all DbContext subtypes across all loaded assemblies
- `.NotReadonly()` extension — filters out `ReadOnlyDbContext` subtypes to isolate writable contexts
- `IReadModelDbContexts.GetAll()` — returns all registered `ReadOnlyDbContext` instances
