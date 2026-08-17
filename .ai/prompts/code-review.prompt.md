---
agent: agent
description: Review a proposed change for correctness, maintainability, and security.
---

# Code Review Prompt

Review the proposed change for correctness, maintainability, and security.
Focus on actionable findings and minimize false positives.

Invoke the **review-code** skill and follow it exactly; add the **review-security** skill when the
change touches input handling, authorization, secrets, or data exposure. For a full pull-request
review — architecture, security, spec coverage, and documentation in one structured report — use
the **review-pr** prompt instead. The skills carry the step-by-step detail; don't duplicate it here.
