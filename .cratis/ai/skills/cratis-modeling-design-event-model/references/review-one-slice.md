# Review one slice

Use one instance to follow a decision into its result. A walkthrough may span several slices: the librarian registers Aster, then sees Aster in the list. A specification witnesses **one** slice: the registration example expects an addressed fact; the list example starts with that fact and expects a row. Neither needs to test the other's decision again.

## Follow a value, including its address

For `RegisterAuthor`, the librarian acts; the librarian's user ID is not the `AuthorId`. Library owns the vocabulary, and the individual author owns this history. `AuthorRegistered` names the event schema, not the author. A collection query over many authors does not turn their histories into one list history.

Let A stand for `11111111-1111-4111-8111-111111111111`. Start with A unused. The following trace explains the `ListAuthors` result from one registration:

| Value | Source | Mapping | Consumer | Gap to settle |
| --- | --- | --- | --- | --- |
| A | Add author dialog generates a fresh ID for the new author | Command `Id` addresses the append; the projection takes the event source ID from context as the row ID | `AllAuthors` returns row A | None for this route; do not add `Id` to the payload |
| Aster | Librarian enters the name in the form | Command `Name` becomes `AuthorRegistered.Name` (string), then `Author.Name` | The Authors list shows Aster | No spelling change in this example |
| Registration date, if newly requested | Not in the agreed result | Does the reader mean occurrence time or a business date supplied by someone? | Proposed date column | Ask before choosing a source or derivation |

Trace inputs **to the decision** as well as outputs. Ask “which decision would fail if this input changed?” If blank names are refused, the command needs the submitted name before deciding; the visible list cannot tell whether the command refused or the projection lagged. If an outcome depends on prior history, name the facts and how to select the right instance. A fresh ID in the request is not evidence that no facts exist at that address. A missing origin blocks acceptance of the result that relies on it, not unrelated slices.

Trace in the other direction too: who uses each proposed fact? If several facts contribute to a display-only “ready” badge, derive the badge in the view. Ask for a new fact only if the domain recognizes a transition and can name a decision, historical question or outside consumer that needs it. If an observer polls an unchanged author twice, do not count two registrations. Describe what changed, for whom, rather than recording that the poll ran.

## Read back the examples

Give the rule, concrete setup, action (if any) and expected result. Ask the owner what changes when one significant value differs:

- **Refusal, if agreed:** same unused A, blank name instead of Aster. The command explains the name rule and no fact is appended to A.
- **Successful no-op, for an import that records first sight:** Directory has already supplied A with name Aster. Seeing that same record again succeeds without a second `DirectoryAuthorSeen`. Whether the welcome reaction can receive the first fact twice is a different question: should a second welcome be requested?

Ask about missing, duplicate or out-of-order observations when the answer changes a decision. For example, if Directory sends two different names for A out of order, which observation counts as current, and what evidence establishes that? Leave the answer open if the source supplies no ordering information.

## Bound a change

Start with the surprising example. If Library wants a different display name, does the registration decision change, the stored fact, or only the projection? Trace the changed value through the producing decision, existing histories, row key, query, UI and public mappings that actually consume it. Revisit the affected examples with their owner; leave independent slices alone. Report the rule that changed, its consumers and any result still awaiting a decision.
