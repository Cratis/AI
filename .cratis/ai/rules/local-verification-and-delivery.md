---
profile: cratis/engineering
---

# Verify locally, deliver once

CI/CD is shared and finite: it confirms, it is not a feedback loop.

- Use [criticality tiers](./criticality-tiers.md) for local gates; reuse valid unchanged-input results. Never push as a feedback loop; reproduce relevant CI failures locally.
- Push and open a PR only when applicable checks pass for its inputs. Required CI remains binding. No draft, placeholder or WIP PRs.
- One PR per repository. As orchestrator, brief sub-agents to commit verified work to the shared branch and never push or open a PR; you verify the combination and open the one PR ([pull-requests.md](./pull-requests.md) lists the split exceptions).
