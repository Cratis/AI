<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Scene in a rendered application

## Contents

- What Scene is
- Packages and ownership
- Runtime capabilities

Runtime source evidence retained at Scene v4.21.0 (not reverified at the newer
Scene release now listed in [scaffold pins](rendered-application.md)):
Scene `README.md`, `Documentation/package-hosting.md`, and
`Source/JavaScript/{model,engine,react,components}/**`. Stage package selection
was re-read at Stage `v4.83.0:Source/Rendering.Cratis/Scaffolding/CratisFrontendPackageSet.cs:208-229`
(`Current`); dependency names are in `CratisFrontendApplicationScaffold.cs` (`Dependencies`). This is not a render
or browser test.

## What Scene is

Scene is the **experimental**, platform-neutral UI object model and runtime of
the model-first stack: Screenplay describes the application; Stage emits it;
Scene represents and renders its UI. Studio's design-time tools edit this model.
`Cratis.Scene.Model` / `@cratis/scene.model` hold screens, layouts, forms,
templates and profiles. `Cratis.Scene.Engine` / `@cratis/scene.engine` resolve
bindings, navigation and packages. `@cratis/scene.react` is the React renderer.

A hand-built React application consuming Components does not need Scene. A
Scene-rendered screen and a hand-built Components page share the controls, not
ownership or host APIs. Do not add Scene merely to build a DataPage.

## Packages and ownership

The npm family is `@cratis/scene.model`, `@cratis/scene.engine`,
`@cratis/scene.react`, `@cratis/scene.components`, `@cratis/scene.primereact`,
`@cratis/scene.blueprint.default`, `@cratis/scene.blueprint.components`, and
`@cratis/scene.tailwind`. `@cratis/scene` is not this product's package id.
Stage pins six members at the shared version in the scaffold table; it does not
install every family member. `@cratis/scene.components` maps Components onto
Scene and offers a runtime-only `/runtime` entry (no design-time bundle).
Its Components peer range is `^4.13.0`, not Stage's exact scaffold pin.

Stage manages `scene.json`, `src/bindings.ts`, the generated host and runtime
files through `.cratis-render.json`. Change the accepted `.play` model and render
again, never hand-edit those files or bump their dependencies. `Customizations/`
is the user-owned seam; it cannot repair rejected model admission. A Scene
release is not a Stage release and does not prove Stage emits a new capability.

## Runtime capabilities

At the current scaffold Scene release (4.21):

- `Screen.path` and `NavigationItem.hierarchy` describe module/feature paths,
  outermost first. Nested `core:outlet` composition keeps parent screens visible.
- `createBrowserSceneHistory` and `createHashSceneHistory` support deep links
  and back/forward. Dialogs are history entries; `closeDialog(result)` closes them.
- Inputs publish `value` through `useValueOutput`. Command actions resolve
  `component.<id>.<output>` via `resolveArgumentSource`. `useBoundQuery` reruns
  on changed arguments, aborts prior runs and discards stale answers; cleared or
  failed bindings remove the previous data.
- `core:toolbar` / `core:toolbarItem`: Action items announce the command and
  resolved parameters with `cratis.scene.command`; Navigate/Dialog items use
  the navigation host, or announce navigation outside one. Host wiring is still
  required to execute commands.
- The default blueprint supplies `MasterDetail`; the Components blueprint has
  `SettingsPage`. Object descriptors support nested `properties` and `open`.
- `ApprovedPackageSet`, `loadApprovedPackages`, and `resolveApprovedPackageHost`
  match declared packages to runtime bundles. The host approves executable
  imports and network assets; an explicit importer map is not arbitrary module
  loading. Diagnostics block mismatched or unavailable bundles.

Keep authoring acceptance, executable admission and runtime behavior separate.
Require Stage's plan/diagnostics for emission and a browser run for UI parity;
source verification alone proves neither. For authoring details read
`cratis-screenplay-ui-composition/references/screen-composition-contract.md`.
