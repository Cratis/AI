---
name: cratis-screenplay-ui-composition
description: Compose the user interface of a Cratis Screenplay `.play` model — `layout` and responsive `arrangement`, screen/dialog templates, component data-context bindings, exposed template configuration, command forms and columns, navigation contributions, hierarchical outlets/routes, toolbar dialogs, package/icon selection, interaction `behavior`/`on`/`uses` wiring, `ui profile`, `theme`, localized `$strings`, and `file` references. Use when declaring the application shell, reusable screen shapes, component/package configuration, command forms, navigation/toolbars, click or submit behavior, or theming. Do not use for a screen's own data and actions.
license: MIT
---

# UI composition in Screenplay

Event Modeling's wireframe step is a first-class part of the language. The shell,
the reusable shapes inside it, the forms bound to commands, and the navigation
entries other modules contribute are all declared in the `.play` model.

## Locate the model

Look first for the project's existing `.play` files: the folder holding them is the
model. A new model goes under the repository's `Source/` or `src/` folder, else in a
`Screenplay/` folder at the repository root; never under `.cratis/`, which holds
configuration and the shared AI corpus only. This is the
conventional home for consumer-owned `.play` source; do not invent another
location or search the whole repository before checking it.

`cratis ai install` manages `.cratis/ai/`, never model files. Never
hand-copy Screenplay source between repositories. Keep Markdown that explains,
questions or navigates the model in the repository's documentation; the `.play`
source is the single flow model.

## Verified product sources

| Package | Version | Purpose |
| --- | --- | --- |
| `Cratis.Screenplay` | `4.31.0` | Original UI composition parser evidence |
| `Cratis.Screenplay` | main `fd18129` | Cancellation routing and `optional`; changed example compiled |
| `Cratis.Screenplay` | `4.66.0` (`c89198b`) | Statements in this skill re-verified: the nine `Documentation/screenplay/` pages above are unchanged since `v4.31.0` except `file-references.md` (typed-context and `implementation` paragraphs); `PLAY0269` in `Diagnostics/DiagnosticCodes.cs`; the new section compiled with `screenplay` 4.66.0 and `cratis screenplay validate` 3.28.2 |

The update follows `commands.md`, `events.md`, `queries.md` and decision 0023
at that main commit (after v4.52.0). It does not verify UI rendering.

Checked against the Screenplay repository at tag `v4.31.0` (commit `355dffb`):
`Documentation/screenplay/{templates,layout-arrangement,forms,contributions,interactions,ui-profile,theme,internationalization,file-references}.md`.
Those checks established the original baseline. The changed cancellation
example uses the newer main commit above, not the old tag.

Versions of the tools that check these examples: `cratis-screenplay-toolchain`
`references/versions.md`.

Every construct on this page is deferred from the executable model with
information `PLAY0269`: it never blocks binding, and it is not evidence that a
target renders it.

The screens-release surface adds component data-context bindings, exposed template
configuration, package/icon catalogs, manual form columns, hierarchical outlets,
routes, toolbars and dialog destinations. Treat those as a **support-level**
contract: authoring accepted, executable admitted and runtime implemented are
separate results. Discover the exact installed shape through MCP `syntax-schema`
and the Screenplay-owned canonical corpus
(`Source/DotNET/Screenplay.CanonicalCorpus/Corpus/` in the Screenplay repository);
do not copy fixtures into AI or invent a parallel syntax. Details and examples:
`references/screen-composition-contract.md`.

These constructs went unhighlighted and uncompleted by the Monaco and VS Code
language service until `Cratis/Screenplay#199` gave every construct the parser
dispatches on a keyword entry. On an older language-service version they still
look unrecognized — **check `screenplay`, not the editor**, because absent
highlighting was never evidence that a construct is wrong.

## Compose in this order

Decide what every screen is for before deciding how any of it is laid out. Layout
work on a screen whose purpose is unsettled is rework.

1. **Level 1 for every screen in the flow first** (`cratis-screenplay-read-surface`:
   `data` plus `action`). Read the whole set, not one screen at a time.
2. **Review the flow before adding layout.** Walk it screen by screen as text
   (format in `references/flow-review.md`). When the host advertises the MCP-Apps
   extension, `visualize-model` (a `proposalId` or a `sketch`) can also show it on
   a board; that is optional, and the text review is enough on its own. Do not
   use the Stage sandbox as the review: it renders only part of a screen, and
   nothing here establishes that Stage renders an authored screen faithfully.
3. **Add structure only to screens whose Level 1 is agreed**: template, sections,
   forms, `on`/`uses`. Use Level 3 inline code last, and only where Level 2 cannot
   say it.
4. **Trace every field.** Each `form` `field` is a property of the form's command.
   A prefilled value comes from `populate` or `from`; a derived one from
   `compose using`. Each `summary` or `column` field is a property of the
   screen's read model. A value with no origin means the command or read model is
   missing it: fix the slice, never invent the value in the screen.
