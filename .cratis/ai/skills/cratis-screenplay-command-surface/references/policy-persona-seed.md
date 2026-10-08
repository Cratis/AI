# Policies, personas and seed

## `policy` and `persona`

```screenplay
policy IsAuthenticated
  require authenticated
policy IsAccountant
  require role "Accountant"
policy CanManageInvoice
  require role "InvoiceManager"
    or role "Accountant"
policy OwnsInvoice
  require claim "sub" matches subject
policy IsAdultCustomer
  file Policies/IsAdultCustomer.cs

persona Accountant
  description "Handles invoicing and collections"
  policy IsAccountant
```

Three condition forms: `authenticated`, `role "<name>"`, and
`claim "<name>" matches subject | "<value>" | <path>`. A policy has **exactly one**
`require` line — continue the condition on deeper-indented lines instead of adding
a second (`PLAY0441`) — **or** one implementation (a tagged ` ```csharp ` block or
`file`), never both (`PLAY0440`). Declarative policies run in the reference
runner; a code policy binds as opaque ESM v3 and needs a target to evaluate it.
A `persona` is authoring metadata: the binder reports it as information `PLAY0270`
(report-only) and it does not block binding; an unknown policy it lists is an error.

## `seed`

Excerpt: `CustomerRegistered` is declared in a slice.

```screenplay
seed
  for "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    CustomerRegistered
      name = "Acme Corp"
```

Events append to that event source in declaration order, using the same mapping
expression grammar as `produces`. Several `seed` blocks accumulate. Seeding is
operational metadata, not part of executable behavior (`PLAY0270`).

