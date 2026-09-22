---
name: cratis-screenplay-projections
description: Build a Cratis Screenplay read model with the Projection Declaration Language (PDL) — keys, `from`/`every`/`all`, property mapping and AutoMap, joins, children and nested objects, removal, arithmetic counters, and the reducer escape hatch. Use when declaring or changing how events become read-model state in a `.play` model, or when a projection does not populate what was expected. Use `cratis-chronicle-projection` instead for hand-written C# Chronicle projections.
license: MIT
---

# Projections — the Screenplay PDL

A `projection` folds events into a read model. Its body is the **Projection
Declaration Language**, an embedded sub-grammar with its own parser — not free
text. This is half of every event model, and the half most easily got wrong.

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
| `Cratis.Screenplay` | `4.12.1` | PDL parser, validator, diagnostics |

Read from the Screenplay repository at tag `v4.12.1` (commit `122eee8`), against
`Documentation/screenplay/projections/` and
`Source/DotNET/Screenplay/Parsing/ProjectionParser.cs`. Reverify before claiming
another version behaves the same.

## The shape

```screenplay
readmodel InvoiceDetailsReadModel
  invoiceNumber InvoiceNumber
  status        InvoiceStatus
  lastUpdatedAt DateTime

projection InvoiceDetails => InvoiceDetailsReadModel
  key invoiceId
  every
    lastUpdatedAt = $eventContext.occurred
    exclude children
  from InvoiceRegistered key invoiceId
    status = "draft"
  from InvoiceSent
    status = "sent"
  remove with InvoiceCancelled
```

**The arrow always points the same way.** A read model never declares what builds
it; the projection or reducer points at it with `=>`. **Exactly one thing may
build a read model** — two builders is error `PLAY0191`: *a projection or a
reducer builds it, and only one of them*. A slice may still declare several
projections, each building a **different** read model.

## Projection-level directives

`key <expr>`, `no automap`, `sequence <name>`, `file <path>`. A second `key` is
error `PLAY0059`.

## Keys — eight ways, and the default

| Form | Example |
| --- | --- |
| Projection-level | `key invoiceId` |
| From-level inline | `from InvoiceRegistered key invoiceId` |
| From-level block | indented `key invoiceId` inside the `from` |
| Per event, several events | `from A key idA, B key idB, C` |
| Composite | `key OrderKey` with indented `<property> = <expr>` parts |
| Literal (constant) | `key literal "site-stats"` — every event updates the **same** instance |
| Children identity | `children lines identified by lineNumber` |
| **Default** | **the event source id** — `from X` ≡ `from X key $eventSourceId` |

A second key on one `from` is error `PLAY0060`. A template expression in a
composite key is error `PLAY0073`; an empty composite key is `PLAY0074`.

## `from` vs `every` vs `all`

| Block | Fires for | Use for |
| --- | --- | --- |
| `from <Event>` | that event type only | the actual mapping work |
| `every` | **only** the types this projection subscribes to via `from` | common fields across your own events |
| `all` | **every event type in the system** | system-wide audit logs, global counters |

⚠️ `all` and `every` are not synonyms, and confusing them is the classic PDL
mistake. `every` is scoped to your `from` blocks; `all` is not scoped at all.

`every` accepts `exclude children`, so child events do not bump the parent's
`lastUpdatedAt`. The `every` block **inside** a `children` block does not accept
it — it is already in a children context.

## Property mapping and AutoMap

⚠️ **AutoMap is on by default.** Matching property names are copied before your
explicit mappings run, and explicit mappings win. Turn it off with `no automap` at
**projection**, `every`/`all`, `join … with`, `children` or `nested` level — it
**cannot** be toggled inside an individual `from` block.

Mapping sources: a property path (`name`, `contactInfo.email`), a literal
(`true`, `"Pending"`, `42`, `null`), a template (`` `${first} ${last}` ``),
`$eventSourceId`, `$eventContext.<occurred|sequenceNumber|correlationId|eventSourceId>`,
and `$causedBy.<subject|name|userName>` (an unknown one is an error naming all
three).

`clear <property>` removes a value and is equivalent to `= null`; prefer `clear`.
It takes a dotted path (`clear Owner.Note`) and escapes reserved names
(`clear @with`).

