---
agent: agent
description: Implement a requested feature as a vertical slice with minimal, focused changes.
---

# New Feature Prompt

Implement the requested feature as a vertical slice with minimal, focused changes.
Add or update tests for behavior changes and validate build/test before completion.

Invoke the **new-vertical-slice** skill and follow it exactly. When the feature needs a brand-new
feature folder (composition page, routing, navigation) before any slice exists, run the
**scaffold-feature** prompt/skill first. The authoritative rules are `.ai/rules/general.md` and
`.ai/rules/vertical-slices.md`; the skill carries the step-by-step detail. Don't duplicate it here.
