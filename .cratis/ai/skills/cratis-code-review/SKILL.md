---
name: cratis-code-review
description: Use when reviewing changed Cratis application or platform code for architecture, style and specification coverage beyond compiler checks. Not for a focused security or scalability audit, or for scheduling review rounds.
license: MIT
---

# Cratis code review

A review is worth the reader's time only when it separates what must change from
what could. Everything below is a criterion an analyzer does **not** already
enforce — if the build is clean and this list is clean, the change is sound on
the axes a reviewer can judge.

Review the **change**, not the file. A pre-existing violation in a line the
change did not touch is a note, never a blocker.

## Application packages covered

| Package | Purpose |
| --- | --- |
| `Cratis.Arc.Core` | Command, query, validation and analyzer surface (`ARC0001`–`ARC0026`, including operations, authorization, generated values and explicit query selection) |
| `Cratis.Chronicle` | Event, projection, read-model and constraint surface |
| `Cratis.Fundamentals` | `ConceptAs<T>`, `IInstancesOf<T>`, the DI conventions |

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

Use the `criticality-tiers` rule to select required gates for the changed
inputs and their dependencies. Run applicable Debug and Release builds only for
affected .NET inputs, lint and the TypeScript build only for affected TypeScript
inputs, and existing specs when required by the tier. Stop and
report a failed required gate as the finding.

## Step 2 — Architecture

For platform or library code, follow the `framework` rule (in `cratis/engineering`):
check the existing package layout and the impact on public contracts and consumers.
Skip the application checklist below, including slice layout, and use the remaining
review steps only where they apply to the changed code.

- Each slice is its own folder, `<Module>/<Feature>/<Slice>/<Slice>.cs`, with the
  backend artifacts together. **No top-level `Features/` wrapper.**
- Namespace mirrors the folder path under the source root.
- Review command shape, refusals and data loading with `cratis-arc-declare-command`;
  check durable event facts with `cratis-chronicle-evolve-event` (both in
  `cratis/application`).
- Identity concepts derive from `EventSourceId<T>`, not `ConceptAs<Guid>`.
- Domain values are concepts, not raw `Guid`, `string`, or `int`. Search the change
  for single-value records (`record \w+\((Guid|string|int|long) Value\)`) with no
  base type, then judge each: a concept-shaped candidate is a finding, a
  genuine DTO is not an automatic rejection.
- Check projection inputs, mapping and stable observer identity with
  `cratis-chronicle-project-view`, and query publication with
  `cratis-arc-expose-query` (both in `cratis/application`).
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
- Review decision reads with `cratis-chronicle-protect-decision` from
  `cratis/application`; flag any downgrade or bypass without a stated reason.
- Use `Cratis.Arc.Core.CodeAnalysis` and `Cratis.Arc.Chronicle.CodeAnalysis`.
  ARCCHR0011 (Info, `Off` only) and 0012 flag unprotected reads/immediate
  bypasses; 0013 (Info) recommends definitions; 0014 checks declared observer
  streams; 0015 warns on nullable events; 0016 flags ignored concurrency flags;
  0017/0018 check stream-id templates; 0019 warns on folds exposed as queries.
  ARC0015 checks concept query inputs, ARC0016–18 operations, ARC0019–21
  authorization, ARC0022–25 generated values and ARC0026 explicit/ambiguous queries.
  A clean build cannot prove the Info-level decision advisories were addressed.

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
- In application slices, components live in the slice folder. No barrel `index.ts`
  that re-exports one component, and no technical `hooks/` / `utils/` / `types/`
  grouping at feature level.
- The copyright header is on every file.

## Step 5 — Performance, in passing

Performance is part of an ordinary review, not only a separate pass. Flag the
degradations a reviewer can see without measuring:

- A projection joining on a read model; a reactor re-querying the event log
  inside a handler instead of using the event data.
- A new projection that could not replay all earlier events; events carrying
  large blobs.
- A query that does not filter on an indexed field, a growable list that does
  not use server-side paging (`cratis-arc-page-query` in `cratis/application`),
  or a collection hydrated only to count it.
- An N+1 pattern; a response payload with fields no client reads.
- React: a growable list rendering every row; an inline object or array literal
  passed as a prop, changing identity every render; wrong `useEffect`
  dependencies.
- .NET: `.ToList()` before `.Where()`; an `IEnumerable<T>` enumerated more than
  once.

## Step 6 — Specification coverage

- Check that direct specs cover consequential decisions
  (`cratis-specifications-isolate-behavior` in `cratis/specifications/dotnet`) and backend
  scenarios cover only the obligations that depend on the pipeline, dispatch, mapping or constraints
  (`cratis-specifications-exercise-backend` in `cratis/application`).
  For application-owned decision guards, check one assembly-level admission spec
  rather than asking for races that re-prove framework behavior.
- Presentation message strings are not asserted by default. Exact wording is
  asserted only when it is the specified behavior, and the fact names that
  requirement.
- Nothing trivial is specified — a property getter, a constructor pass-through,
  a delegation.
- No specification sleeps to let the system catch up.

## Step 7 — Report

Write the report in this order: **Blockers**, **Suggestions**, **Dismissed (with reason)**
and **Verdict**. Write `None` for empty sections. Include a **Not examined:**
line naming unreviewed surfaces, ranges and checks. For each blocker, give its
evidence, concrete consequence and proposed correction.
Use **Changes requested** for a blocker, **Incomplete** if required evidence is
missing without a blocker, **Approved with suggestions** for non-blocking findings
after required checks, and **Approved** when required checks are complete with no findings.

Correctness regressions, broken contracts, and missing specification coverage
that leaves changed behavior unverified belong in Blockers when they require
correction before merge. Style preferences and maintainability improvements
without such a consequence belong in Suggestions. Apply the shared verdict
vocabulary to those findings.

For a quick review, report at most the few findings that matter most and say what
was not reviewed.

For a follow-up round after blockers were fixed, review only the delta and carry prior
findings forward. For planning rounds, use `cratis-engineering-review-rounds`
from `cratis/engineering/core`.

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

Every required gate for the tier and changed inputs is green before approval.
The report names what was reviewed and what was not.