## Arithmetic

| Line | Effect |
| --- | --- |
| `count <prop>` | +1, expressing *counting occurrences* |
| `increment <prop>` | +1, expressing *modifying state* |
| `decrement <prop>` | −1 |
| `add <prop> by <expr>` | += expression |
| `subtract <prop> by <expr>` | −= expression |

`count` and `increment` behave identically; the difference is intent. The target
must be numeric.

## Joins

```screenplay
join Customer on CustomerId
  with CustomerCreated
    no automap
    CustomerName = name
  with CustomerUpdated
    CustomerName = name
```

`join <property> on <key>` (error `PLAY0063` otherwise), then one or more
`with <EventType>` blocks (error `PLAY0064` otherwise), each able to toggle
`automap` / `no automap` for itself. Joins work at projection level and inside
`children`. A join cannot declare its own key or trigger removal — that is
`remove via join on`.

## Children and nested

```screenplay
children lineItems identified by lineNumber
  from InvoiceLineItemAdded key lineNumber
    parent invoiceId
    quantity = quantity
  remove with InvoiceLineItemRemoved key lineNumber
    parent invoiceId

nested billingContact
  from BillingContactSet
    email = email
  clear with BillingContactCleared
```

- **`children <collection> identified by <expr>`** — a collection with its own
  lifecycle. `parent <expr>` ties a child to its parent instance; it accepts an
  event property, `$eventContext.eventSourceId`, or a nested path. Children nest
  arbitrarily deep and may contain `join`, `remove`, `nested` and `every`.
- **`nested <property>`** — a single nullable object. It **must** contain at least
  one `from` (error `PLAY0067`), and `clear with <Event>` drops the whole object
  back to null. To clear one property instead, use a `clear <property>` mapping.

## Removal

```screenplay
remove with InvoiceCancelled key invoiceId
remove via join on CustomerAccountClosed
```

`remove with <Event> [key <expr>]` removes the instance the event identifies.
`remove via join on <Event> [key <expr>]` removes instances reached through a
join. Inside `children`, both take an indented `parent <expr>` — and **only**
`parent`; anything else is error `PLAY0069`. Several removal conditions may
coexist.

## When PDL is not enough — the reducer

```screenplay
reducer Balance => AccountBalance
  on AmountDeposited
    csharp
      ```
      return context.State is null
          ? new(context.Event.amount, 1)
          : context.State with { balance = context.State.balance + context.Event.amount };
      ```
  on AmountWithdrawn
    file Reducers/Withdrawn.cs
```

Reach for a reducer only when the next state depends on the current one — a
running balance, a state machine. `context.State` is **null for the first event**
and is the only nullable member; `Event`, `Key`, `Tenant`, `Occurred`,
`SequenceNumber` and `IsFirst` are always there.

**Prefer a projection where one will do.** A reducer is code, and code is the part
of a document a reader cannot check at a glance. A reducer binds to
`UnsupportedSemanticSyntax` in ESM v1, so it never reaches the reference runtime.

Read [pdl-grammar.md](references/pdl-grammar.md) for the complete EBNF, every
diagnostic code, and the full worked examples.

## Verify

- [ ] `screenplay <model> --warnaserror` reports zero errors and zero warnings.
- [ ] Each read model has **exactly one** builder.
- [ ] Every read-model property traces back to an event that carries it.
- [ ] `every` was intended where `every` is written — not `all`.
- [ ] AutoMap's default-on behavior is intended, or `no automap` is declared at the
      right level.
- [ ] Every `children` block's `from` declares `parent`.
- [ ] Every `nested` block contains at least one `from`.
- [ ] A reducer is present only because a projection genuinely could not express it.

## Route near misses

- Deciding which read models exist at all: `cratis-screenplay-event-modeling`.
- Read-model shape, queries and screens: `cratis-screenplay-read-surface`.
- Specifying projection behavior: `cratis-screenplay-specifications`.
- Hand-written C# Chronicle projections: `cratis-chronicle-projection`.
- Hand-written C# Chronicle reducers: `cratis-chronicle-reducer`.
