---
applyTo: "**/for_*/**/*.*, **/when_*/**/*.*"
paths:
  - "**/for_*/**/*.*"
  - "**/when_*/**/*.*"
---

# Specs

Name observable behavior as a sentence. Cover contracted decisions, refusals and constraints, not getters, logging or forwarding. Use real event and projection scenarios; substitute owned collaborators. Keep specs with the feature. Before deleting a slice, check its dependencies and remove only its private implementation and private specs. Keep persisted event types, upcasters and historical readers, replay fixtures, audit and redaction checks, and durable contract tests. Name the contract (`.play` slice or agreed outline) and use its example values. Map each contract example to an executed case and report example → case → result, including cases not run. List cases inferred from code separately as proposed contract changes, not contract coverage. Record approved divergence and block on unresolved gaps.

For one outcome, use one `for_<Subject>/when_<behavior>` file or case. For alternatives, use `for_<Subject>/when_<behavior>/` with one file per outcome, named `and_<condition>`, `with_<condition>` or `without_<condition>`. Put shared givens in `for_<Subject>/given/`.

Shared givens contain setup only. Perform the action under test in each concrete case; moving it into a shared given hides the behavior the case specifies.
