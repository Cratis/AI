# Distinguish a refused read from an empty answer

For a query `GetInvoice` declared with `by number InvoiceNumber`, suppose `InvoiceNumber` requires at least two characters and the query returns an optional invoice. Pass the named argument under `when query` and write separate cases:

```screenplay
specification RejectingAnInvalidNumber
  when query GetInvoice
    number = "A"
  then error "Invoice number is too short"
specification FindingNoInvoiceForAValidNumber
  when query GetInvoice
    number = "INV-42"
  then no result
```

A query validation case (ESM v18+) has one query and one `then error`, no other action or expectation. Do not combine it with `then no result`, result rows or denial. An empty but accepted lookup must not satisfy a validation case.

For a policy-protected query, use a valid argument and an explicit caller lacking the required authority. Assert `then denied`, which matches authorization, not validation. For example, when the policy requires `Reviewer`:

```screenplay
specification RefusingAnUnauthorizedRead
  given caller
    authenticated
    role "Clerk"
  when query GetInvoice
    number = "INV-42"
  then denied
```
