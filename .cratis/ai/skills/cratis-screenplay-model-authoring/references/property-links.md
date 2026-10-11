<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Inspect a property's chain before changing it

## Contents

- Address and query
- Read evidence, not just a count

Screenplay 4.138.0 released property-path evidence in `find-references` and
`dependencies`; this guidance was checked against 4.139.0. Discover installed
`tools/list`: CLI 3.53.1's 4.137.0 bundle predates it. These are read-only
inspection tools, not a property-change planner.

## Address and query

Use `kind: "Property"`, case-sensitive. Append the member to its owner's exact
logical address: `Owner.member`. For an event this selects the current generation;
`Owner.generationN.member` selects a historical shape, whose target details carry
`historical: true`. Properties are not returned in declaration listings: locate
the owner and inspect its properties first.

On the command-surface [enum example](../../cratis-screenplay-command-surface/references/enum-numbers.md),
first inspect the event with `find-references`:

```json
{
  "address": "Invoicing.Issuing.SendingInvoice.InvoiceSent",
  "kind": "Event"
}
```

At 4.139.0 this returns two references (`produces`, `thenEvent`), with top-level
`totalCount: 2`, `references` and empty `ambiguous`, `incomplete`, `wrongKind`
arrays. The event response has no `complete` field. Query its property separately:

```json
{
  "address": "Invoicing.Issuing.SendingInvoice.InvoiceSent.status",
  "kind": "Property"
}
```

Then query direct mapping counterparts with `dependencies`:

```json
{
  "address": "Invoicing.Issuing.SendingInvoice.InvoiceSent.status",
  "kind": "Property",
  "direction": "outgoing"
}
```

Both tools accept `offset`, `limit` and `expectedSourceRevision`; echo the first
response's `sourceRevision` on continuation pages. `dependencies` additionally
accepts `direction: "incoming"` (default), `descendants` and `document`. It follows
**direct mapping counterparts only**, not a transitive property chain or runtime
impact. Query each resolved counterpart separately when walking a longer chain.

## Read evidence, not just a count

`find-references` returns top-level `references`, `ambiguous`, `incomplete`,
`complete`, `totalCount`, `offset`, `nextOffset` and `coverage`. Ambiguous/incomplete
rows contain `reference` and `candidates`. `dependencies` instead has
`page.items`, each carrying `reference`, `resolution` and `targets`, with paging
inside `page`; `complete` and `coverage` stay at the top level.

Each property reference retains `owner`, `location`, `role`, `reasons` and
`otherEnd` (the link's resolved other end, or null). For outgoing dependencies,
navigate `targets`, not an assumed interpretation of `otherEnd`. Evidence roles are:

| Role | Meaning |
| --- | --- |
| `mapping-source`, `mapping-target` | Explicit production, capture append or projection mapping end |
| `automap` | Derived case-insensitive projection link |
| `condition` | Declarative condition, including query filters and policy readers |
| `key` | Lookup/read, projection/join/removal/parent, constraint or stream-id key |
| `screen-binding` | Screen/form field use |
| `fixture`, `assertion` | Specification/example assignment or expected value |
| `response` | Command response property source |
| `opaque` | Text names the property; code is not resolved |
| `unclassified` | Conservative backstop found a name occurrence outside classified links |

### Observed result on the compiled example (4.139.0)

The property `find-references` response has `success: true`, `complete: false`,
`totalCount: 3`, `nextOffset: null`: two resolved references (`mapping-target`
on the command's `status = status`, and `assertion` on `then InvoiceSent`),
and one `incomplete` entry. Its `reference.role` is `unclassified`, located at the
specification's command-input `status` assignment, with `reference.reasons`:

```json
["Property name occurs in referencing declaration text without a classified link."]
```

Outgoing `dependencies` also reports `success: true`, `complete: false` and
`page.totalCount: 1`. Its resolved `page.items[0]` has a `mapping-source`
reference; `targets[0].address` is
`Invoicing.Issuing.SendingInvoice.SendInvoice.status`, while the reference's
`otherEnd.address` is the queried event property. The property's completeness
covers all indexed evidence even when the chosen direction's page has only a
resolved link. The workspace had `sourceSuccess: true`, no source diagnostics
and `readiness.executableReady: true`: compilation success does not imply
complete property evidence.

**`complete: false` is never a successful empty list.** Inspect every ambiguous
or incomplete row and its `reasons`/candidates, even when resolved `references`
is empty. `success` describes compilation, not completeness. Opaque occurrences,
unresolved counterparts, nested composite paths, legacy command reads and external
source items can leave incomplete evidence. The backstop counts whole-word names
case-insensitively in relevant typed source and comments, including quoted text;
same-named properties in unrelated declarations do not affect completeness.
External code contents and registrations remain outside coverage even with
`complete: true`; authored links do not prove executable admission.

Before a rename/removal: pin the revision, inspect incoming readers and outgoing
counterparts, page to completion, resolve uncertainties, then choose the supported
identity-safe edit route with the connection owner. Never infer safe deletion from
zero resolved hits or edit every same-named field. An event-property change still
needs a persisted-contract evolution decision; the catalog is not storage evidence.

Source/output authority: `v4.139.0:Documentation/screenplay/mcp/reference.md`
(property links), `Source/DotNET/Screenplay.Mcp/McpPropertyDependencies.cs`,
`McpToolSchemas.cs`, and decision 0044's released prerequisite index. The planner
phases in that decision are not release evidence.
