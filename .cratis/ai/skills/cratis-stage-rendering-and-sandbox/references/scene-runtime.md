<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Scene in a rendered application

## Contents

- What Scene is
- Packages and ownership
- Runtime capabilities

## What Scene is

Scene is the platform-neutral UI object model and runtime of
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
Stage installs six members at one shared version (see the rendered `package.json`); it does not
install every family member. `@cratis/scene.components` maps Components onto
Scene and offers a runtime-only `/runtime` entry (no design-time bundle).
Its Components peer range is a range, not Stage's exact scaffold pin.

Stage manages `scene.json`, `src/bindings.ts`, the generated host and runtime
files through `.cratis-render.json`. Change the accepted `.play` model and render
again, never hand-edit those files or bump their dependencies. `Customizations/`
is the user-owned seam; it cannot repair rejected model admission. A Scene
release is not a Stage release and does not prove Stage emits a new capability.

## Runtime capabilities

The scaffold's Scene runtime provides:

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

Requires Stage 4.130.0 for Stage shell selection from `ui profile` root template,
options and appearance; older hosts do not apply that complete shell contract.
The Host and render plan use Scene's shell resolution: root, legacy layout,
default blueprint layout, then bare shell. Unknown/unavailable/version-mismatched
roots and roots lacking a `content` outlet produce planning findings or an explicit
Host startup message, never silent fallback. Shell options such as `navigationMode`,
`menuTheme` and `showFooter` are applied or reported unsupported. Light/dark/system
color scheme and accent reach the shell; runtime Scene carries root, appearance
and defaults but no sample data. Browser evidence is still needed for UI parity.

Keep authoring acceptance, executable admission and runtime behavior separate.
Require Stage's plan/diagnostics for emission and a browser run for UI parity;
source verification alone proves neither. For authoring details read
`cratis-screenplay-ui-composition/references/screen-composition-contract.md`.
