---
name: cratis-arc-migrate-relational-schema
description: Use when a developer needs to generate, review or apply an EF Core migration to an existing relational database used by Arc. Not for changing the shape of a stored Chronicle event (use cratis-chronicle-evolve-event).
compatibility: Requires the application's relational EF provider, Cratis.Arc.EntityFrameworkCore, Microsoft.EntityFrameworkCore.Design and a matching dotnet-ef tool.
---

# Add a column without losing existing rows

Change the EF model and its mapping first. For example, add a nullable `Subtitle` to the existing `Books` entity. Use a nullable column when older rows have no meaningful value; do not invent a default solely to satisfy a constraint.

1. From the backend project run `dotnet ef dbcontext info`. Confirm the intended context and provider. If the context is created by a design-time factory, supply the same maps, concept converters and GUID storage options as the host. Otherwise the scaffold may propose unrelated changes.
2. Run `dotnet ef migrations add AddBookSubtitle`. Review the snapshot and both migration methods. For a string limited to 200 characters, this is the relevant migration excerpt:

   ```csharp
   using Cratis.Arc.EntityFrameworkCore;
   using Microsoft.EntityFrameworkCore.Migrations;

   public partial class AddBookSubtitle : Migration
   {
       protected override void Up(MigrationBuilder migrationBuilder) =>
           migrationBuilder.AddStringColumn("Subtitle", "Books", maxLength: 200, nullable: true);

       protected override void Down(MigrationBuilder migrationBuilder) =>
           migrationBuilder.DropColumn("Subtitle", "Books");
   }
   ```

   `AddStringColumn` chooses a column type for the active provider; it does not backfill values. Reject unexpected drops, key changes or missing tenant columns before applying anything.
3. Point the context at a disposable database of the target provider on the **previous** migration. Insert a representative book, record its key and tenant, then run `dotnet ef database update AddBookSubtitle`. `dotnet ef migrations list` must show the new migration applied. From a fresh context read the same book with `Subtitle == null`, write a subtitle and read it back. Repeat for each database in scope if tenants have separate databases.

## Rehearse rollback before deployment

Take a restorable backup. On a disposable copy only, record the exact previous migration ID from `dotnet ef migrations list`. After testing the upgrade, run `dotnet ef database update <previous-migration-id>` with that ID. Confirm the original book is readable by the old application and the added column is gone. If new values must survive a rollback, do not run this `Down` on the live database: roll the application back while retaining the compatible nullable column, or agree on a tested data recovery plan.

## When the column must eventually be required

Deploy the nullable change first. Backfill from an agreed source and verify there are no missing values, including rows created by older writers. Only then ship the non-null constraint. Review the rollout and restore procedure with the database owner; `Down` drops subtitles and is not a data backup.

For a typed document reader with no relational schema change, [connect storage](../cratis-arc-connect-storage/SKILL.md) instead.
