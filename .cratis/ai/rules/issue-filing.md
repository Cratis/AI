---
name: issue-filing
description: GitHub issue body format and acceptance-criteria structure for filed issues in Cratis repositories
metadata:
  type: reference
---

# Filing GitHub Issues

When filing a GitHub issue in response to AI corpus instructions, use a consistent structure that makes the work clear and testable. This applies whether the issue is filed by Direct, a consuming repository's own automation, or manual filing.

## Issue Body Format

Every filed issue must include a `## Acceptance criteria` section with concrete, testable bullets. The format is:

```markdown
## Acceptance criteria

- Specific, observable outcome one
- Specific, observable outcome two
- Specific, observable outcome three
```

### Why Acceptance Criteria Matter

- **Clarity for reviewers** — acceptance criteria are the first thing a reviewer reads to understand what "done" means.
- **Testability** — each bullet must be something a reader can verify is true or false; vague goals are not acceptable.
- **Closure condition** — the issue is complete only when every bullet is satisfied.

### Example

From issue #533 itself:

```markdown
## Acceptance criteria

- Instructions that tell to open issues should include acceptance criteria in the defined format
```

## Scope

This format applies to:

- Issues filed by the Direct bot when instructed to file issues by the AI Corpus
- Issues filed by a consuming repository's own automation in response to corpus guidance
- Manual issues filed in Cratis repositories when the issue captures acceptance criteria

The format does **not** apply to issues filed without AI Corpus guidance (e.g., issues filed manually by humans outside any documented workflow), though using the format is encouraged for clarity.

## Related

- [[local-work-artifacts]] — when to file an issue vs. keeping a work record in `.ai-work/`
- [[pull-requests]] — issue references in PR descriptions and how PRs close issues
