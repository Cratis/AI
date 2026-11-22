---
name: cratis-application-growth
description: Use when a Cratis application's source tree must grow from one project into modules or module projects, or when deciding whether a new application starts modular. Not for service splits (cratis-multi-service-architecture) or one slice's contents.
license: MIT
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Grow an application's anatomy

The stages, signals, invariants and module anatomy are the rule
[application-anatomy.md](../../rules/application-anatomy.md); read it first. This skill is the procedure for
one move. The slice stays the unit throughout ([vertical-slices.md](../../rules/vertical-slices.md)).

## 1. Decide the move

1. Name the current stage (one project, modules in one project, module projects, contracts).
2. Name the signal that justifies the next one, in the rule's terms. No signal, no move.
3. A new application starts at stage 2 or 3 only for a rule-listed reason (several teams, separate
   capabilities, entitlement or audience gating, known product line); otherwise stage 1.
4. Scope the move to **one module or one boundary**. Never reshape the whole tree in one step.

## 2. Pin identities first

Before moving anything that carries a Chronicle identity:

1. List the event types, observers (reactors, reducers, projections), routes and settings keys under the code to move.
2. Give each an explicit identity where it is derived from a name or namespace (explicit `[EventType("…")]` id, explicit observer id).
3. Commit that pin alone, build, run specs, and confirm the discovered identities did not change.

Only then may a namespace or type name move. A deliberate identity change is
**cratis-chronicle-event-type-migration**, never part of a growth step.

## 3. Move, and only move

| Move | Steps (each a separate commit; build and run specs after each) |
| --- | --- |
| **1 → 2** | Create the module folder, `git mv` the related feature folders under it, update namespaces to match folders only after the pins. Add the folder's `README.md`. |
| **2 → 3** | Create the module project and frontend package; `git mv` the module folder into them; reference the platform projects only. Move anything the module needed from the host into Core, Infrastructure or Components (domain-free) or into the module. Add the module declaration, `README.md`, and register routes, navigation and settings by convention. |
| **3 → 4** | For the first cross-module need, create `<Module>.Contracts` in the owning module (public event or interface only, no logic); the consumer references only that. Replace the direct reference; do not keep both. |

Rules for every step:

- `git mv` for files; no behavior change, no rename, no refactor in a move commit.
- Never add `InternalsVisibleTo`. Code that needs it belongs in a lower project, or its dependency becomes a contract.
- A folder under the source root that is not a project or package, or has no README, is unfinished.
- Do not make a module reference another module "temporarily". A temporary allowance is a recorded, owned seam in the gate baseline (next section), not a hidden reference.

## 4. Ratchet the gates

1. Measure today's coupling: seams, cross-module `using`s, project references between modules, frontend import-boundary violations.
2. Store each count or list as a committed baseline that the architecture gate compares against.
3. Make the gate fail when any baseline grows; shrinking updates the baseline in the same change that removes the coupling.
4. After a move, tighten the baseline to the new reality. Never raise one to land a change.

Frontend boundary check: no import between two modules in both directions, imports of
another module only through its package's public exports, and the shared components
package imports no module.

## 5. Verify

Run one phase at a time, each exiting 0 (use the repository's own script names):

```bash
dotnet build
dotnet test
yarn tsc --noEmit
yarn lint
```

Then run the architecture gate and the identity check from step 2. A move is done when
build, specs, gates and identities are unchanged or tighter. Say which phases were not run.

## Pitfalls

| Symptom | Cause | Fix |
| --- | --- | --- |
| Events or observers appear twice or restart from zero after a move | A namespace or type name changed an identity | Revert the rename, pin the identity, move again |
| Module B does not compile without module A's internals | Hidden coupling | Move the shared concept to a lower project or publish a contract; never `InternalsVisibleTo` |
| Platform project imports a module namespace | Dependency points up | Replace with a discovery interface the module implements |
| Gate baseline keeps growing | Moving and refactoring in one step | Split the commit; fix the dependency, not the baseline |

## Related

- **cratis-multi-service-architecture** — modules deployed as separate services.
- **cratis-chronicle-event-type-migration** — deliberate identity or schema changes.
- **cratis-application-slice-conformance** — a slice against its model after a move.
