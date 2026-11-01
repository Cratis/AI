---
name: cratis-code-review
description: Use when reviewing changed Cratis application code for architecture, style and specification coverage beyond compiler checks. Not for a focused security or scalability audit, or for scheduling review rounds.
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

| Package | Purpose |
| --- | --- |
| `Cratis.Arc.Core` | Command, query, validation and analyzer surface (`ARC0001`–`ARC0026`, including operations, authorization, generated values and explicit query selection) |
| `Cratis.Chronicle` | Event, projection, read-model and constraint surface |
| `Cratis.Fundamentals` | `ConceptAs<T>`, `IInstancesOf<T>`, the DI conventions |

Fundamentals:
[`ConceptAs<T>`](https://github.com/Cratis/Fundamentals/blob/main/Source/DotNET/Fundamentals/Concepts/ConceptAs.cs)
is the typed-value record;
[`InstancesOf<T>`](https://github.com/Cratis/Fundamentals/blob/main/Source/DotNET/Fundamentals/Types/InstancesOf.cs)
discovers implementations and resolves them when enumerated;
[DI conventions](https://github.com/Cratis/Fundamentals/blob/main/Source/DotNET/Fundamentals/DependencyInjection/ServiceCollectionExtensions.cs)
honor `[Singleton]` and `[Scoped]`, defaulting to transient.

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
- No `[Singleton]` takes a scoped dependency — the event store and anything off
  it, a MongoDB collection/database/client, a `DbContext`, a read model by key.
  Such a type is transient or scoped instead; `IServiceScopeFactory` is only for
  a service the host itself resolves once.
- Logging lives in a `*Logging.cs` partial with `[LoggerMessage]`, not inline in
  domain code.
- No shared mutable state between commands.
- Read protection is `Off` by default; new code sets `<CratisReadProtection>On</CratisReadProtection>`.
  Under `Off` an injected model or validator read is advisory, not a concurrency guard.
  Under `On`, review that state rules sit in validators or handlers with the model as
  a parameter and `[Unprotected("why")]` carries a real reason. Apply
  [specs.scenarios.csharp.md](../../rules/specs.scenarios.csharp.md): business
  decisions use direct `Handle()`/validator calls with supplied state. Require
  one cheap assembly-level admission spec for the application's own shapes,
  not per-decision concurrency/conflict/isolation tests; Arc/Chronicle own that matrix.
- Use `Cratis.Arc.Core.CodeAnalysis` and `Cratis.Arc.Chronicle.CodeAnalysis`.
  ARCCHR0011 (Info, `Off` only) and 0012 flag unprotected reads/immediate
  bypasses; 0013 (Info) recommends definitions; 0014 checks declared observer
  streams; 0015 warns on nullable events; 0016 flags ignored concurrency flags;
  0017/0018 check stream-id templates; 0019 warns on folds exposed as queries.
  ARC0015 checks concept query inputs, ARC0016–18 operations, ARC0019–21
  authorization, ARC0022–25 generated values and ARC0026 explicit/ambiguous queries.
  A clean build cannot prove the Info-level decision advisories were addressed.
  Sources: Arc `Source/DotNET/Arc.Core.CodeAnalysis/DiagnosticDescriptors.cs`
  and `Source/DotNET/Chronicle.CodeAnalysis/DiagnosticDescriptors.cs`.

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
  `Dialog` from `@cratis/components/Dialogs` for data-only dialogs. **Never** a
  vendor or hand-rolled modal.
- No hard-coded hex or rgb colors — `--cratis-*` tokens only. No
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
- A new projection that could not replay all earlier events; events carrying
  large blobs.
- A query that does not filter on an indexed field; a growable list that does
  not return a shape Arc pages (`IQueryable<T>`, or MongoDB `Observe`); a query
  that pages or sorts itself or uses MongoDB `AsQueryable()`; hydrating a
  collection only to count it.
- An N+1 pattern; a response payload with fields no client reads.
- React: a growable list rendering every row; an inline object or array literal
  passed as a prop, changing identity every render; wrong `useEffect`
  dependencies.
- .NET: `.ToList()` before `.Where()`; an `IEnumerable<T>` enumerated more than
  once.

## Step 6 — Specification coverage

- Pure command, validator, reducer and reactor decisions have plain-call specs
  with supplied read-model state; scenarios cover exactly the obligations in the
  per-artifact decision table of `specs.scenarios.csharp.md` (pipeline and
  authorization, constraints, projection and reducer dispatch, reactor dispatch
  and routing) plus application-owned race-policy proof.
- Every State Change command has a happy-path specification.
- Every validation rule has a direct-call failure spec. Pipeline validation
  specs assert **both** `ShouldNotBeSuccessful()` and `ShouldHaveValidationErrors()`.
- Every business-rule rejection has a specification.
- Every constraint has an `EventScenario` specification asserting the constraint
  **name** by default.
- Presentation message strings are not asserted by default. Exact wording is
  asserted only when it is the specified behavior, and the fact names that
  requirement.
- Nothing trivial is specified — a property getter, a constructor pass-through,
  a delegation.
- No specification sleeps to let the system catch up.

## Step 7 — Report

Read and use `.cratis/ai/rules/review-reports.md` when writing the report.

Correctness regressions, broken contracts, and missing specification coverage
that leaves changed behavior unverified belong in Blockers when they require
correction before merge. Style preferences and maintainability improvements
without such a consequence belong in Suggestions. Apply the shared verdict
vocabulary to those findings.

For a follow-up round after blockers were fixed, review only the delta and carry prior
findings forward; see `cratis-engineering-review-rounds`.

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
