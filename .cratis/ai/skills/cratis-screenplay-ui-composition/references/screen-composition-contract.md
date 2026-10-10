<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Screen composition contract

## Contents

- Support levels
- Data context and component bindings
- Guarded actions
- Exposed template configuration
- Forms and columns
- Packages, icons and template catalogs
- Routes, outlets, toolbars and dialogs
- Design-time generation results
- Canonical fixture ownership

This reference is the authoring checklist for the screens-release UI surface. It
records the contract an agent must look for in the installed Screenplay tool and
in peer runtime/render contracts; it is not a second language definition. When a
syntax form below is not present in `syntax-schema` or does not compile with the
project's selected Screenplay version, report the support level instead of
hand-writing an alternate shape.

## Support levels

- **Authoring accepted**: the Screenplay parser, printer and MCP `syntax-schema`
  know the node. It may still be deferred from executable admission.
- **Executable admitted**: MCP executable diagnostics report no blocking errors for
  the construct in the current compiler.
- **Runtime implemented**: Stage, Studio or Scene consumes the authored construct
  without dropping it, silently falling back or replacing it with a default.

Keep those three lines separate in reports. Correct an old limitation only when
the package/version you are using proves the new level. Verified public vector:
CLI 3.43.0 with its default `cratis/stage:4.52.0` and bundled Screenplay 4.127.0;
latest public packages are Scene 4.15.0, Screenplay 4.129.0, Stage 4.57.0 and
Studio 0.144.4. All three levels hold for the canonical `ScreenComposition`
corpus:

- authoring and executable admission: MCP opens it with `sourceSuccess true`,
  `semanticSuccess true`, `executableReady true`, and the stdio MCP harness sends
  real proposal/apply requests, rejects a stale revision and preserves an
  authored comment on disk;
