---
name: issue-filing
description: GitHub issue body format and acceptance-criteria structure for filed issues in Cratis repositories
metadata:
  type: application
---

# Filing GitHub Issues with Acceptance Criteria

When filing a GitHub issue from AI corpus instructions — a Direct bot script, a consuming repository's own automation, or manual filing during a session — include a `## Acceptance criteria` section with concrete, testable conditions for closure.

## Format

```markdown
## Acceptance criteria

- Concrete criterion one
- Concrete criterion two
```

Each bullet is testable (observable or verifiable, not vague intent) and self-contained (understandable without external context).

## Scope

Applies to issues filed by the Direct bot, by consuming repository automation, or manually during an AI-assisted session when the session's instructions suggest opening one. Does not constrain manually-filed issues in repositories with no related AI corpus guidance.

## Related

- [[local-work-artifacts.md]] — when to file issues vs. keeping work records
- [[pull-requests.md]] — issue references and closure in PR descriptions
