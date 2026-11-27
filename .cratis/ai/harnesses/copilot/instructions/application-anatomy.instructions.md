---
applyTo: "**/*.csproj,**/*.slnx,**/Directory.Build.props,**/Directory.Build.targets,**/Directory.Packages.props,**/package.json,**/tsconfig*.json"
profile: application
paths:
  - "**/*.csproj"
  - "**/*.slnx"
  - "**/Directory.Build.props"
  - "**/Directory.Build.targets"
  - "**/Directory.Packages.props"
  - "**/package.json"
  - "**/tsconfig*.json"
---
<!-- cratis-ai: generated Copilot instructions. Do not edit; rules/ is the source. -->

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Application anatomy for growing systems

> **Application profile.** This is how the source tree of an application built on Cratis is shaped as it grows. It does **not** apply inside a Cratis framework repository (see [framework.md](./framework.instructions.md)). What goes in one behavior folder is [vertical-slices.md](./vertical-slices.instructions.md); the procedure for a move or a rename is the **cratis-application-growth** skill.

Lines are **[convention]** (house default; the framework does not check it) unless tagged **[contract]** (Arc, Chronicle or Fundamentals behave this way). Conventions hold only when the repository's own architecture gates enforce them; see *Gates* below.

An application's anatomy is a **path, not a choice made once.** Start at the smallest stage the product needs and grow when a signal says so. Skipping a stage is fine; building a later stage's structure before its signal appears is not.

## Words used here

- **Module**: one business capability (for example Billing or Support) with its own backend, frontend and specs.
- **Host**: the one project that composes and runs everything. Nothing references it.
- **Platform project**: code several modules need, or that no module owns. It never names a module.
- **Engine**: a platform project that holds reusable behavior with its own events and read models (a rules engine, a work queue). Modules plug into it; it knows no module.
- **Contracts project** (`<Module>.Contracts`): what a module lets others use: public events, grain or service interfaces, and the concepts they carry. No logic.
- **Seam**: a file that lives in one project's folder but is compiled into another project (a `<Compile Include="../Other/**" />`). It hides a dependency the project graph would reject.

## The stages

| Stage | Shape | What it buys |
| --- | --- | --- |
| **1. One project** | One backend project and one frontend package; behaviors are `<Feature>/<Slice>/` folders. | Least ceremony; one build; cohesive slices. |
| **2. Modules in one project** | Features grouped under named top-level folders (`<Module>/<Feature>/<Slice>/`), still one backend project. | Names the capability boundaries before paying for project boundaries. |
| **3. Module projects on a platform** | Each module is its own backend project and frontend package, composed by the host, on platform projects. | The compiler enforces boundaries: a module cannot use what it does not reference. |
| **4. Modules publish contracts** | A module others need exposes `<Module>.Contracts`. No module references another module's project. | Modules change and are owned independently. |

Separately deployed services are a further step; see **cratis-multi-service-architecture**.

## When to move up

Move when a signal is present *now*, not when it is imaginable:

- **1 → 2:** people name a group of features as a capability; features share vocabulary no other feature uses; navigation, settings or access group by capability.
- **2 → 3:** a module needs separate build, specs or ownership; code reaches into another module's internals and the folder rule alone is not holding; a capability is gated by entitlement or audience and must be provably absent for others.
- **3 → 4:** one module needs to ask another a question or react to its events. Add the contract at the first such need.

**Start at stage 2 or 3** when the shape is already known: several teams, clearly separate capabilities, entitlement or audience gating, or a product line that will gain modules. A prototype, a single-purpose service or one team with one capability starts at stage 1.

## The layers and what may reference what (stages 3 and 4)

| Layer | Examples | May reference |
| --- | --- | --- |
| Host | `Core` or `Host` | everything below; composes modules, integrations and engines |
| Modules | `Billing`, `Support` | other modules' `.Contracts`, engines' `.Contracts`, platform, Infrastructure, Components |
| Integration providers | `Integration.GitHub` | the `Integration` base and module `.Contracts` (ports) only |
| Engines and platform | `Notifications`, `Search`, `Integration`, `Mcp` | other platform `.Contracts`, Infrastructure, Components |
| Contracts | `Billing.Contracts`, `Tenancy.Contracts` | Infrastructure and other contracts only |
| Foundations | `Infrastructure`, `Components` | framework packages only; no domain concept, no module |

**References point down only.** If code compiles only with a reference that points up or sideways, the code is in the wrong project or the dependency must become a contract.

## Invariants at every stage

1. **Vertical slices.** The slice (command, events, projection, component, specs) is the unit at every stage. A stage changes what *groups* slices, never what a slice is. Never split by artifact type.
2. **No `InternalsVisibleTo`, no seams.** Both make a project boundary a folder name and nothing else. Code that needs either belongs in a lower project, or its dependency becomes a contract.
3. **No catch-all project.** A project named for its position rather than its purpose (`Global`, `Shared`, `Common`, `Base`) grows until it depends on the modules that depend on it. Every platform project has one purpose that its name states; a stage-1 `Common/` folder of concepts is fine.
4. **Every folder under the source root is a project or package with a `README.md`.** No loose code folders, no umbrella folders. The README states only what the code shows (template below).
5. **Specs live with their code** and are left out of analyzers and Release output by one shared pattern; see [fast-feedback.md](./fast-feedback.instructions.md).
6. **Namespaces follow projects and folders:** `<Company>.<Product>.<Project>.<folder path>`, so a namespace tells which project owns a type. That is the end state; while code is moving, namespaces stay put (see the next section). Project folders carry no product prefix (`Source/Billing`, not `Source/MyProduct.Billing`); the prefix lives in the root namespace, set once in `Directory.Build.props`.
7. **A namespace or assembly name is an identity, not a label.** See the next section before renaming either.
8. **Access is declared, never derived from a name.** Authorization, audience and admin-only rules sit on the code (an attribute, a policy, an assembly marker), never on a namespace prefix or folder; otherwise a rename silently changes who may read what.

