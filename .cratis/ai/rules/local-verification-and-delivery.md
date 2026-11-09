---
profile: cratis/engineering
---

# Verify locally, deliver once

CI/CD is a shared, finite resource and a confirmation, not a feedback loop.

- **Verify locally before anything leaves the machine.** Build and run the affected specs, lint and type-check locally. Never push to find out whether something works, and never use a CI run to discover a failure a local run would show.
- **Push and open a PR only when ready.** Ready means the local gates passed on the exact head you push and the description follows [pull-requests.md](./pull-requests.md). Do not open draft or placeholder PRs, push work in progress, or push repeatedly to retrigger CI. After a CI failure, reproduce it locally, fix it and re-verify before pushing again.
- **One consolidated PR per repository.** Work spread over several sub-agents, lanes or tasks in the same repository ships as one branch and one PR, not one PR each. As orchestrator, say so in every brief: sub-agents deliver verified commits on a shared integration branch (or branches the orchestrator folds in) and never push or open a PR; the orchestrator verifies the combined result locally, then pushes and opens the single PR once. Split only for the reasons in [pull-requests.md](./pull-requests.md) (a named major, an authorized urgent security fix, an accepted outsider issue).
