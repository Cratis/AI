---
applyTo: "**/*.tsx"
paths:
  - "**/*.tsx"
profile: application
---

# Components

Import controls from their package subpaths, not the configuration root. Give each controlled value one owner. Check the provider for rendering, structural styles for layout and the toast region for missing notifications. Check whether an icon prop expects a component type or a rendered node.

## README.md for complex components

A component folder with subcomponents, hooks or nontrivial state must have a `README.md`. Read it before changing the component. Document the hierarchy, state ownership, design decisions, styling conventions and extension points. Update it in the same change whenever state ownership or extension points change.
