---
applyTo: "**/*"
paths:
  - "**/*"
---

# Verification discipline

Run the smallest fresh check that can disprove the change. Isolate parallel cases; reuse fixtures, not mutable state. Report command, result and omissions. CI confirms afterwards.
