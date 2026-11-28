---
applyTo: "**/*.cs"
paths:
  - "**/*.cs"
---
<!-- cratis-ai: generated Copilot instructions. Do not edit; rules/ is the source. -->

# Concepts

Use `ConceptAs<T>` for named scalars; use `EventSourceId<T>` only for Chronicle history identity. Keep concepts with their owner until callers share the meaning, not merely the representation.
