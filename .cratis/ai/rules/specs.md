---
applyTo: "**/for_*/**/*.*, **/when_*/**/*.*"
paths:
  - "**/for_*/**/*.*"
  - "**/when_*/**/*.*"
---

# Specs

Name observable behavior as a sentence. Cover contracted decisions, refusals and constraints, not getters, logging or forwarding. Use real event and projection scenarios; substitute owned collaborators. Keep specs with the feature. Before deleting a slice, check its dependencies and remove only its private implementation and private specs. Keep persisted event types, upcasters and historical readers, replay fixtures, audit and redaction checks, and durable contract tests. Map each contract example to an executed case; record approved divergence and block on unresolved gaps.
