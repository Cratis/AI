---
name: cratis-screenplay-ui-composition
description: Compose the user interface of a Cratis Screenplay `.play` model — `layout` and its responsive `arrangement`, `screen template` and `dialog template`, command-bound `form` declarations, navigation `contribute` blocks, `ui profile`, `theme`, localized `$strings`, and `file` realization references. Use when declaring the application shell, a reusable screen shape, a command form, a navigation entry, or theming in a `.play` model. Do not use for a screen's own data and actions.
license: MIT
---

# UI composition in Screenplay

Event Modeling's wireframe step is a first-class part of the language. The shell,
the reusable shapes inside it, the forms bound to commands, and the navigation
entries other modules contribute are all declared in the `.play` model.

## Locate the model

Look first in `.cratis/screenplay/` at the repository root. This is the
conventional home for consumer-owned `.play` source; do not invent another
location or search the whole repository before checking it.

`cratis ai install` manages `.cratis/ai/`, not `.cratis/screenplay/`. Never
hand-copy Screenplay source between repositories. Keep Markdown that explains,
questions or navigates the model in the repository's documentation; the `.play`
source is the single flow model.

## Verified product sources

| Package | Version | Purpose |
| --- | --- | --- |
| `Cratis.Screenplay` | `4.12.1` | Layout, template, form, contribution, profile and theme parsers |

Read from the Screenplay repository at tag `v4.12.1` (commit `122eee8`), against
`Documentation/screenplay/{templates,layout-arrangement,forms,contributions,ui-profile,theme,internationalization,file-references}.md`
and `Source/DotNET/Screenplay/Parsing/`. Reverify before claiming another version
behaves the same.

These constructs went unhighlighted and uncompleted by the Monaco and VS Code
language service until `Cratis/Screenplay#199` gave every construct the parser
dispatches on a keyword entry. On an older language-service version they still
look unrecognized — **check `screenplay`, not the editor**, because absent
highlighting was never evidence that a construct is wrong.

## `layout` — the application shell

One per application, declared at the top level and selected by a `ui profile`.

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

**`arrangement freeform`** declares one variant per matrix point:

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

Declared at module level, referenced by screens.

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
- At most one `on submit navigate to <Screen> [by <param>]`.

⚠️ **A form is discovered, not referenced.** It never appears in a screen's
directive tree the way a `table` or `summary` does — it is found by its
`for <Command>` binding wherever that command is invoked. A form sits at module
level, so it disambiguates by module rather than by feature or slice.

## `contribute` — navigation from elsewhere

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

⚠️ This iteration ships `navigate`, `label` and `order` only. Grouping beyond a
flat ordered list, and an explicit override for when nearest-enclosing is not the
point you mean, are deliberately left for later.

## `ui profile` and `theme`

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

## `file` — realization metadata, never a substitute

Two meanings, one word. On a construct **with an implementation body** — a command
`handler`, a validation rule predicate, a query `performer`, a reducer rule, a
reaction trigger, a `constraint` and a `screen` — `file` stands in for the inline
body. It sits on the **screen itself**, not on a directive inside it: `File` is a
member of `ScreenSyntax`, and the directive types have no such member. On a **pure declaration** — `concept`, `type`, `event`, `readmodel`,
`projection`, `slice`, `specification`, top-level `trigger` — it only records
which file realizes it.

The rules: **repository relative, never absolute** (an absolute path is warning
`PLAY0264`); **never resolved** — the compiler does not look for the file, so a
stale path does not invalidate the document; and **never replaces the
declaration** — a `projection` still declares its blocks, an `event` still declares
its properties.

⚠️ `file <Identifier>` is read as a **property** named `file`, not a directive —
the type-reference shape wins the tie. `file Invoices/Register.cs` is a directive;
`file Attachment` is a property. In a `trigger` body the directive always wins, so
a trigger value named `file` is written `@file`.

## Verify

- [ ] `screenplay <model> --warnaserror` reports zero errors and zero warnings.
- [ ] Every slot a `contribute` targets is declared `contributes <Point>` somewhere
      that encloses it.
- [ ] No `dialog template` declares `fits slot`.
- [ ] `packages` are ordered deliberately — later shadows earlier.
- [ ] Every theme a profile selects is `compatible with` one of its packages.
- [ ] `target platform` and `target size` values are spelled correctly; nothing
      checks them.
- [ ] User-visible text is `$strings.` where the application is localized.
- [ ] No `file` reference is doing work the declaration should be doing.

## Route near misses

- A screen's own data, actions and name resolution: `cratis-screenplay-read-surface`.
- Deriving wireframes from the model (step 4): `cratis-screenplay-event-modeling`.
- Building the actual React application: `cratis-arc-react-page`, `cratis-components-styling`.
