# The application shell: navigation and toolbar outlets, template references and sample data

## Contents

- Default shell
- One complete shell
- Navigation outlets: inherit, extend or override
- Toolbar buttons that invoke a State Change slice
- Feature and module toolbars
- Template references, categories and blueprints
- Sample data packs
- Shapes the compiler refuses
- Editing the shell through MCP
- Render and verify
- Review checklist

Requires Screenplay 4.180.0 or later (`screenplay --version`) for slice buttons, blueprint references and sample
data packs, and Screenplay 6.0.0 or later for navigation and toolbar outlets (`outlet <name> of
navigation|actions`); a model still written as `navigation topbar|sidebar` or a feature/module `toolbar <name>` is
a Screenplay 6 error (`PLAY0894`, `PLAY0896`) that `screenplay migrate --from 5 --to 6` rewrites. Also requires
Cratis CLI 3.67.0 or later (`cratis --version`) for `cratis render` and `cratis run` to carry the shell at all, and a
Cratis CLI release that bundles Screenplay 6.0.0 or later for that render to admit outlets specifically; compare
`cratis --version`'s bundled Screenplay against the release that introduced outlets before relying on a rendered
shell, not on the standalone tool's version alone. An older compiler answers `PLAY0001`, `PLAY0022` or `PLAY0103`
for the lines below; that is the version, not the model.

Every construct here is authoring syntax. The executable model defers it (`PLAY0269`), Stage plans it from the syntax
tree, and none of it changes a backend. The Scene designer, the Stage runtime and Studio read the same lines, so the
Screenplay is the one place to write them.

## Default shell

Requires Stage 4.189.3 or later (the CLI that bundles it) for a rendered frontend to get a default application shell without a
`layout` or `ui profile`. Declare a `layout` and a `ui profile` only to customize that shell
(navigation, logo, templates, sample data), as below.

## One complete shell

```screenplay
layout AppShell
  category application
  topbar
  side
  content

  outlet topbar of navigation in topbar
    logo image "/assets/acme.svg" title "Acme"
    default sales title "Sales" icon receipt target Sales
    default support title "Support" target Support slot content
  outlet sidebar of navigation in side
    default sales title "Sales" icon receipt target Sales
      item orders title "Orders" target Sales.Orders
      item returns title "Returns" target Sales.Orders.Returns slot side
    default support title "Support" target Support

ui profile Desktop
  target platform web
  root template AppShell

  packages
    core
    Crm

  sample data
    active NordicDemo
    shape Customer maps to CustomerRow

sample data NordicDemo
  title "CRM · Nordic SMB"
  locale nb-NO
  shape Customer
    row
      name = "Fjordline AS"
      revenue = 125000.5
    row
      name = "Nordlys AS"
      revenue = 98000

module Sales
  outlet sidebar extends
    item customers title "Customers" icon people target Sales.Customers
  outlet topbar inherits

  template blueprint Crm Workspace version "^1.4"

  feature Orders
    feature Returns

    slice StateChange PlaceOrder
      command PlaceOrder
        orderId Uuid identifier
        reason String
        produces OrderPlaced
          for orderId
          reason = reason
      event OrderPlaced
        reason String
      screen PlaceOrder
        action PlaceOrder for screen

    slice StateView OrderList
      readmodel OrderRow
        orderId Uuid
        title String

      screen OrderList
        template blueprint Crm CustomerDetail version "~1.4.2"
          body
            title "Orders"
            toolbar actions
              button place title "New order" slice Sales.Orders.PlaceOrder emphasis primary icon plus

  feature Customers
    slice StateView CustomerList
      readmodel CustomerRow
        name String
        revenue Decimal

module Support
  outlet sidebar overrides
    item tickets title "Tickets" target Support.Tickets
  outlet topbar inherits

  feature Tickets
    slice StateView TicketList
      readmodel TicketRow
        title String
```

This is the canonical shell vector (`screen-shell-navigation-positive` in `Cratis.Screenplay.CanonicalCorpus`),
rendered by Stage with its sidebar, topbar, slice dialog and deep links. Start from it; do not invent the syntax.

## Navigation outlets: inherit, extend or override