5. **Read before editing.** Open the existing screen (or `read-workspace` /
   `declaration-details` over MCP) and change only the directives that were asked
   for. Adding `layout` must not rewrite the Level-1 intent beneath it.
6. **Report each screen in two or three sentences**: what it shows and what the
   user can do. Not everyone reviewing can see a board.

A complete worked flow (two Level-1 screens, their command, read model and form,
with the field trace): `references/worked-flow.md`.

## `layout` — the application shell

One per application, declared at the top level and selected by a `ui profile`.
A complete example:

```screenplay
layout AppShell
  topbar
  navigation contributes Navigation
  content
  footer

  arrangement flow
    column
      topbar height 56
      row
        navigation width 240
        content grow
      footer height 32
```

A slot is declared once by name, optionally marked
`contributes <ContributionPoint>` to make it a contribution target.

## `arrangement` — responsive `flow` or pixel-precise `freeform`

The size-class matrix is **2×2**: width `compact` or `regular`, height `compact`
or `regular` — phone landscape, phone portrait, desktop short, desktop tall.

**`arrangement flow`** nests slots under `row`, `column` or `grid` containers.

- A container may declare `gap <n>`.
- A slot leaf takes `width <n>`, `height <n>`, `grow`, and `span <n>` for grid tracks.
- `when width <class>[, height <class>]` or `when height <class>` **replaces the
  entire tree** for that condition — it is not a partial override.

**`arrangement freeform`** declares one variant per matrix point. Excerpt, inside
the `layout` above in place of its `arrangement flow`:

```screenplay
arrangement freeform
  variant width regular, height regular
    place navigation at 0,0 size 240,fill
    place content    at 240,0 size fill,fill
  variant width compact, height regular
    place navigation hidden
    place content    at 0,0 size fill,fill
```

`place <Slot> at <x>,<y> size <w>,<h>` where either dimension may be `fill`, or
`place <Slot> hidden` to drop the slot from that variant entirely.

## `screen template` and `dialog template`

Declared at module level, referenced by screens. Excerpt, inside a `module`:

```screenplay
screen template MasterDetail
  fits slot content
  sidebar
  main
  arrangement flow
    row gap 16
      sidebar width 280
      main grow

dialog template RegisterInvoiceDialog
  body
  actions
```

`fits slot <name>` says which slot of its parent the template fills. **A dialog
template is a screen template in everything but one respect: it declares no
`fits slot`, because a dialog occupies no slot of the structure it opens over** —
writing one is an error.

A screen fills a template by naming it and providing slot bodies; a dialog is
filled exactly the same way, because from the screen's side there is no
difference. See `cratis-screenplay-read-surface` for the directives that go inside.

## `form` — bound to a command

Excerpt, inside a `module`; the command, query and screen are declared in its
slices.

```screenplay
form RegisterInvoiceForm for RegisterInvoice
  populate via query GetInvoiceDefaults by customerId
  field invoiceNumber label "Invoice #"
  field customerId    from item
  field total         compose using TotalCalculator
  on submit navigate to InvoiceList
```

- At most one `populate` — `populate via query <Query> [by <param>]` or
  `populate from item`.
- `field <property>` takes at most one of `from <source>` or `compose using
  <Callback>`, plus an optional `label`.
- When the installed language supports it, `columns auto` keeps generated form
  columns tied to the command, and `columns manual` lists command properties in
  the intended order. A manual column that is not a command property is a model
  defect.
- At most one `on submit navigate to <Screen> [by <param>]`, the one-line form.
  Any other `on` in a form body is a behavior attached to the form.

⚠️ **A form is discovered, not referenced.** It never appears in a screen's
directive tree the way a `table` or `summary` does — it is found by its
`for <Command>` binding wherever that command is invoked. A form sits at module
level, so it disambiguates by module rather than by feature or slice.

## `contribute`, toolbars, outlets and routes — navigation from elsewhere

Excerpt, inside a `module` or `feature`; `Navigation` is the contribution point
the layout above declares.

```screenplay
contribute to Navigation
  navigate to InvoiceList
  label "Invoices"
  order 20
```

All three directives are optional and appear at most once each.

**Resolution walks outward:** a contribution first looks for a
`contributes <ContributionPoint>` slot among its **own module's** templates, then
outward to the nearest enclosing structure that declares a matching point. Three
tiers exist — application-wide (the layout declares the point), cross-module, and
module-level.

`navigate to <Screen> by <param>` is **not** string interpolation; it reuses the
same typed navigate binding a screen action uses.

⚠️ The older shipped iteration has `navigate`, `label` and `order` only. Newer
screens-release contracts add typed destinations for named outlets, routes,
toolbar items and dialog targets. Use the installed MCP schema and the Scene/Stage
runtime contract before writing those forms, and report unsupported toolbar or
outlet delivery as a capability gap rather than falling back to a flat list.

