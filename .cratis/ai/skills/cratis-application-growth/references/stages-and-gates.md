<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Application stages and gates

These are application layout conventions, not framework requirements. Keep a slice intact at every stage. Move only for a signal that is present now.

| Stage | Shape | Signal for entering |
| --- | --- | --- |
| 1. One project | One backend project and one frontend package. Group by feature and slice. | Default for a prototype, a single-purpose service or one team with one capability. |
| 2. Module folders | Group features by business capability in top-level module folders, still in one project. | Features share distinct vocabulary, or navigation, settings or access already group by capability. |
| 3. Module projects | Give each module a backend project and frontend package. The host composes them on shared platform projects. | Separate build, specs or ownership are needed; code reaches across folder boundaries; or audience or entitlement boundaries need to be proved. |
| 4. Contracts projects | Add `<Module>.Contracts` where another module needs a public event, service or grain interface, or a concept it carries. Keep implementation out. | The first cross-module request or reaction. |

Start at stage 2 or 3 only when the shape is already clear: clearly separate capabilities, several teams, explicit audience or entitlement gating, or a defined product line with additional modules. Choose stage 2 unless the reason already needs a project boundary. Do not build empty contracts in anticipation.

## Allowed references

- Nothing references the host. The host composes modules, platform, engines and integration providers.
- Modules reference platform and foundations, and use other modules or engines only through their `.Contracts` projects. They never reference another module's implementation or name an integration provider.
- Integration providers reference the integration base and the contracts defining their ports.
- Platform and engines reference platform contracts and foundations only, never a module or its contracts. Contracts reference only other contracts and infrastructure; do not introduce cycles. Foundations depend on framework packages, not modules or domain concepts.

## Gates

Run these as ordinary specs. Count references from project files or compiled assemblies, not import statements.

- No seams (source files compiled into another project's build) or `InternalsVisibleTo` grants.
- Only the host references module implementations; no platform-to-module references or dependencies pointing back to the host. Check module-to-module references against the contracts boundary and module-to-provider references against the port boundary.
- At the project/package level of the source root, each folder belongs to a project or package with a `README.md`. Namespaces follow folders except for explicitly allowlisted moves awaiting the rename window.
- Frontend packages use public entry points, never deep imports or imports in both directions. Shared components import no module.
