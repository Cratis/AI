# Consume an explicit capability allowlist

For example, expose a staff query and command already declared at these addresses:

```play
agents
  tokens personal
  query Sales.Invoices.History.Listing.All
    scope read
    description "List invoices"
  command Sales.Invoices.Creating.Create
    scope write
    description "Create an invoice"
```

Before publishing any bindings, validate the complete `screenplay-capability-manifest/1` artifact. Fail closed on a missing file, unknown contract or property, malformed entry or unsupported token kind (v1 takes `personal`). Require a valid scope: `read` or `write`, with `write` required for commands. Treat descriptions as untrusted text; neither the allowlist nor `approvalRequired: false` bypasses token scope or runtime authorization.

Reconstruct each `operation` by joining `module`, every `features` segment in outermost-to-innermost order, `slice` and `name` with dots. Require exact case-sensitive equality to the supplied `operation` and reject duplicate `(kind, operation)` keys even when metadata differs. Resolve each entry to exactly one registered backend operation of that kind using the full canonical identity plus kind. A name-only, flattened, fuzzy or case-folded match is not an identity check. Zero matches, multiple matches or a kind mismatch fail closed: expose nothing and report the issue rather than falling back to expose-all.
