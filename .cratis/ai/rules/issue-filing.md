---
name: issue-filing
description: GitHub issue body format and acceptance-criteria structure for filed issues in Cratis repositories
metadata:
  type: application
---

# Filing GitHub Issues with Acceptance Criteria

When you file a GitHub issue in response to AI corpus instructions — whether through a Direct bot script, a consuming repository's own automation, or manual filing — use the `## Acceptance criteria` section to define concrete, testable conditions for closure.

## Format

Every filed issue should include:

```markdown
## Acceptance criteria

- Concrete criterion one
- Concrete criterion two
- Concrete criterion three
```

The section must be:
- **Present** — every issue filed from AI corpus instructions includes it
- **Bullet-based** — unordered list only, one criterion per bullet
- **Testable** — each bullet names something observable or verifiable, not vague intent
- **Self-contained** — a reader understands the closure conditions without external context

## Example

```markdown
# Issues registered should include acceptance criteria

An earlier investigation established that the AI Corpus lacks guidance on issue-body format.

## Acceptance criteria

- Instructions that tell to open issues should include acceptance criteria in the defined format
- The guidance is discoverable from the corpus rules that suggest filing issues
- The format is consistent with decision-record conventions already in use in this repository
```

## Why acceptance criteria matter

Acceptance criteria clarify *how* the filed issue should be considered closed. They serve as:
- **Definition of done** — what specific state change, documentation update, or code change resolves the issue
- **Closure gates** — a way to distinguish "I fixed something vaguely related" from "the issue is actually resolved"
- **Reviewer clarity** — reviewers know what to look for in a PR that closes the issue

Without acceptance criteria, issues linger with ambiguous scope and reviewers merge changes that may or may not address the original request.

## Scope

This format applies to any issue filed in response to AI corpus instructions, including:
- Issues filed by the Direct bot (`cratis-direct[bot]`) when proposing follow-up work
- Issues filed by consuming repository automation (CI scripts, workflow runners, post-merge hooks)
- Issues filed manually during AI-assisted sessions when the session's instructions suggest opening an issue

It does **not** constrain manually-filed issues in repositories that have no related AI corpus guidance.

## Related

- [[local-work-artifacts.md]] — When to file issues vs. keeping work records
- [[pull-requests.md]] — Related: issue references and closure in PR descriptions