## What a rename changes **[contract]**

| Identity | Derived from | Can it be pinned? |
| --- | --- | --- |
| Chronicle event type id | the type's **simple name** (namespace-independent) | yes: `[EventType("id")]` |
| Reactor, reducer and projection ids | the type's **full name** | yes: an explicit id on the attribute |
| Read model identifier | the type's **full name** | no: stored identifiers are rewritten, or the read model rebuilds |
| Arc model-bound command and query routes | the **namespace** (minus `SegmentsToSkipForRoute`) | no: every caller and proxy follows the new route |
| Generated proxy folders | the **namespace** (minus `CratisProxiesSegmentsToSkip`) | no |
| Stored grain state type names and job type names | full type names; job names are assembly-qualified | keep `AssemblyName` when a project is renamed; retire old names deliberately |
| Anything your code keys on a name | authorization prefixes, OpenAPI filters, build strip lists, settings keys | replace with explicit declarations first |

Consequences:

- **Moving a file is free; renaming its namespace is a migration.** While the structure moves, keep namespaces and assembly names, and record every folder whose namespace no longer matches in an allowlist that only shrinks. One exception: a job type that moves to another assembly changes its assembly-qualified stored name, so rewrite the stored names (or keep a type forwarder in the old assembly) in the same release.
- **Rename namespaces once, in one window**, with a repair that rewrites the stored identities (observer ids, read model identifiers, grain and job type names) before the new version starts. Without it every observer registers under a new id and replays from the first event: projections rebuild and reactors act on history again. Chronicle's `ArtifactIdentityDrift` setting reports likely renames; it does not repair them.
- **Event types:** an explicit id or an unchanged class name keeps the identity across any namespace change. Changing an event deliberately is **cratis-chronicle-event-type-migration**; removing a project removes its event types, which is also an event-store change.

## Module anatomy (stages 3 and 4)

- **One module declaration.** A single type (for example an `IModule` implementation) states the module's key, display name and **audience** (everyone, an entitled subset, internal). The key is an identity; keep it when the module's name changes.
- **One backend project and one frontend package** per module, plus `<Module>.Contracts` when others need it.
- **The module contributes its surfaces by convention:** routes, navigation, settings sections, tools for an MCP server, API endpoints, rule packs. The base that hosts a surface discovers contributions (through `IInstancesOf<>` or the equivalent) and never names a module; no central route table or menu list.
- **Audience and entitlement are enforced on the server** (commands and queries), not only by hiding navigation.
- **Ask through an interface, be told through an event.** A question or request is a grain or service interface in the owner's contracts; "tell me when" is a public event. A module never uses another module's commands, read models, reactors or internal concepts.
- **Ports for providers.** When a module needs something an external provider supplies, the module defines the port in its contracts and each provider project implements it. A module never names a provider; adding a provider is adding a project.
- **Frontend boundaries mirror the backend:** a package imports another module's package only through its public entry point (no deep paths), never in both directions, and the shared components package imports no module. Each backend project generates its proxies into its own package and maps referenced projects with `AssemblyToPackageMapping`, so a type is generated by its owner only.
- **Wiring is by convention:** the default `IFoo` → `Foo` binding and lifetime attributes. **[contract]** The convention binds only when the interface and its single implementation share a namespace, and it fills only service types nobody registered. An interface in `<Module>.Contracts` with its implementation in the module therefore needs an explicit (or generated) registration, applied after the explicit ones.

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
```

## Gates

Prose does not hold a boundary; gates do. Write them as ordinary specs that read the project files and sources, so they run in the normal spec pass in seconds:

- no `InternalsVisibleTo` and no seam (no `Compile Include` reaching outside the project folder);
- only the host references a module project; nothing references the host;
- platform and Infrastructure name no module and no domain concept; a module names no integration provider;
- every source folder has a project or package and a `README.md`;
- namespace matches folder, except allowlisted entries;
- frontend: no two-way package imports, no deep imports past a package's entry point, the components package imports no module (an ESLint rule).

Each gate compares against a committed baseline that **only shrinks**. A change that removes coupling shrinks the baseline in the same commit; a change that grows it fails. Never raise a baseline to land a change. Count dependencies from project files or compiled assemblies, not `using` lines.

## See also

- **cratis-application-growth**: the procedure for each move and for the rename window.
- [vertical-slices.md](./vertical-slices.instructions.md), [application-profile.md](./application-profile.instructions.md), [react.md](./react.instructions.md), [components.md](./components.instructions.md).
- **cratis-multi-service-architecture**: when modules become separately deployed services.
