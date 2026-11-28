---
applyTo: "**/*"
paths:
  - "**/*"
---

# Verification discipline

Run the smallest fresh check that can disprove the change. Report command, result and omissions. CI confirms afterwards.

- Reuse fixtures, not mutable state. Give parallel cases independent state, ports, paths and names; don't serialize the suite or disable shared setup to hide interference.

## Keep low-cost tests without losing guarantees

- **[contract] Keep consumer-owned routing, end-to-end flow and cross-service regression checks in the PR lane.** Do not move them upstream or to nightly.
- **[contract] Before removing or relocating a consumer assertion, identify the specific case in the owning repository that would fail on the same regression.** Keep the assertion if there is no such case.
- **[contract] Measure both the cold full-suite time and the focused-loop time before and after test-cost changes, including a test loop or harness change.** Report both, with the conditions kept comparable. Fix a slowdown in the same change; a sub-minute cold run is a budget, not a reason to drop coverage.
- Escalate a slow mandatory harness to its upstream owner instead of bypassing it.
