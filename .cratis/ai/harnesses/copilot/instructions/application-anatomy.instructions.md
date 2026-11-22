---
applyTo: "**/*.csproj,**/*.slnx,**/Directory.Build.props,**/Directory.Packages.props,**/package.json,**/tsconfig*.json,**/README.md"
profile: application
paths:
  - "**/*.csproj"
  - "**/*.slnx"
  - "**/Directory.Build.props"
  - "**/Directory.Packages.props"
  - "**/package.json"
  - "**/tsconfig*.json"
  - "**/README.md"
---
<!-- cratis-ai: generated Copilot instructions. Do not edit; rules/ is the source. -->

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Application anatomy for growing systems

> **Application profile.** This is how the source tree of an application built on Cratis is shaped as it grows. It does **not** apply inside a Cratis framework repository (see [framework.md](./framework.instructions.md)). The slice itself (what goes in one behavior folder) is in [vertical-slices.md](./vertical-slices.instructions.md); the procedure for moving between stages is the **cratis-application-growth** skill.

Every line is a **[convention]** (house default, not enforced by Arc or Chronicle) unless tagged **[contract]**. Enforcement is judgment plus the repository's own architecture gates; the framework does not check any of this.

An application's anatomy is a **path, not a choice made once.** Start at the smallest stage the product needs and grow into the next when a signal says so. Skipping a stage is fine; building a later stage's structure before its signal appears is not.

## The stages

| Stage | Shape | What it buys |
| --- | --- | --- |
| **1. One project** | A single backend project and a single frontend package; behaviors are `<Feature>/<Slice>/` folders. | Least ceremony; one build; slices stay cohesive. |
| **2. Modules in one project** | Features are grouped into named top-level folders (`<Module>/<Feature>/<Slice>/`), one folder per business capability, still one backend project. | Names the capability boundaries before paying for project boundaries. |
| **3. Modules as projects on a platform** | Each module is its own backend project and frontend package. Below them sit platform projects: **Core** (host, composition, discovery), **Infrastructure** (reusable technical code with no domain concepts), **Components** (shared UI), and **engines** (reusable behavior hosted by the platform that knows no module). | The compiler enforces the boundaries: a module cannot reach what it does not reference. |
| **4. Modules publish contracts** | Each module that others need exposes a `<Module>.Contracts` project (public events, grain or service interfaces). No module references another module; they meet only in contracts. | Modules change, deploy and are owned independently. |

Splitting into separately deployed services is a further step with its own rules; see **cratis-multi-service-architecture**.

## When to move up

Move up when a signal is present *now*, not when it is merely imaginable:

- **1 → 2:** a folder level of related features has appeared that people name as a capability; two features share vocabulary that no other feature uses; navigation, settings or access are starting to group by capability.
- **2 → 3:** a module needs to be built, tested or owned separately (a team boundary); a module's code is reaching into another module's internals and the folder rule alone is not holding; build or spec time of the whole project dominates a module-local change; a capability is gated by entitlement or audience and must be provably absent for others.
- **3 → 4:** one module needs to ask another a question or react to its events. Introduce the contract at the first such need; do not add a project reference between modules "just for now".

**Start modular from day one** (at stage 2 or 3) when the shape is already known: several teams will work in parallel; the product has clearly separate business capabilities; capabilities are gated by entitlement or audience; or it is a known product line that will have more modules. A prototype, a single-purpose service or one team with one capability starts at stage 1.

## Invariants at every stage

1. **Vertical slices.** The slice (command, events, projection, component, specs) is the unit at every stage; a stage changes what *groups* slices, never what a slice is. Never split by artifact type.
2. **Dependencies point down.** Modules and engines reference the platform; the platform references Infrastructure and Components; nothing references the host. Infrastructure and Components import no module and no domain concept.
3. **No `InternalsVisibleTo`, ever.** If code does not compile without it, the code belongs in a lower project or the dependency must become a contract.
4. **Every folder under the source root is a real project or package with a `README.md`.** No loose code folders and no empty umbrella folders. The README is short and states only what the code shows (template below).
5. **Specs live with their code** (a slice's `when_*` folders next to the slice) and are not analyzed by analyzers; see [fast-feedback.md](./fast-feedback.instructions.md).
6. **Namespaces match folders** at every stage. A folder move that changes a namespace is a change of identity, see the next invariant.
7. **Identities are stable across moves.** Chronicle derives event type ids and observer ids from names; routes, settings keys and stored type names are identities too. A move relocates code and keeps its identities. Pin an identity (an explicit `[EventType("…")]` id, an explicit observer id) before any rename or namespace change, and verify by checking that the discovered identities are unchanged. Changing an identity deliberately is a migration (**cratis-chronicle-event-type-migration**), never a side effect of a refactor.

## Module anatomy (stages 3 and 4)

A module is self-contained: its backend, frontend and specs sit together under one folder.

- **One module declaration.** A single type (for example an `IModule` implementation) states the module's key, display name and **audience** (who can have it: everyone, an entitled subset, internal). Everything else about the module hangs off it.
- **One backend project and one frontend package** per module. Contracts, when needed, are a second backend project (`<Module>.Contracts`) with no logic.
- **Routes, navigation and settings are the module's own** and register by convention (discovery of the module's contributions, found through `IInstancesOf<>` or the equivalent), not by the host naming the module. Platform and engine code never names a module.
- **A `README.md`** in the template below.
- **Cross-module questions and notifications go through contracts:** a service or grain interface to ask, a public event to be told. A module never uses another module's commands, read models, reactors or internal concepts.
- **Frontend boundaries mirror the backend:** a package imports another module's package only through its public exports (never a deep path), imports between two modules never go in both directions, and the shared components package imports no module.
- **Wiring is by convention:** default `IFoo` → `Foo` binding and lifetime attributes; explicit registration only for factories, options, multiple implementations and third-party types.

### README template

```markdown
# <Project or package>

<One paragraph: what it is for and who uses it.>

## Owns
- Namespaces and, for a module: its key and audience.

## Exposes
- Contracts, routes, settings sections and other contributions others may rely on.

## Depends on
- Project references and packages it imports, and why.

## Target
- Where it ends up in the next stage, and what still couples it.
```

## Growing safely

- **Move-only steps.** A growth step moves code with `git mv` (history is kept) and changes nothing else: no behavior edit, no rename, no refactor in the same commit. Build and run specs after each move.
- **Ratcheting architecture gates.** Record today's coupling as a baseline — seams (temporary allowances), cross-module `using`s, project references between modules, frontend boundary violations — and fail the build when any baseline **grows**. A baseline only shrinks: removing an entry is celebrated, adding one is a failure. Never loosen a baseline to make a change pass; fix the dependency.
- **A seam is a debt with an exit.** A temporary allowance names the project it would move to or the contract that replaces it; an unowned seam is a defect.
- **Gates are cheap and run locally**, in the same pass as the build, per [fast-feedback.md](./fast-feedback.instructions.md).

## See also

- **cratis-application-growth** — the step-by-step procedure for each move.
- [vertical-slices.md](./vertical-slices.instructions.md), [application-profile.md](./application-profile.instructions.md), [react.md](./react.instructions.md), [components.md](./components.instructions.md).
- **cratis-multi-service-architecture** — when modules become separately deployed services.
