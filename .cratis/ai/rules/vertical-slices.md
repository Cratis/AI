---
applyTo: "**/*.cs, **/*.tsx"
profile: application
paths:
  - "**/*.cs"
  - "**/*.tsx"
---

# Vertical slices

Group by behavior. Read published state or react to another slice’s fact; never call its handler. Compose through the pipeline and propagate refusal. Route facts to the intended history; exclude confidential inputs from causation. Append observed transitions, not repeated polls; protect the decision against concurrent writers.

Put slices directly under the application source root as `<Module>/<Feature>/<Slice>/`, without a top-level `Features/` wrapper. A single-capability application that has not needed modules starts at `<Feature>/<Slice>/`. Keep the slice's files together and have the namespace mirror their path. A namespace rename can change stored observer identities and Arc routes; treat it as a migration, not a file move.

A command scenario owns the command and accepted facts; a read-model scenario owns its projection and query. Use a delivery scenario for a reaction to a committed fact and an adapter spec for translating an external message into local intent.

`Features/` and `Library.Features.*` in the corpus's Library examples are specific to that example, not the house layout. Use the project's actual namespaces when checking those examples' routes, proxy imports and observer IDs.
