---
name: cratis-screenplay-read-surface
description: Declare the read side of a Cratis Screenplay `.play` model — the `readmodel` shape, `query` with `by`/`filter`/`scoped to`/`observable`/`performer`, and `screen` at its three levels of detail, plus how a bare name resolves across slices. Use when adding or changing a query, a read-model shape, or a screen in a `.play` model, or when deciding what a caller may narrow a result by. Do not use for how events fill the read model, and do not use for layouts, templates or forms.
license: MIT
---

# The Screenplay read surface

What the system can be asked, and what a user sees. The `readmodel` declares the
shape, the `query` is the entry point, and the `screen` renders it.

## Verified product sources

| Package | Version | Purpose |
| --- | --- | --- |
| `Cratis.Screenplay` | `4.12.1` | Parser, validator, diagnostics |

Read from the Screenplay repository at tag `v4.12.1` (commit `122eee8`), against
`Documentation/screenplay/{queries,readmodels,screens}.md` and
`Source/DotNET/Screenplay/Parsing/`. Reverify before claiming another version
behaves the same.

## `readmodel` — shape only

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

## `query`

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
are all available.

### `scoped to`

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

`=> observable OverdueInvoicesReadModel[]` is a live read that keeps pushing;
without the marker a query is one-shot, which is the default and what most reads
are. The marker qualifies only *how* the result arrives, so it composes with `[]`,
`?`, `by`, `filter`, `authorize` and a `performer`. A screen binds to a live query
exactly as it binds to a one-shot one and gets updates for free.

### `performer`

A query is **complete without a performer** — it is realization metadata, not a
precondition. It takes a `file` reference or an inline code block, and is the
query's counterpart to a command's `handler`. `csharp` and `sql` are the two that
make sense here; the parser accepts any registered inline language
(`csharp`, `typescript`, `react`, `html`, `sql` are built in) and does not
reject a nonsensical one, so the choice is yours to get right.

## `screen` — three levels

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

## How a bare name resolves

**Inside out:** the slice, then the enclosing feature, then the module, then the
document. The innermost match wins.

That rule exists because a generated document cannot make every name unique — one
real application declares 76 queries under 37 distinct names, with `All` appearing
21 times. Two sibling slices can each declare `All`, and each screen gets its own.

Reach across slices by qualifying with **any trailing part** of the scope:

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

## Verify

- [ ] `screenplay <model> --warnaserror` reports zero errors and zero warnings.
- [ ] Every value the caller must not choose is a `from` parameter, not a `filter`.
- [ ] Every `scoped to global` is deliberate and defensible.
- [ ] `observable` is present exactly where the caller should see changes without
      asking again.
- [ ] Each read model has exactly one builder and every field traces to an event.
- [ ] No screen reference is left ambiguous or unresolved.

## Route near misses

- How events fill the read model: `cratis-screenplay-projections`.
- Layouts, templates, forms, contributions, themes: `cratis-screenplay-ui-composition`.
- Asserting query results: `cratis-screenplay-specifications`.
- Deciding which read models exist: `cratis-screenplay-event-modeling`.
