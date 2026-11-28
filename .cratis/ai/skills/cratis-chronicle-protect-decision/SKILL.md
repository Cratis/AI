---
name: cratis-chronicle-protect-decision
description: Use when a write depends on event-derived state and must be refused if a competing write changes that state. Not for reserving a unique value across sources (use cratis-chronicle-constrain-append).
compatibility: An application client and kernel that support the required guarded append.
---

# Guard the facts that made the decision true

For the last available copy, two borrowers may both see one copy. A materialized view, passive read, or successful validator alone does not reserve it. Enroll the decision read in the unit that commits, or attach an explicit check covering every fact used. If the client cannot express the dependency, move the whole operation to a service that can. Use a normal read for display and a store constraint for cross-source uniqueness.

- `.csproj`: [enroll an Arc command](references/csharp.md) or [guard a standalone append](references/standalone.md).
- Node server `package.json`: no inferred read enrollment; [attach an explicit scope](references/typescript.md) or delegate.
- `.kt`: no inferred read enrollment; [use a suspending append with an explicit scope](references/kotlin.md) or delegate.
- `.java`: no inferred read enrollment; [build guarded append options](references/java.md) or delegate.
- `go.mod`: [enroll a decision in its owner's commit](references/go.md).
- `mix.exs`: [read inside the decision callback](references/elixir.md).
- Python has no released application client: [delegate the guarded command](references/python.md).

In a disposable namespace, pause after reading, complete a matching write from a second participant, then resume. Expect refusal and no event from the stale decision. A successful single-writer test does not prove protection. On a confirmed conflict, reread and reevaluate the business rule; do not blindly resubmit. If the commit outcome is unknown, resolve it before retrying.
