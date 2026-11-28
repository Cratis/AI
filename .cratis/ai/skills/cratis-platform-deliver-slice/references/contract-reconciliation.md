# Reconcile the whole slice

Use the accepted contract (including accepted examples) and the delivered code, even when only a delta was requested:

- Inventory every contracted field, rule, default and outcome by qualified address (slice, declaration and member as applicable). Map each to the implementing code location or mark it missing.
- Walk the implemented slice back to the contract. Map every business field and default, including implicit defaults and derived values, to its contract element. Mark anything extra as unspecified; don't treat code as a new decision.
- For every contracted scenario, record its address, the named executable spec and its exact locator, and the result (or not run). Reuse an existing spec only if it witnesses that same scenario; add a case for uncovered behavior. A result from a different engine is not target proof.

Report the inventory, witness mapping and all unmatched or unverified items. For example, map `Library.Authors.RegisterAuthor`'s blank-name outcome to the rule and the specific test that checks the refusal and no append, not just to a green backend suite.
