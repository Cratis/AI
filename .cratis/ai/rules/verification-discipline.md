---
applyTo: "**/*"
paths:
  - "**/*"
---

# Verification discipline

Run the smallest fresh check that can disprove the change. Report command, result and omissions. CI confirms afterwards.

- Reuse fixtures, not mutable state. Give parallel cases independent state, ports, paths and names; don't serialize the suite or disable shared setup to hide interference.
- When changing a test loop or harness, report cold full-suite wall time and focused-loop time before and after. Fix a slowdown in the same change. A sub-minute cold run is a budget, not a reason to drop coverage.
- Keep the consumer's own routing and service-boundary regression tests on pull requests. Before retiring a redundant consumer assertion, name the upstream spec that fails if the same guarantee breaks.
- Escalate a slow mandatory harness to its upstream owner instead of bypassing it.
