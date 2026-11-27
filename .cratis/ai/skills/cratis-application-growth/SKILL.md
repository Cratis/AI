---
name: cratis-application-growth
description: Use when a Cratis application’s source tree must grow from one project into modules or module projects, untangle a catch-all project, rename namespaces after moves, or decide whether a new application starts modular. Not for service splits or one slice’s contents.
license: MIT
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Grow an application's anatomy

Keep each slice together throughout the move. Preserve stored identities until the separate rename window.

The order is fixed: **decide, guard, move, untangle, rename, verify.** Each phase is done when its
check passes; do not start the next one before.

## 1. Decide

1. Name the current stage and the signal that justifies the next, in the rule's terms. No signal, no move.
2. A new application starts at stage 2 or 3 only for a rule-listed reason; otherwise stage 1.
3. Read the accepted decision records that describe the current structure. If the target contradicts one,
   write the superseding record first (**cratis-engineering-decision-record**); a record binds until then.
4. Write down the target: the modules, the platform projects (each with one stated purpose), and
   where every existing project goes.

Done when: the target is written and no accepted record contradicts it.

## 2. Guard before moving

1. Add the architecture gates from the rule's *Gates* section as specs, in a project of their own.
2. Record the current numbers as committed baselines: seams, `InternalsVisibleTo` grants, references between
   modules, platform-to-module references, folders without project or README, namespace/folder
   mismatches, frontend boundary violations.
3. Each gate fails when its baseline grows and asks for the baseline to shrink when coupling is removed.

Done when: the gates run in the normal spec pass and fail on a planted violation (add one grant, see red, remove it).

## 3. Move, and only move

Keep namespaces and assembly names while moving; moving a file changes no identity, a namespace change
does (rule, *What a rename changes*).

| Move | Steps (each a separate commit; build and run specs after each) |
| --- | --- |
| **1 → 2** | Create the module folder, `git mv` the related feature folders under it, add its `README.md`. |
| **2 → 3** | Create the module project and frontend package; `git mv` the module folder into them; reference only what the rule's layer table allows. Add the module declaration and register its routes, navigation and settings by convention. |
| **3 → 4** | At the first cross-module need, create `<Module>.Contracts` in the owning module and point the consumer at it. Replace the direct reference; never keep both. |

- `git mv` for files; no behavior change, rename or refactor in a move commit.
- When a project is renamed and stored names are assembly-qualified, keep its `AssemblyName`.
- A folder whose namespace no longer matches goes into the namespace allowlist until the rename window.
- Never add `InternalsVisibleTo` or a seam to make a move compile. A move that would need one waits
  until step 4 has replaced the dependency.
- Large reshapes split into lanes: one worktree and branch per module or engine, each owning disjoint
  folders, merged into one integration branch. Re-run every gate after each merge; when two lanes both
  shrank a baseline, record the merged value, never the larger one.

Done when: build, specs and gates pass and every baseline is equal or smaller.

## 4. Untangle

For each dependency that points up or sideways, pick one fix:

| The dependency is | Fix |
| --- | --- |
| A question or request to another module | Grain or service interface in the owner's `.Contracts` |
| "Tell me when" | Public event in the owner's `.Contracts`; the consumer reacts |
| A module needing an external provider | Port in the module's `.Contracts`; each `Integration.<Provider>` project implements it |
| Platform code that knows a module | Discovery interface in the platform; the module implements it |
| Technical code with no domain | Move it to Infrastructure (or Components for UI) |

**Dissolving a catch-all project** (`Global`, `Shared`, `Common`): measure what other projects actually
import from it, folder by folder. Each cluster that several modules use becomes a platform project with
one purpose (shell and tenancy into the host or a `Tenancy.Contracts`, an engine into its own project
with contracts); everything else moves into the module that owns it. Delete the project when it is empty.

**Retiring a project that owns event types** removes those types: their stored events and registrations
need an event-store plan before the project goes; use [cratis-chronicle-evolve-event](../cratis-chronicle-evolve-event/SKILL.md).

Done when: the seam baseline and the module-reference baseline reach zero.

## 5. Rename window

Rename namespaces to `<Company>.<Product>.<Project>.<folder path>` **once**, after the moves, as a
production rollout. Read [references/rename-window.md](references/rename-window.md) before starting it.

Done when: the namespace allowlist is empty and the stored-identity repair has passed its dry run and tests.

## 6. Verify

Run one phase at a time, each exiting 0 (use the repository's script names):

```bash
dotnet build
dotnet test
yarn tsc --noEmit
yarn lint
```

Then boot the host and drive it end to end (integration specs over HTTP, then a walk of every screen).
Unit specs construct types directly; they do not see DI registration order, routes, generated proxies or
name-scoped filters, which is where structural changes break. Say which phases were not run.

## Pitfalls

| Symptom | Cause | Fix |
| --- | --- | --- |
| Observers replay from the start, side effects repeat | A namespace or type name changed an observer identity | Pin the id, or repair stored identities before starting the new version |
| `IFoo` not resolved, or the wrong implementation wins | Interface moved to `.Contracts`, so the same-namespace convention no longer binds; or extra bindings ran before explicit registrations | Register the pair explicitly; apply generated bindings once, after all explicit ones |
| 404 from the frontend or a script after a rename | Arc routes follow the namespace | Regenerate proxies; replace hard-coded routes; update reverse-proxy rewrites |
| A generated proxy lost members after a split | A project that only references a type emitted a copy over the owner’s proxy | Generate each project into its own package; map referenced assemblies with `AssemblyToPackageMapping`. See [cratis-arc-generate-proxies](../cratis-arc-generate-proxies/SKILL.md). |
| API docs, authorization or Release stripping silently stopped applying | Code keyed on a namespace or path | Replace name keys with explicit declarations or one shared pattern |
| Stored jobs fail to resume after a project rename or a move | Job type names are assembly-qualified | Keep `AssemblyName`; for a job type moved to another assembly, rewrite the stored names or leave a type forwarder |
| Module B does not compile without module A's internals | Hidden coupling | Contract or lower project; never `InternalsVisibleTo` |
| Gate baseline keeps growing | Moving and refactoring in one step | Split the commit; fix the dependency, not the baseline |

## Related

- Modules deployed as separate services: [cratis-platform-verify-service-handoff](../cratis-platform-verify-service-handoff/SKILL.md) and [cratis-chronicle-publish-contract](../cratis-chronicle-publish-contract/SKILL.md).
- **cratis-engineering-decision-record**: superseding the structure's accepted records.
- Verifying a slice against its model after a move: [cratis-platform-deliver-slice](../cratis-platform-deliver-slice/SKILL.md).
