---
agent: agent
description: Add or update an Entity Framework Core DbContext, table column, or migration in the project.
---

# Add an EF Core Migration

I need to make a **database schema change** via Entity Framework Core.

## Inputs

- **Change type** — one of:
  - New table / entity
  - New column on existing table
  - Remove column
  - Rename column / table
  - New relationship (FK, navigation property)
  - Other (describe)
- **Entity name** — the C# class being changed
- **DbContext** — which `DbContext` owns this entity

## Step-by-step process

Follow `.github/instructions/efcore.specs.instructions.md` for testing patterns.

### 1 — Update the entity and DbContext

- Add/remove/rename properties on the entity `record` or `class`.
- Update the `DbContext`:
  - Register the entity with `modelBuilder.Entity<T>()` if new
  - Configure columns, constraints, and indexes in `OnModelCreating`
  - Use `HasColumnName`, `HasMaxLength`, `IsRequired`, etc. explicitly for non-default mappings

### 2 — Add the migration

```bash
dotnet ef migrations add <MigrationName> \
  --project <DbContextProject> \
  --startup-project <StartupProject> \
  --output-dir Migrations
```

Review the generated migration file before applying:
- Confirm `Up()` adds exactly what was intended
- Confirm `Down()` correctly reverses the change
- Check that no unintended tables/columns are included

### 3 — Apply the migration (dev environment)

```bash
dotnet ef database update \
  --project <DbContextProject> \
  --startup-project <StartupProject>
```

### 4 — Update specs

- Integration specs that use the in-memory SQLite database will pick up the new schema automatically via `context.Database.EnsureCreated()`.
- If specs break, check that the `DbContext` fixture uses the correct connection string and schema.

### 5 — Validate

Run `dotnet build` and `dotnet test`. Fix any failures before completing.

## Naming conventions

- Migrations: `PascalCase` describing the change — e.g. `AddProjectDescriptionColumn`, `CreateSlicesTable`
- Never name a migration `Update`, `Fix`, or `Change` without specifics