- runtime: render publishes, and the browser acceptance run on CLI 3.40.7 /
  `cratis/stage:4.51.1` passed 51 assertions with none blocked or pending
  (Cratis/Screenplay#605) - native command forms, required fields, scoped
  comments, deep links, stale-response handling and theme included. On CLI
  3.43.0 an agent-edited column was rendered, run and seen in the browser.

Still true: a guarded Close action and a double-click interaction are refused
(`STAGE-SCENE-ACTION-001`, `STAGE-SCENE-INTERACTION-001`, defined from Stage
4.51 through 4.57) and recorded as unsupported, never emulated; Studio production
Play proof is pending a test-account decision. Refusing an unresolvable UI
profile and recovering a rendered application shipped in Cratis/cli#301. On Stage 4.24.2 or cratis 3.28.x
renderers, authored screens are still reported as omitted/default composition.

## Data context and component bindings

A component instance is a presentation of a typed Screenplay data context. The
proposed syntax is:

```screenplay excerpt
component <Package.Component> <instanceName>
  context <binding>
  property <property.path> from <binding>
  property <property.path> = "literal"
  icon <IconName>
  presentation <key> "value"
  exposes <name> from <binding>
  outlet <name>
    ...nested screen directives...
  on click
    open dialog <DialogTemplate>
      with <name> from <binding>
```

Rules for agents:

- Discover the exact node shape through `syntax-schema` before proposing it; do
  not infer JSON members from this prose.
- Every `context` and every `from` binding must trace to a screen `data`, command
  form value, route parameter, selected item, dialog input, `$context` value or an
  exposed template value. An untraced binding is a model defect.
- `property ... = "literal"` is static presentation configuration. A dynamic value
  uses `from` and keeps its source visible.
- `icon` names a package-qualified or profile-selected icon. Do not hard-code a
  renderer-specific icon library when the UI profile has not selected it.
- `presentation` keys are renderer/package inputs. They are authoring data, not a
  styling escape hatch; unknown keys must be surfaced by the consumer contract,
  not ignored.
- An `outlet` is a nested replacement surface; it can hold screen directives and
  can be targeted by navigation or a dialog route when the runtime contract
  supports it.

## Guarded actions

A label-headed screen action can select one command through authored-order
`when item.<path> ... execute ...` alternatives. First match wins; last
`otherwise execute` supplies a fallback, while `otherwise hidden` or omission
hides an unmatched action. With no item (loading/no selection), always hide it.
Explicit with-bindings, matching subject fields, form inputs and renderer input
fill the chosen command in that order. Authorization denial is not another
selector and never falls through. Refresh if a click-time check changes the
choice the user saw.

Missing fields are not null; == null matches explicit null only. Guards are
presentation offers, never access control. Downstream runtime support is separate
from parsing; do not publish an empty plain action as equivalent behavior.
The complete checked model and conditions are in
`cratis-screenplay-read-surface` `references/guarded-actions.md`, grounded in
Screenplay v4.125.0 `screens.md`. CLI 3.41.0/Stage 4.51.3 reports unsupported
screen actions with STAGE-SCENE-ACTION-001, not proof of runtime selection.

## Exposed template configuration

Reusable templates can expose configuration and typed outlets:

```screenplay excerpt
screen template MasterDetail
  category workflow
  type master-detail
  exposes selectedInvoice InvoiceId
  outlet toolbar
  sidebar
  main
```

- `category` is used for template discovery and scope-aware catalogs. Suggested
  categories are stable product taxonomy, not renderer folders.
- `type` is the template kind a runtime/package recognizes.
- `exposes` declares values that slot bodies or nested components may bind to; a
  use site must provide or derive each required exposed value.
- `outlet` declares an addressable child surface. It is different from a static
  slot such as `sidebar` or `main`.

A module, feature or slice may select a default template for contained screens:

```screenplay
module Sales
  template MasterDetail
```

Treat this as inherited UI structure, not as copied directives. Check the
installed parser/printer supports the scoped `template` directive before using it.

## Forms and columns

A form remains bound to exactly one command. The screens-release additions make
its generated fields explicit when the automatic shape is not enough:

```screenplay excerpt
form RegisterInvoiceForm for RegisterInvoice
  columns auto
```

or:

```screenplay excerpt
form RegisterInvoiceForm for RegisterInvoice
  columns manual
    column invoiceNumber label "Invoice #"
    column total label "Total"
```

Use `auto` when the command shape is the form. Use `manual` when order, labels,
visibility or grouping matters. Every manual column is a command property; a
missing command property is fixed on the command, not by inventing a UI-only
field.

## Packages, icons and template catalogs

`ui profile` owns package priority and icon sets:

```screenplay excerpt
ui profile Desktop
  target platform web
  layout AppShell
  packages
    Product.DesignSystem
    Cratis.Components
  icons Product.Icons
```

- Package order is still override-priority order. Later packages shadow earlier
  ones only if the runtime contract says so; otherwise report an ambiguity.
- Component package metadata (kind, icon, scope, applicability and templates) is
  owned by the Scene/runtime package catalog. In the model, refer to it by package
  and component names; do not copy catalog JSON into `.play`.
- Template categories are scope-aware: application templates, module templates and
  package templates can share labels. Qualify where the tool reports ambiguity.

## Routes, outlets, toolbars and dialogs

Navigation and toolbar items target the same typed destination contract: screen,
named outlet, optional route parameters, and optionally a dialog.

```screenplay excerpt
toolbar InvoiceToolbar
  item register action RegisterInvoice
    label "Register"
    icon Add
  item details navigate to InvoiceDetails
    parameter invoiceId from selected.invoiceId
```

Use a toolbar for reusable groups of actions; use inline `action` when a single
screen owns the button. Dialog opening stays an interaction (`on click open dialog
<DialogTemplate>`) unless the installed language exposes a dedicated toolbar-dialog
node. A dialog destination must state every input with a typed `with`/`parameter`
binding; a runtime default is not an authored contract.

## Design-time generation results

Design-time actions belong to component packages, not to the model and not to an
agent. Scene 4.15 declares them as data (`PackageDesignTimeMetadata`) and ships
their code in an optional design-time bundle; a runtime host that does not set
`loadDesignTime` loads none of it, so nothing a design-time action does can exist
only at runtime. The one Cratis action today is **Generate fields**
(`Cratis.Components.commandForm.generateFields`):

- it is visible only on a `commandForm` and enabled only when the command's
  metadata is known **and** the form has no `inputs` yet, so it never overwrites
  fields someone already laid out;
- it is deterministic: one field per command property, in command order,
  labeled from the property name, alternating between two columns;
- its result is a batch of `SetProperty` edits on the form's `inputs`, submitted
  to the host whole or not at all.

The model is where that result lives, not the callback. When you author a form as
an agent:

- Do not record, serialize or reproduce the package's generator code, and never
  invent a design-time hook in `.play`. Screenplay holds no callbacks.
- If the generated layout is the command shape, write `columns auto`; the
  renderer reaches the same result from command metadata.
- If someone changed it (order, labels, dropped fields), write `columns manual`
  with one `column <property> label "..."` per kept command property, in order.
  That is the durable representation of an edited Generate fields result, and it
  is why the action stays disabled on that form afterwards.
- Make the change through the MCP proposal/apply loop like any other edit, then
  render: a manual column that is not a command property is a model defect, not a
  generator defect.

Generated design-time output is evidence only when it is compared with the model:

- every screen, template, form, toolbar, component instance and outlet has an
  entry in the generated plan/report;
- every unsupported construct is reported as a blocking diagnostic, not silently
  dropped;
- the same model root, workspace export and package set are used by MCP, Studio,
  Stage and the runtime smoke test;
- package versions and image tags are printed with the check.

A screenshot, Storybook story, or rendered app that omits a modeled directive is
not a partial pass. It is either an unsupported construct with a diagnostic, or a
bug in the consumer.

## Canonical fixture ownership

Use the Screenplay-owned canonical corpus: the positive typed screen case lives
at `Source/DotNET/Screenplay.CanonicalCorpus/Corpus/ScreenComposition/v1/source/folder`
in the Screenplay repository. It demonstrates the released syntax for screens
with templates (`MasterDetail`), `data … via query` bindings, typed table
columns, `on row-click navigate to <Screen> by <param>`, sections, conditional
`when … execute … with … from …` actions and localized labels.
The AI corpus may link to that path and name the expected checks, but must not copy
the `.play` source into `.cratis/ai/` or maintain a second canonical application.