## Interactions — what a click does

A screen can say what it shows; an interaction says what happens when someone
acts. Three words carry it:

| Word | What it is |
| --- | --- |
| **Interaction trigger** | the `on <thing>` clause: `click`, `double click`, `select`, `submit`, `change`, `load`/`unload`, `enter`/`leave`, `event <Event>`, `interval <n> <unit>`, or a declared application trigger |
| **Action** | a closed set: `execute`, `navigate to`/`navigate back`, `open dialog`/`close dialog`, `refresh`, `set … to`, `notify`, `confirm`, `raise` |
| **Behavior** | a bundle of trigger-to-action bindings; inline (`on …`) or named (`behavior` + `uses`) |

A complete example — a named behavior with parameters, attached with `uses`, and
an inline `on` block with a continuation:

```screenplay
concept InvoiceId : Uuid

behavior ConfirmThenExecute
  parameter command
  parameter message
  on click
    confirm message
      on success
        execute command

module Invoicing
  feature InvoiceManagement
    slice StateChange CancelInvoice
      command CancelInvoice
        invoiceId InvoiceId identifier
        produces event InvoiceCancelled
      screen CancelInvoiceScreen
        data InvoiceStatusView via query InvoiceStatusById by invoiceId
        uses ConfirmThenExecute
          command CancelInvoice
          message "Cancel this invoice?"
        on enter
          refresh InvoiceStatusById
            on failure
              notify error "The invoice could not be loaded"
    slice StateView InvoiceStatus
      readmodel InvoiceStatusView
        invoiceId InvoiceId
        cancelled Bool
      projection InvoiceStatuses => InvoiceStatusView
        from InvoiceCancelled
          invoiceId = $eventSourceId
          cancelled = true
      query InvoiceStatusById => InvoiceStatusView optional
        by invoiceId InvoiceId
```

