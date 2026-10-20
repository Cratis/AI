---
name: cratis-issue-filing
description: GitHub issue body format for an issue filed in response to an AI Corpus instruction in a Cratis repository - a required `## Acceptance criteria` section with concrete, testable bullets. Use when a corpus instruction says to open a follow-up issue, when a direct bot or a repository's own tooling files one, or when reviewing such an issue body for this shape. Not for assigning an issue to a user (see issue-assignment.md) or writing a pull request body (see pull-requests.md).
license: LICENSE
---

# GitHub issue filing format

When an AI Corpus instruction is the reason a GitHub issue gets filed — a direct
bot, a consuming repository's own tooling, or an agent told to open a follow-up —
give the issue a `## Acceptance criteria` section with concrete, testable bullets.
It states what "done" means for whoever picks the issue up, and keeps the issue's
scope from drifting after it is filed.

## Format

```markdown
## Acceptance criteria

- Concrete, testable acceptance criterion
- One per bullet; avoid compound conditions
```

Each bullet should be checkable by reading the result, not by asking the author
what they meant — "the new endpoint returns 404 for an unknown id" rather than
"error handling is improved."

## Scope

Applies to any issue filed because of an AI Corpus instruction: a direct bot, a
consuming repository's local scripts or workflows, or a human or agent opening a
follow-up issue a corpus rule or skill pointed them to. It does not mandate the
section for an issue filed outside that context, though using the same format
there is still encouraged for consistency.

## Related

- [local-work-artifacts.md](../../rules/local-work-artifacts.md) is the rule that
  suggests opening an issue instead of leaving a work record behind.
- [pull-requests.md](../../rules/pull-requests.md) covers how a pull request
  references the issue it delivers.
