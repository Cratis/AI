---
name: new-vertical-slice
description: Use this skill when asked to implement a new feature, command, query, slice, or screen in a Cratis-based project. Guides the full end-to-end workflow: C# backend → specs → dotnet build → React frontend → quality gates.
---

Implement a complete vertical slice following this EXACT order. Never skip steps or work on multiple slices in parallel.

## Step 1 — Identify the slice type

Choose **one** of:
- **State Change** — a command that mutates state and records events (most common)
- **State View** — a query that reads from a read model
- **Automation** — a background reactor triggered by events
- **Translation** — transforms events into other events

## Step 2 — Determine the namespace root

Read `global.json` and existing `.cs` files in `Features/` to find the namespace root (e.g. `Studio`, `Library`). Never hard-code it.

## Step 3 — Create the C# slice file

Place ALL backend artifacts in a single file: `Features/<Feature>/<Slice>.cs`

File creation order within the slice:
1. Concept types (if new strongly-typed IDs are needed — see `add-concept` skill)
2. Validation attributes on command properties
3. Command `record` with `Handle()` method
4. Business rules class `<Command>Rules` (if needed)
5. Event `record` (immutable — no setters)
6. Read model `record`
7. Projection class (`.AutoMap()` MUST come before any `.From<>()`)
8. Slice class (the class that has `Handle()` called by the framework)

**Critical rules:**
- Commands are `record` types with a `Handle()` method directly on them — DO NOT create separate handler classes
- Events are `record` types with no mutable properties
- Projection: `.AutoMap()` must be the first call before `.From<>()`
- Namespace must be `<NamespaceRoot>.<Feature>.<Slice>` (drop `.Features.` segment)
- Copyright header on every file: `// Copyright (c) Cratis. All rights reserved. // Licensed under the MIT license. See LICENSE file in the project root for full license information.`

## Step 4 — Build

Run `dotnet build`. Fix ALL errors and warnings before proceeding. This generates TypeScript proxies.

## Step 5 — Write specs (State Change slices only)

For each command, write specs covering:
- Happy path — command succeeds, correct event appended
- Each validation failure (one spec per rule)
- Each business rule violation
- Each constraint violation

See `write-specs` skill for the complete spec structure.

Run `dotnet test`. Fix all failures before proceeding.

## Step 6 — Implement React component(s)

Place `.tsx` files in `Features/<Feature>/<Slice>/`.

- Import the auto-generated command/query proxy from the same folder
- Use `CommandDialog` from `@cratis/components/CommandDialog` for command dialogs
- Use `Dialog` from `@cratis/components/Dialogs` for data-only dialogs — NEVER import from `primereact/dialog`
- Use PrimeReact CSS variables for all colours — never hard-code hex values
- Use full descriptive variable names — never abbreviations (`event` not `e`, `index` not `idx`)
- No `any` types — use `unknown` with type guards

**Command usage:**
```tsx
const [myCommand] = MyCommand.use();
const handleSubmit = async () => {
    myCommand.propertyName = value;
    const result = await myCommand.execute();
    if (result.isSuccess) closeDialog(DialogResult.Ok);
};
```

**Query with paging:**
```tsx
const pageSize = 10;
const [result, , setPage] = MyQuery.useWithPaging(pageSize);
// Use result.data, result.paging.totalItems, result.paging.page
```

## Step 7 — Update the composition page

Open `Features/<Feature>/<Feature>.tsx` and add the new component. If a new page is introduced, also update the router and navigation.

## Step 8 — Quality gates

All must pass before the slice is considered done:
- `dotnet build` — zero errors/warnings
- `dotnet test` — zero failures
- `yarn lint` — zero errors
- `npx tsc -b` — zero errors
