---
applyTo: "**/*.{ts,tsx}"
profile: application
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
<!-- cratis-ai: generated Copilot instructions. Do not edit; rules/ is the source. -->

# Frontend quality

Split a crowded component by behavior, not a line-count threshold. Preserve keyboard reachability, visible focus and actionable error states when extracting controls. Follow the component README contract in `components.md` when changing state ownership or extension points.


- Do not ship stub controls, lorem ipsum or fake counts as real UI. Remove the placeholder and its strings when real behavior lands.
- After replacing a `.tsx` body, read through the end of the file for stale JSX, duplicate bodies and unreachable code.
- Keep helpers beside their slice until a second real consumer needs the same behavior; then promote them to shared components.