Navigation is an [outlet](https://github.com/Cratis/Screenplay/blob/main/Documentation/screenplay/outlets.md): the
`layout` declares each navigation destination list with `outlet <name> of navigation`, one per region such as
`topbar` or `sidebar`; a `module`, `feature` or slice `screen` states how it relates to each outlet it changes with
`outlet <name> inherits|extends|overrides`. An outlet a level does not mention **inherits** the application's items.

| A level says | Items it shows | Choose it when |
| --- | --- | --- |
| nothing, or `outlet <name> inherits` | The application's items | The level needs no navigation of its own (the default) |
| `outlet <name> extends` | The application's items, then the level's own | The module adds items (a sales sidebar that also lists Customers) and keeps the application's |
| `outlet <name> overrides` | The level's own items only | The module replaces the whole outlet (a support area with its own sidebar) |

- Each navigation outlet has its own mode: a module can extend the sidebar and inherit the topbar.
- A navigation outlet declared on the layout has no mode, and the layout never says `inherits`, `extends` or
  `overrides`; a misplaced mode is `PLAY0897`.
- `logo image "<path>" title "<text>"` belongs to the layout's outlet only; a module that declares one is `PLAY0744`.
- An item is `item <id> title "<text>" [icon <name>] [target <Module>[.<Feature>]] [slot <name>]` (written `default`
  in place of `item` directly on the layout). The id is unique within its outlet, and an extending level never
  repeats an id inherited from above it (`PLAY0905`). The title is a quoted string or `$strings.<key>`.
- Any navigation outlet nests sub-items as `item` lines under a parent item — hierarchy is not sidebar-only.
- `target` names a module (the module's first feature) or a feature path. An item with no target needs sub-items, and a
  target the document does not declare is `PLAY0748`. A module with no feature warns (`PLAY0751`).
- `slot` names a layout slot the target renders into; without it the target renders into the primary content slot. A slot
  no layout declares is `PLAY0749`.
- **A module's own items may only target that module** (`PLAY0750`). To link elsewhere, put the item in the layout. This
  matters when switching a module from inherit to override: the copy of the application's items must be retargeted to
  the module's own features, or it is refused.
- An `overrides` outlet with no items leaves the outlet empty and warns (`PLAY0752`).
- `outlet <name> inherits|extends|overrides` naming an outlet no layout or template declares is `PLAY0903`;
  declaring the same outlet twice at one level is `PLAY0904`.

⚠️ A **slot** is a region content is placed in; navigation is an **outlet** (a named list of items), one outlet kind
among `actions`, `filters`, `tabs`, `stats` and `navigation`. Screenplay 5 wrote a slot's contribution point as
`<slot> contributes <Point>`; that form is an error since Screenplay 6 (`PLAY0895`), replaced by the slot alone plus
a separate `outlet <Point> of navigation in <slot>`. `contribute to <outlet>` still adds items to any outlet, from
any module or feature, without the level that owns the screens listing them (see `SKILL.md`); a new application
models its navigation with outlets and does not also generate contributions for the same entries.

## Toolbar buttons that invoke a State Change slice

A `button` is a toolbar entry that opens a State Change slice as a dialog over the page; the button needs no command of its
own.

- `button <id> title "<text>" [slice <Module>.<Feature>.<Slice>] [emphasis primary|secondary|quiet] [icon <name>]`.
- `slice` is a dotted path or any unambiguous suffix (`PLAY0764` when it matches several). It must name a slice the
  document declares (`PLAY0761`) and a **State Change** slice. A State View, Automation or Translate slice is `PLAY0762`;
  a button invokes State Change slices only.
- A button without a `slice` is legal while designing and warns (`PLAY0763`); never ship one.
- A button id is unique within the toolbar and shared with `item` names (`PLAY0765`).
- `item` entries (`action`, `navigate to`, `dialog`) stay valid beside buttons. Use `button` to start a slice, and
  `item ... navigate to` to go to a screen.

This is a screen's own `toolbar <name>` block, unaffected by Screenplay 6's outlet change. A feature or module that
adds the same buttons across every screen beneath it uses an outlet instead — see [Feature and module
toolbars](#feature-and-module-toolbars).

### Application-level buttons

Since Screenplay 6, a layout's navigation outlet carries destinations only; its buttons live in a paired actions
outlet the migration creates alongside it — `outlet topbarActions of actions` beside `outlet topbar of navigation`,
or `outlet sidebarActions of actions` beside `outlet sidebar of navigation` — so an action stays at hand whichever
page the user is on. An indented `authorize <Policy>` line under a button limits who sees it. A module's `outlet
topbarActions|sidebarActions extends|overrides|inherits` governs the buttons as it does the navigation items. An
item of the wrong kind for its outlet — a navigation item in an actions outlet, or a button in a `filters`, `tabs`
or `stats` outlet — is `PLAY0900`. The slice rules above (`PLAY0761`-`PLAY0765`) apply unchanged (decision 0098).

```text
layout AppShell
  category application
  topbar
  content

  outlet topbar of navigation in topbar
    default shop title "Shop" target Shop
  outlet topbarActions of actions in topbar
    button newProduct title "New product" slice Merchandising.Products.DraftProduct emphasis primary icon plus
      authorize CanCurateCatalog
```

⚠️ When a screen uses a `template`, put the `toolbar` inside a slot body (`body` above). Stage refuses a screen that
mixes a top-level `template` directive with other top-level directives.

## Feature and module toolbars

Requires Screenplay 6.0.0 or later (`screenplay --version`); Screenplay 5 wrote this as `toolbar <name>` on a
feature or module, which Screenplay 6 reports as an error (`PLAY0896`), replaced by an actions outlet.

A screen template declares `outlet <name> of actions [in <slot>]`. When the same actions belong to every screen of a
feature, write `outlet <name> extends` once on the `feature` (or on the `module` for every feature below it)
instead of repeating it on each screen: the entries are contributed to the outlet of every screen beneath it, sub
features included, after the levels above (the nearer level comes later), and each entry runs one command of the
feature. A screen that needs its own buttons keeps its own `toolbar`.

```text
module Merchandising
  screen template Page
    category Page
    header
    main
    outlet actions of actions in header

  feature Publication
    outlet actions extends
      button approve title "Approve product" slice Merchandising.Publication.ApproveProductForSale emphasis primary icon check
      button withdraw title "Withdraw product" slice Merchandising.Publication.WithdrawProduct emphasis quiet icon ban
        confirm "Take this product off sale?"
      group more title "More" icon dots
        button archive title "Archive" slice Merchandising.Publication.ArchiveProduct
```

- `outlet <name> inherits|extends|overrides` on a module, feature or screen governs the outlet the same way it
  governs a navigation outlet; `hide <id>` drops an inherited button, and `before <id>`/`after <id>` places one
  among the inherited entries.
- A button's `slice` is checked as on a screen (`PLAY0761`-`PLAY0764`), and an id repeated within the outlet or
  across the levels it inherits from is `PLAY0905`.
- `confirm "<text>"` (or a `$strings.<key>` token) is an optional child line of a `button`: the user confirms
  before the command runs. Use it for destructive or hard-to-undo commands, not for every entry.
- Choose the feature outlet when the buttons act on the feature as a whole (approve, withdraw, new). A button that
  needs the row the user picked stays an outlet declared `for item`, or an `item ... action` on the screen's own
  table or list, because a feature-level outlet has no row.
- Preview and Play open the command's form dialog for an entry (or run it after the confirmation); Studio's feature
  editor has a Toolbar section that adds a button and links it to a command of the feature. All of it is authoring
  syntax like every screen construct: the printer writes it back where it was written.
- Verify: `screenplay <model> --warnaserror` is clean (no warning about a command the feature does not declare), then Preview or Play a screen of the feature and see the
  buttons in the template's outlet; a destructive one asks first.

## Template references, categories and blueprints

- Every `layout`, `screen template` and `dialog template` declares a `category`; a template picker groups by it, and a
  missing one is `PLAY0720` (an error in a blueprint package build).
- A template is **own** (`template <Name>`) or from a **blueprint** (`template blueprint <Blueprint> <Name> [version "<range>"]`),
  assigned at a module, feature, slice or screen. The nearest assignment wins.
- `version` is `*`, an exact version, or a `^`, `~`, `>=`, `>`, `<=` or `<` range such as `"^1.4"`; anything else
  (`"latest"`) is `PLAY0721`.
- The blueprint must be listed under a `ui profile`'s `packages` (`PLAY0722`). Prefer a blueprint's template over copying
  its layout into the model: the reference stays in step with the blueprint's releases, a copy does not.
- `scopes slice statechange|stateview` narrows a template to one slice kind; a template outside its scope is `PLAY0631`.

## Sample data packs

- A `sample data <Name>` pack holds rows per shape (`shape <ReadModel>` then `row` with `<field> = <literal>`), and an
  optional `title` and `locale`. Fields must be properties of the read model (`PLAY0710`) and literals must fit
  their types (`PLAY0711`).
- **The active pack is chosen once, in the `ui profile`** (`sample data` then `active <Pack>` or `active blueprint <id>`),
  never per screen, slice or component. A pack the document does not declare is `PLAY0714`. `shape <Shape> maps to
  <ReadModel>` maps a differently named shape; `bind <ReadModel> to <Pack>` is a rare per-read-model override.
- Sample data is **design and preview only**: the executable model defers it and a production build, a backend or
  Chronicle never sees it. Never put sample values in a component or a screen, and never describe sample data as test data
  for specifications.
- Without a selected pack the preview uses the blueprint's default pack and then deterministic generated data.

## Shapes the compiler refuses

Each block below is compiled by the verification and must report exactly the code beside it.

A module that overrides an outlet may not link to another module:

```screenplay expect PLAY0750
layout AppShell
  category application
  content
  outlet sidebar of navigation

module Sales
  feature Orders

module Support
  outlet sidebar overrides
    item sales title "Sales" target Sales
  feature Tickets
```

An extending module may not reuse an inherited item id:

```screenplay expect PLAY0905
layout AppShell
  category application
  content

  outlet sidebar of navigation
    default sales title "Sales" target Sales

module Sales
  outlet sidebar extends
    item sales title "Sales again" target Sales.Orders

  feature Orders
```

A button may not invoke a State View slice:

```screenplay expect PLAY0762
module Shop
  feature Orders
    slice StateView OrderList
      readmodel OrderRow
        title String

      screen OrderList
        toolbar actions
          button refresh title "Refresh" slice OrderList
```

A blueprint reference needs a readable range and a blueprint a profile lists:

```screenplay expect PLAY0721,PLAY0722
module Sales
  feature Orders
    slice StateView OrderList
      readmodel OrderRow
        title String

      screen OrderList
        template blueprint Hr Workspace version "latest"
          body
            title "Orders"

ui profile Desktop
  target platform web
  packages
    Crm
```

## Editing the shell through MCP

The shell is typed syntax. `read-ast` returns `OutletSyntax` (navigation and actions outlets alike),
`NavigationItemSyntax`, `NavigationTargetSyntax`, `NavigationLogoSyntax`, `ToolbarButtonSyntax` (an outlet's buttons
and a screen's own toolbar buttons share this type), `TemplateAssignmentSyntax`, `ScreenTemplateReferenceSyntax` and
`SampleDataPackSyntax`; `propose-ast` edits them; a proposal against a revision that moved is refused with
`StaleRevision`; `apply` writes only after the diagnostics above pass. Propose, show the difference, apply, reopen.
Details: `cratis-screenplay-model-authoring`, `references/screen-authoring-workflow.md`.

- **Switch an outlet's mode** with a `replace` of its `Mode`. Inherit to extend adds the level's own items; inherit
  to override copies the inherited items, retargeted where the module-only target rule applies; override or extend
  to inherit clears the items.
- **Add the first child** of an outlet or a navigation item through its `Items` or `Children` collection.
- A refusal (`PLAY0750`, `PLAY0762`, `PLAY0722`, `PLAY0714`, `PLAY0903`, `PLAY0905`) is the compiler's own answer:
  change the proposal, never the rule.

## Render and verify

- `screenplay <model> --warnaserror` must report no error and no warning first; absent highlighting proves nothing.
  This is the standalone compiler and admits outlets once it is Screenplay 6.0.0 or later.
- `cratis render <model> --name <App> --destination <out>` and `cratis run <model>` carry the shell with whichever
  Screenplay version the installed Cratis CLI bundles: the topbar and sidebar navigation outlets render, a module's
  sidebar outlet replaces or extends the application's, a button opens the slice's command form as a dialog, and
  the address reflects the active module and feature. A Cratis CLI whose bundled compiler predates Screenplay 6.0.0
  cannot parse `outlet` syntax at all; compare `cratis --version` against the release that first bundles it before
  claiming a rendered shell. The sample data pack is not served.
- Report authoring acceptance, executable admission and runtime rendering separately (see `SKILL.md`).

## Review checklist

- [ ] Each module's outlet mode is deliberate: inherit by default, extend to add, override only to replace.
- [ ] No module navigation item targets another module; no id repeats within an outlet or across the levels it inherits from.
- [ ] The logo is declared once, in the layout's navigation outlet.
- [ ] Sub-items target features of the parent's module; any navigation outlet can nest them, not only the sidebar.
- [ ] Every button names a State Change slice; none is left without a slice.
- [ ] A screen with a `template` keeps its toolbar inside a slot body.
- [ ] Buttons shared by every screen of a feature sit in a feature actions outlet (`outlet <name> extends`), each linked to a command of that feature, with `confirm` on the destructive ones.
- [ ] Every template has a `category`; every blueprint reference has a valid range and is listed in a profile's `packages`.
- [ ] The active sample data pack is selected once, in the `ui profile`, and no sample value sits in a component.
