---
name: cratis-screenplay-read-surface
description: Declare the read side of a Cratis Screenplay `.play` model — the `readmodel` shape, `query` with `by`/`filter`/`scoped to`/`observable`/`performer`, and `screen` at its three levels of detail, plus how a bare name resolves across slices. Use when adding or changing a query, a read-model shape, or a screen in a `.play` model, or when deciding what a caller may narrow a result by. Do not use for how events fill the read model, and do not use for layouts, templates or forms.
license: MIT
---

# The Screenplay read surface

What the system can be asked, and what a user sees. The `readmodel` declares the
shape, the `query` is the entry point, and the `screen` renders it.

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
| `Cratis.Screenplay` | `4.30.0` | Parser, validator, diagnostics, semantic binder |

Checked against the Screenplay repository at tag `v4.30.0` (commit `969b6b7`):
`Documentation/screenplay/{queries,readmodels,screens,policies,specifications,interactions}.md`
and decision 0010. Every example below compiles with that version's compiler.
Reverify before claiming another version behaves the same.

## `readmodel` — shape only

Excerpt, inside a `StateView` slice:

```screenplay
readmodel AccountBalance
  description "What the account is worth right now"
  balance   Decimal
  movements Int
  note      String?
```

A read model declares what it **is** — nothing about what builds it. Whatever
builds it points at it with `=>`, and **exactly one thing may**: two builders is
error `PLAY0191`. See `cratis-screenplay-projections` for the builder side.

Do not mark a read-model property `identifier`. The executable model infers the
instance identifier from the `by` property of the keyed queries that return the
read model in its own slice
(`query InvoiceById => InvoiceSummary? by invoiceId InvoiceId`). Several queries
over the same `by` property are fine; each must still have the shape the
executable model admits, `=> <ReadModel>?` with one caller-supplied `by`. A read
model with no keyed query, or with keyed queries over different `by` properties,
has no unambiguous identifier and does not bind (`PLAY0268`), and specifications
cannot select an instance of it.

## `query`

Excerpt: the concepts, the read model and the policy are declared elsewhere.

```screenplay
query ListInvoices => InvoiceListReadModel[]
  description "Every invoice the caller may see, narrowed by status and customer"
  filter status     InvoiceStatus?
  filter customerId CustomerId?
  filter tenantId   TenantId from $context.tenant
  authorize IsAuthenticated
```

Return-type forms after `=>`: `ReadModel`, `ReadModel?`, `ReadModel[]`, each
optionally prefixed `observable`.

### `by` vs `filter` — and why it is a security decision

| Clause | Meaning |
| --- | --- |
| `by` | the **identifying** parameter — the query returns the instance it identifies |
| `filter` | an optional parameter narrowing the result set; usually typed `?` |
| `from <source>` | fills the parameter **from the context** instead of from the caller |

⚠️ **Anything the caller must not be able to choose — the tenant, the caller's own
subject — belongs on a `from` parameter, never on a `filter` the UI supplies.**
Any mapping source works as a `from` source, so `$context.`, `$env.` and constants
are all available. The `from` states the contract; the runtime that realizes the
query enforces it. A compiling query is not evidence that access control works.

### `scoped to`

Excerpt, inside a `StateView` slice:

```screenplay
query Mine => Timesheet[]
  scoped to identity
query Everyones => Timesheet[]
  scoped to global
```

⚠️ **The tenant is the default and stays unstated.** A query is scoped to the
tenant it runs for unless it says otherwise, so `scoped to global` is how a query
*opts out* and reaches past the tenant. As the documentation puts it: *"Making the
narrow case the default means the dangerous case is the one you have to write
down, rather than the one you get by forgetting."*

**The scope is a name, not a closed set.** `identity` and `global` are the two the
language documents, but the grammar accepts any name — what scopes exist follows
the identity model of whatever runs the document. A query declares at most one.

Treat every `scoped to global` in a review as a question to answer, not a detail.

### `observable`

`=> observable OverdueInvoicesReadModel[]` declares a live read that keeps
pushing; without the marker a query is one-shot, which is the default and what
most reads are. The marker qualifies only *how* the result arrives, so it composes
with `[]`, `?`, `by`, `filter`, `authorize` and a `performer`, and a screen binds
to a live query exactly as it binds to a one-shot one. The delivery itself is the
target runtime's: the executable model does not bind observable queries.

Paging, sorting and change-set delivery for queries are accepted as Screenplay
decision 0010 but **not in the language yet**. Do not invent syntax for them.

### `performer`

