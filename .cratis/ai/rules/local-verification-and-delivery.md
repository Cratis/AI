---
profile: cratis/engineering
---

# Verify locally, deliver once

CI/CD is shared and finite: it confirms, it is not a feedback loop.

- Use the `criticality-tiers` rule for local gates; reuse valid unchanged-input results. Never push as a feedback loop; reproduce relevant CI failures locally.
- Push and open a PR only when applicable checks pass for its inputs. Required CI remains binding. No draft, placeholder or WIP PRs.
- One PR per repository. As orchestrator, brief sub-agents to commit verified work to the shared branch and never push or open a PR; you verify the combination and open the one PR. Split only when the parts release independently or the user asks for it; **cratis-platform-prepare-release-pr** owns the title, label and release notes.
