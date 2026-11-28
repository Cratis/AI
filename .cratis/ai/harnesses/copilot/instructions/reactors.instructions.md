---
applyTo: "**/*.cs"
paths:
  - "**/*.cs"
profile: application
---
<!-- cratis-ai: generated Copilot instructions. Do not edit; rules/ is the source. -->

# Reactors

Deliver external effects after commit. Decide whether replay should repeat the effect; skipping replay does not prevent redelivery. Use a stable key per delivery and effect that the receiver deduplicates. Do not swallow a failed delivery or append directly to the default log.

## Failure transitions

A recorded domain failure must promptly move the workflow to a visible outcome; a watchdog covers missing signals, not known failures. Give the transition one reliable owner. Use the existing state machine when there is one, not a second failure reactor. Handle redelivery idempotently and correlate by attempt ID so a late failure from an earlier attempt cannot overturn the current one. Keep secrets out of public failure reasons.