The inline event targets `invoiceId` without copying it into payload; the
projection obtains it from event context. A command `returns` clause (scalar or
record) binds and executes from standalone Screenplay 4.68.0 (ESM v7, `commands.md`,
"Generated values and responses"); the 4.66.0 bundled in `cratis` 3.28.x reports `PLAY0268`, and
Stage 4.24.2 does not render ESM v7 (`STAGE-ESM-016`, tracked in Stage#201). Form `on submit` and
interaction `on success` response-name scopes, failure clearing and response
execution remain unavailable.
An existing success continuation does not imply a response contract.

- Write the one-off case inline; name it with `behavior` when several places need
  the same wiring. A `uses` site must supply exactly the declared parameters
  (`PLAY0337`, `PLAY0338`).
- `on`/`uses` attach at every level — `layout`, `module`, `feature`, templates,
  `form`, `screen`, `section`, slot, `table` — and are **additive**: outer
  attachments run first unless a behavior declares `order`.
- `on success`/`on failure` belong only on actions that can fail (`execute`,
  `refresh`, `confirm`, `open dialog`, `raise`); `on result` only on `open dialog`.
  A continuation on `navigate`, `notify`, `set` or `close dialog` is an error
  (`PLAY0320`). Actions after an unconditional `navigate` are unreachable
  (`PLAY0339`).
- Unknown commands, screens, queries, dialogs and behaviors are warnings, like
  every other reference (`PLAY0330`–`PLAY0336`).
- **A declared `trigger` is not a UI event.** Use `on click`, not `trigger`, for a
  button. `on <Trigger>` observes an application trigger and `raise <Trigger>`
  fires one; that is where the two meet.
- Interactions are a closed vocabulary, not a scripting language. Validation stays
  on the command; the UI surfaces it.

## `ui profile` and `theme`

Excerpt: `AppShell` is the layout above.

```screenplay
ui profile Desktop
  target platform web
  target size regular
  layout AppShell
  theme Nordic
  packages
    Cratis.Components

theme Nordic
  compatible with Cratis.Components
```

- `target platform` takes a comma-separated list. `web`, `ios` and `android` are
  the documented examples; ⚠️ **the parser accepts any identifier** — there is no
  enforced list, so a typo is silent.
- `target size` is documented as `compact`, `regular` or `expanded`; ⚠️ again any
  identifier parses.
- `packages` are listed **in override-priority order** — a later package's `Button`
  shadows an earlier one's — and `core`, the built-in vocabulary, is always the
  final fallback.
- Component package metadata (kind, icon, applicability, scope-aware template
  categories) is owned by the package/runtime catalog. The model selects packages
  and icon sets; it does not copy package metadata into `.play`.
- `compatible with` lists the packages a theme actually supports, each at most
  once. A profile selecting a theme not declared compatible with one of its own
  packages gets a compile-time **warning**.

## Localized strings

Localized text lives in companion `.strings` files — `MySystem.play` pairs with
`MySystem.<locale>.strings`, line-based, dotted keys, `=` assignment, `//`
comments. `{placeholder}` tokens are kept verbatim for runtime substitution.

Reference them with `$strings.<dotted.key>`, unquoted, anywhere a literal is
accepted in: a validation rule's `message`; a screen action, table column or
summary field `label`; a screen or section `title`; a contribution `label`; and a
form field `label`. The value is stored as the literal text `$strings.<key>`, and
the printer emits it unquoted so a round trip preserves it.

## `file` — implementation or provenance, never a substitute

Three meanings, one word:

- **Backend implementation attachment.** On a command `handler` (which never
  binds, `PLAY0268`), a validation
  rule predicate, a query `performer`, a reducer rule, a reaction trigger, a
  `constraint` and a `policy`, `file` stands in for the inline body: the
  implementation lives there. These are the files a host inventories.
- **UI realization file.** On a `screen`, `file` names the file that realizes
  the screen. It sits on the **screen itself**, not on a directive inside it:
  `File` is a member of `ScreenSyntax`, and the directive types have no such
  member. Screens are deferred from the executable model (`PLAY0269`), and the
  attachment loader does not collect screen files: they are never loaded, hashed
  or checked, so a missing screen file gets no `PLAY0430`–`PLAY0434` warning.
- **Provenance.** On a **pure declaration** — `concept`, `type`, `event`,
  `readmodel`, `projection`, `slice`, `specification`, top-level `trigger` — it
  only records which file realizes it.

The rules:

- **Repository relative, never absolute** (an absolute path is warning `PLAY0264`).
- **Syntax compilation never resolves it.** The `screenplay` tool and
  `PlayFileCompiler` do not read files, so a stale path does not invalidate the
  document. A host that loads attachments (the MCP server, `AttachmentFiles.Load`)
  reads **backend implementation** files only, resolved from the model root
  rather than the `.play` file's directory, to hash their content; a refused or
  missing file stays unresolved with a `PLAY0430`–`PLAY0434` warning. Screen
  files and declaration-only `file` references are never read; check a screen
  file's path yourself.
- **It never replaces the declaration** — a `projection` still declares its
  blocks, an `event` still declares its properties.
- **Loaded is not run.** Screenplay hashes attached code and can map an inline
  body back to its source for an editor, but never compiles or executes it.

⚠️ `file <Identifier>` is read as a **property** named `file`, not a directive —
the type-reference shape wins the tie. `file Invoices/Register.cs` is a directive;
`file Attachment` is a property. In a `trigger` body the directive always wins, so
a trigger value named `file` is written `@file`.

## Verify

- [ ] `screenplay <model> --warnaserror` (standalone) reports zero errors and zero
      warnings; `cratis screenplay validate --warnings-as-errors` says the same on
      cratis 3.28.2 or later, which bundles the same compiler (versions: `cratis-screenplay-toolchain`
      `references/versions.md`).
- [ ] Every screen in the flow has Level 1 reviewed before any layout, and every
      form field and screen field traces to a command or read-model property.
- [ ] Every slot a `contribute` targets is declared `contributes <Point>` somewhere
      that encloses it.
- [ ] No `dialog template` declares `fits slot`.
- [ ] `packages` are ordered deliberately — later shadows earlier.
- [ ] Every theme a profile selects is `compatible with` one of its packages.
- [ ] `target platform` and `target size` values are spelled correctly; nothing
      checks them.
- [ ] User-visible text is `$strings.` where the application is localized.
- [ ] No `file` reference is doing work the declaration should be doing.
- [ ] Every click, submit and screen entry that does something has an `on` or
      `uses`; continuations sit only on actions that can fail.
- [ ] Component bindings, exposed template values, manual form columns, toolbar
      items, outlets and routes all trace to typed data; no runtime fallback is
      counted as delivery.
- [ ] The result reports authoring acceptance, executable admission and runtime
      implementation separately, with tool/package versions.

## Route near misses

- A screen's own data, actions and name resolution: `cratis-screenplay-read-surface`.
- Revision-checked MCP edits of screens and multi-file applications: `cratis-screenplay-model-authoring` (`references/screen-authoring-workflow.md`).
- Application triggers and reactions: `cratis-screenplay-captures-and-reactions`.
- Reviewing the whole flow's design: `cratis-screenplay-model-review`.
- Deriving wireframes from the model (step 4): `cratis-screenplay-event-modeling`.
- Rendering/running screen output and detecting omissions: `cratis-stage-rendering-and-sandbox` and `cratis-screenplay-render-and-gap-fill`.
- Building the actual React application: `cratis-arc-react-page`, `cratis-components-styling`.

## Lineage

`references/provenance.md`.
