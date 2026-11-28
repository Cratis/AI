# Application growth stages

These are application structure conventions, not framework admission rules. Keep whole vertical slices together. Choose the smallest stage justified by today's needs; skip a stage only when a later signal is already present.

## Stages and promotion

| Stage | Shape | Signal to move here |
| --- | --- | --- |
| 1 | One backend project and one frontend package; feature/slice folders. | Default for a prototype, single-purpose service or one team with one capability. |
| 2 | Named module folders containing whole feature/slice folders in the same projects. | People recognize distinct capabilities, with different vocabulary or navigation, settings or access grouped by capability. |
| 3 | Each module has a backend project and frontend package; the host composes modules on purpose-specific platform projects. | A module needs separate build, specs or ownership; other modules reach into its internals; or an audience or entitlement boundary needs enforceable separation. |
| 4 | Publish `<Module>.Contracts` for a module others depend on. | At the first cross-module request or event dependency. Share service or grain interfaces, public events and the concepts they carry, not commands, read models or internal logic. |

For a new application with several teams, distinct capabilities, audience gating or known product-line modules, start at stage 2 if folders suffice; start at stage 3 only when separate ownership, build or enforcement already applies. Do not build empty contracts in anticipation. A separate deployment is a service-boundary decision, not another folder move.

## Allowed references

| Owner | May reference |
| --- | --- |
| Host | All layers it composes; nothing references the host. |
| Module | Other modules' or engines' contracts, platform and foundations; never a peer module implementation or an integration provider. |
| Integration provider | Its integration base and the owning module's contracts (ports). |
| Platform or engine | Other platform contracts and foundations, never modules or their contracts. |
| Contracts | Other contracts and Infrastructure; no implementation logic or cycles. |
| Foundations (Infrastructure, shared Components) | Framework packages; no domain concepts or modules. |

Packages follow the same boundary: import a peer only through its public entry point, never in both directions. Enforce audience and entitlement on backend operations, not only navigation.

## Architecture gates

Use fast specs for: no friend-assembly grants or cross-project file inclusion; only the host references module projects; permitted layer references; platform and foundations name no module or domain concept and modules name no integration provider; no loose source outside projects/packages and every project/package has a README; namespaces match folders except for recorded migration exceptions; no cyclic or deep frontend imports and no module import from shared components. Count these gates from project files or compiled assembly references rather than import statements for project coupling. Track exceptions per gate in committed baselines that only shrink.

## What a rename changes in .NET

Moving a file without changing its namespace or assembly normally leaves identity intact. Inventory and plan any persisted or public changes before a rename:

- Chronicle event IDs default to the simple type name. Preserve the old name or pin its ID with `[EventType("id")]`. Observer IDs for reactors, reducers and projections default to full type names; pin the explicit ID or plan the transition, since a fresh observer ID can replay history. Plan read-model ID migration or a rebuild when a full type name changes. See the event-type migration skill when deliberately changing an event contract.
- Arc route paths derive from the namespace with `SegmentsToSkipForRoute`; generated proxy paths use `CratisProxiesSegmentsToSkip`. Review updated callers, generated paths and package ownership. Use `AssemblyToPackageMapping` when a referenced assembly's proxies belong to a different package.
- Check persisted type names, especially assembly-qualified job identities, against the actual serialization and registration. Preserve `AssemblyName` during a project rename or plan the persisted-name migration before deployment. Audit custom name-based access rules, configuration and filters; make identity explicit before the move.
