---
name: review-code
description: Use this skill when asked to review, check, or validate code in a Cratis-based project. Produces a structured review report with blocking issues and suggestions, checked against all project architecture and style standards.
---

Review changed code against all Cratis project standards and produce a structured report.

## C# Architecture

- [ ] Each slice: single file `Features/<Feature>/<Slice>.cs` with all backend artifacts
- [ ] Commands: `record` type with `Handle()` directly on them — no separate handler classes
- [ ] Events: `record` type, no mutable properties
- [ ] Projections: `.AutoMap()` is the first call before any `.From<>()`
- [ ] No service locator (`IServiceProvider` not injected)
- [ ] Namespace matches folder: `<NamespaceRoot>.<Feature>.<Slice>`

## C# Code Style

- [ ] File-scoped namespaces; `using` directives alphabetically sorted
- [ ] No unused `using` directives
- [ ] `is null` / `is not null` — never `== null` / `!= null`
- [ ] `var` preferred over explicit types
- [ ] No postfixes: `Async`, `Impl`, `Service` on class names
- [ ] No regions
- [ ] Custom exception types only — never `InvalidOperationException`, `ArgumentException`, etc.
- [ ] Exception XML docs start with "The exception that is thrown when …"
- [ ] Copyright header on every file
- [ ] Strongly-typed Concepts for all domain IDs/values (no raw `Guid`/`string` in domain models)

## TypeScript Code Style

- [ ] `const` over `let` over `var`
- [ ] Full descriptive names — never `e`, `idx`, `prev`, `dir`, `pos`
- [ ] No `any` type — `unknown` with type guards
- [ ] No `(x as any)` — use `value as unknown as TargetType`
- [ ] No unused imports
- [ ] Copyright header on every file

## Component Rules

- [ ] `CommandDialog` from `@cratis/components/CommandDialog` for command dialogs
- [ ] `Dialog` from `@cratis/components/Dialogs` for data-only dialogs
- [ ] Never imports `Dialog` from `primereact/dialog` directly
- [ ] No hard-coded hex/rgb colours — PrimeReact CSS variables only
- [ ] README.md present for complex component folders with multiple sub-components

## Output format

Start with: **Review result: ✅ Approved / ⚠️ Approved with comments / ❌ Changes requested**

Then list issues:
```
### <file path>

**[BLOCKING]** Line N: `problematic code`
Because: explanation
Fix:
```corrected code```
```

End with a concise summary of what passed and what must change.