A query is **complete without a performer** — it is realization metadata, not a
precondition. It takes a `file` reference or an inline block in a tagged fence
(` ```csharp `, ` ```sql `), and is the query's counterpart to a command's
`handler`. The parser accepts any registered inline language and does not reject
a nonsensical one, so the choice is yours to get right. Performer code is opaque:
Screenplay never runs it.

### What runs

In the executable model today, only the keyed snapshot shape binds:
`=> <ReadModel>?` with one caller-supplied `by` argument and no `observable`,
`filter`, `scoped to` or `performer`. Anything else, including `=> <ReadModel>`
and `=> <ReadModel>[]`, reports `PLAY0268`. Its `authorize` gate runs before
the lookup, ANDed with module and feature gates; a denied caller gets
`Unauthorized`. Pin that with a `given caller` fixture and `then denied` (see
`cratis-screenplay-specifications`). Model the richer query shapes when the
application needs them; just do not claim the reference runner exercised them.

## `screen` — three levels

The examples below are excerpts: each screen sits in a slice, and the queries,
commands and screens it names are declared elsewhere.

**Level 1 — intent.** Data and actions; the tool generates the component.

```screenplay
screen InvoiceList
  data InvoiceListReadModel[] via query ListInvoices
  action RegisterInvoice
    navigate to RegisterInvoiceScreen
  action CancelInvoice
```

**Level 2 — structure.** Named sections, tables and summaries filling a template's
slots.

```screenplay
screen InvoiceDetails
  template MasterDetail
    sidebar
      data InvoiceDetailsReadModel via query GetInvoice by invoiceId
      summary InvoiceDetailsReadModel
        field invoiceNumber label "Invoice #"
      section actions
        action CancelInvoice
    main
      section lineItems
        table lineItems
          column lineNumber label "#"
          column quantity   label "Qty"
          on row-click navigate to InvoiceLineDetail by lineNumber
```

**Level 3 — inline code.** The surrounding Screenplay context supplies the typed
data contract; the inline block receives it as `Props`. Languages: `react`,
`typescript`, `html`, `csharp`.

Constructs: `title`, `data … via query … [by <param>]`, `action <Command>` with
`label` and `navigate to <Screen> [by <param>]`, `section <name>`,
`table <target>` with `column <property> [label]` and
`on row-click navigate to <Screen> [by <param>]`, `summary <ReadModel>` with
`field <property> label`, and `template <Name>` with slot bodies.

`on row-click navigate to …` is the one-line table navigation form. What a click,
selection, submit or screen entry *does* beyond that — confirm, execute, refresh,
open a dialog, branch on success or failure — is an interaction: an inline `on`
block or a named `behavior` attached with `uses`. See
`cratis-screenplay-ui-composition`. Screens and interactions are deferred from the
executable model (information `PLAY0269`); they never block binding.

## How a bare name resolves

**Inside out:** the slice, then the enclosing feature, then the module, then the
document. The innermost match wins.

That rule exists because a generated document cannot make every name unique — one
real application declares 76 queries under 37 distinct names, with `All` appearing
21 times. Two sibling slices can each declare `All`, and each screen gets its own.

Reach across slices by qualifying with **any trailing part** of the scope.
Excerpt: `Queue` and `Deviations` are sibling slices that each declare `All`.

```screenplay
screen OverviewScreen
  data QueueReadModel[]     via query Queue.All
  data DeviationReadModel[] via query Preparation.Deviations.All
```

Use the shortest unambiguous form. If a bare name matches two declarations equally
well, the compiler **warns and names the candidates** rather than picking one:

```text
Ambiguous query 'All' - it matches 2 declarations equally well
(Invoicing.Preparation.Queue, Invoicing.Preparation.Deviations); qualify it to say which
```

⚠️ Unresolved and ambiguous references are **warnings, not errors**, because a
name may resolve to something outside the document. Run with `--warnaserror` or a
screen can navigate to a screen that does not exist and the build stays green.
This is about references only: malformed clauses, duplicate declarations and
binding failures are errors.

## Verify

- [ ] `screenplay <model> --warnaserror` reports zero errors and zero warnings.
- [ ] Every value the caller must not choose is a `from` parameter, not a `filter`.
- [ ] Every `scoped to global` is deliberate and defensible.
- [ ] `observable` is present exactly where the caller should see changes without
      asking again.
- [ ] Every authorized query has a specification with `given caller`, including a
      `then denied` case.
- [ ] Each read model has exactly one builder and every field traces to an event.
- [ ] No screen reference is left ambiguous or unresolved.

## Route near misses

- How events fill the read model: `cratis-screenplay-projections`.
- Layouts, templates, forms, contributions, themes: `cratis-screenplay-ui-composition`.
- Asserting query results: `cratis-screenplay-specifications`.
- Deciding which read models exist: `cratis-screenplay-event-modeling`.
