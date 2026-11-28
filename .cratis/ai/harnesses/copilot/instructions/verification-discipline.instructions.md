---
applyTo: "**/*"
paths:
  - "**/*"
---
<!-- cratis-ai: generated Copilot instructions. Do not edit; rules/ is the source. -->

# Verification discipline

Run the smallest fresh check that crosses the changed boundary and can disprove the change. Report command, result and omissions. CI confirms afterwards.

- Reuse fixtures, not mutable state. Give parallel cases independent state, ports, paths and names without relying on order; don't serialize the suite or disable shared setup to hide interference.

## Keep low-cost tests without losing guarantees

- **[contract] Keep consumer-owned routing, end-to-end flow and service-boundary regression checks in the PR lane.** Do not move them upstream or to nightly.
- **[contract] Before removing or relocating a consumer assertion, identify the specific case in the owning repository that would fail on the same regression.** Keep the assertion if there is no such case.
- **[contract] Measure both the cold full-suite time and the focused folder-loop time for build/spec changes, before and after when test cost may change (including changes to test loops and harnesses).** Report both, with the conditions kept comparable. Fix a slowdown in the same change; a sub-minute cold run is a budget, not a reason to drop coverage.
- Escalate a slow mandatory harness to its upstream owner instead of bypassing it.
