---
applyTo: "**/*"
paths:
  - "**/*"
---

# Verification discipline

Run the smallest fresh check that can disprove the change. Isolate parallel cases; reuse fixtures, not mutable state. Report command, result and omissions. CI confirms afterwards.

## Keep low-cost tests without losing guarantees

- **[contract] Keep consumer-owned routing, end-to-end flow and cross-service regression checks in the PR lane.** Do not move them upstream or to nightly.
- **[contract] Before removing or relocating a consumer assertion, identify the specific case in the owning repository that would fail on the same regression.** Keep the assertion if there is no such case.
- **[contract] Measure both the cold full-suite time and the focused-loop time before and after test-cost changes.** Report both, with the conditions kept comparable.
