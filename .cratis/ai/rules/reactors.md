---
applyTo: "**/*.cs"
paths:
  - "**/*.cs"
profile: application
---

# Reactors

Deliver external effects after commit. Decide whether replay should repeat the effect; skipping replay does not prevent redelivery. Use a stable key per delivery and effect that the receiver deduplicates. Do not swallow a failed delivery or append directly to the default log.
