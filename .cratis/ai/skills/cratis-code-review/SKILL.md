---
name: cratis-code-review
description: Review changed code in a Cratis application against the architecture, style, and specification-coverage criteria that the compiler cannot check, and produce a structured report with blocking issues separated from suggestions. Use when asked to review, check, or validate a change. Do not substitute it for a focused security audit and do not restate specialist performance findings.
license: MIT
---

# Cratis code review

A review is worth the reader's time only when it separates what must change from
what could. Everything below is a criterion an analyzer does **not** already
enforce — if the build is clean and this list is clean, the change is sound on
the axes a reviewer can judge.

Review the **change**, not the file. A pre-existing violation in a line the
change did not touch is a note, never a blocker.

## Verified product sources

| Package | Version | Purpose |
| --- | --- | --- |
| `Cratis.Arc.Core` | `22.10.4` | Command, query, validation and analyzer surface (`ARC0001`–`ARC0015`) |
| `Cratis.Chronicle` | `16.45.2` | Event, projection, read-model and constraint surface |
| `Cratis.Fundamentals` | `7.18.2` | `ConceptAs<T>`, `IInstancesOf<T>`, the DI conventions |

Reverify against the owning product repository before asserting a framework
contract this file does not already state.

## Route near misses

- A focused authentication, authorization, data-exposure, or event-sourcing
  security audit: use `cratis-security-review`.
- A focused Chronicle, database, .NET or React scalability analysis: use
  `cratis-performance-review`. The performance items below are the ones a
  general reviewer should catch in passing; do not duplicate the specialist's
  findings when both have run.
- Deciding whether the behavior is right at all: that is modeling, not review.

## Step 1 — Run the gates first

A review that reports what the build already says is noise. Confirm the change
builds clean in Debug and Release, its specifications pass, and lint and the
TypeScript build are clean. Report a gate failure as the finding and stop —
there is nothing to review under a red build.

## Step 2 — Architecture

- Each slice is its own folder, `<Module>/<Feature>/<Slice>/<Slice>.cs`, with the
  backend artifacts together. **No top-level `Features/` wrapper.**
- Namespace mirrors the folder path under the source root.
- Commands are `record` types with `Handle()` on the record. No separate handler
  class.
- Business rejection returns a `ValidationResult` or
  `Result<TEvent, ValidationResult>`, or comes from a validator. **Never thrown
  from `Provide()` or `Handle()`** — a throw is HTTP 500, not a validation error.
- Fetched or computed handler data is in `Provide()`, not inline in `Handle()`.
- Events are `record` types: past tense, no mutable and no nullable properties,
  never carrying the event-source id, and each has an XML `<summary>`.
- Identity concepts derive from `EventSourceId<T>`, not `ConceptAs<Guid>`.
- Domain values are concepts, not raw `Guid`, `string`, or `int`.
- Projections consume events, never read models. AutoMap is on by default —
  `.AutoMap()` appears only inside a scope disabled with `.NoAutoMap()`.
- A `[Projection]` id, once given explicitly and deployed, is permanent. The
  argument is optional; adding one to an existing projection after the fact
  changes its identity.
- Model-bound query custom paths use `[Path("...")]`, never ASP.NET `[Route]`.
- No service locator: `IServiceProvider` is not injected. Implementation sets
  come from `IInstancesOf<T>`, never `IEnumerable<T>`.
- No explicit singleton registration where `[Singleton]` suffices.
- Logging lives in a `*Logging.cs` partial with `[LoggerMessage]`, not inline in
  domain code.
- No shared mutable state between commands.

## Step 3 — C# style

- File-scoped namespaces; `using` directives sorted, none unused.
- `is null` / `is not null`, never `== null` / `!= null`.
- `var` over an explicit type.
- No `Async`, `Impl`, `Service`, `Manager` or `Helper` postfix on a class name.
- No regions.
- Custom exception types only — never `InvalidOperationException`,
  `ArgumentException` or another built-in (`ARC0012` flags this on Arc
  artifacts). The XML doc starts with "The exception that is thrown when …".
- Every public type, method and property carries a multiline XML doc.
  `<summary>` is never collapsed onto one line. Every parameter has a `<param>`;
  every non-void method has `<returns>`; every throw has an `<exception cref>`.
- The copyright header is on every file; the file ends with one newline.

## Step 4 — TypeScript and components

- `const` over `let` over `var`; no unused imports.
- No `any`. Use `unknown` with a type guard; widen through
  `value as unknown as TargetType` rather than `(x as any)`.
- No `@ts-ignore` or `@ts-expect-error` without a comment saying why.
- Full descriptive names — never `e`, `idx`, `prev`, `dir`, `pos`.
- `CommandDialog` from `@cratis/components/CommandDialog` for command dialogs;
  `Dialog` from `@cratis/components/Dialogs` for data-only dialogs. **Never**
  `Dialog` from `primereact/dialog`.
- No hard-coded hex or rgb colors — PrimeReact CSS variables only. No
  `!important` without a justifying comment.
- Components live in the slice folder. No barrel `index.ts` that re-exports one
  component, and no technical `hooks/` / `utils/` / `types/` grouping at feature
  level.
- The copyright header is on every file.

## Step 5 — Performance, in passing

Performance is part of an ordinary review, not only a separate pass. Flag the
degradations a reviewer can see without measuring:

- A projection joining on a read model; a reactor re-querying the event log
  inside a handler instead of using the event data.
- A new projection that could not replay all historical events; events carrying
  large blobs.
- A query that does not filter on an indexed field; a growable list that does
  not return `IQueryable<T>` for server-side paging; hydrating a collection only
  to count it.
- An N+1 pattern; a response payload with fields no client reads.
- React: a growable list rendering every row; an inline object or array literal
  passed as a prop, changing identity every render; wrong `useEffect`
  dependencies.
- .NET: `.ToList()` before `.Where()`; an `IEnumerable<T>` enumerated more than
  once.

## Step 6 — Specification coverage

- Every State Change command has a happy-path specification.
- Every validation rule has a failure specification asserting **both**
  `ShouldNotBeSuccessful()` and `ShouldHaveValidationErrors()`.
- Every business-rule rejection has a specification.
- Every constraint has an `EventScenario` specification asserting the constraint
  **name**, not its message.
- No specification asserts on a presentation message string.
- Nothing trivial is specified — a property getter, a constructor pass-through,
  a delegation.
- No specification sleeps to let the system catch up.

## Step 7 — Report

Open with one line:

> **Review result: Approved / Approved with comments / Changes requested**

Then, per file:

```
### <file path>

**[BLOCKING]** Line N: `problematic code`
Because: <the consequence, not the rule number>
Fix:
<corrected code>
```

Close with what passed and what must change. Two rules make the report usable:

- **A blocking finding names a consequence.** "Violates the style guide" is not
  a reason. "Throws on a recoverable path, so the caller sees a 500 instead of a
  validation error" is.
- **Say what you did not review.** A report listing only findings reads as if
  everything was checked. Name the files, the paths, and the axes you skipped.

## What breaks

- **The review restates the compiler.** The gates were not run first, so
  analyzer output is being reported as review findings.
- **Every finding is blocking.** The distinction is what makes the report
  actionable; if everything blocks, nothing is prioritized.
- **A convention is reported as a framework contract.** The slice folder shape
  and the single-file default are house conventions; `Handle()` on the record and
  the `[Path]` attribute are contracts. Saying "the framework requires this" of a
  convention loses the reader's trust for the findings that are contracts.

## How it is proven

The build, the specifications, lint and the TypeScript build are all green
*before* the report is written, and the report names both what was reviewed and
what was not.
