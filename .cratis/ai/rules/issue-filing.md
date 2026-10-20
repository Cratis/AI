---
name: issue-filing
description: GitHub issue body format and acceptance-criteria structure for filed issues in Cratis repositories
metadata:
  type: convention
---

# Issue Filing Format

When filing a GitHub issue in response to instructions from the AI Corpus (whether by a direct bot, consuming repository scripts, or manual filing), include a **`## Acceptance criteria`** section with concrete, testable bullets. This establishes clear closure conditions and makes the issue actionable for reviewers and assignees.

## Format

Every filed issue should include:

```markdown
## Acceptance criteria

- Concrete, testable acceptance criterion 1
- Concrete, testable acceptance criterion 2
- One per bullet; avoid compound conditions
```

**Why it matters:** Acceptance criteria clarify what "done" means. They make the issue testable, help reviewers evaluate completeness, and prevent scope creep by setting explicit boundaries.

## Example

Issue filed to document a new rule in the corpus:

```markdown
## Instructions that tell to open issues should include acceptance criteria

We should add a rule that specifies the format when filing GitHub issues.

## Acceptance criteria

- New rule file created in `.cratis/ai/rules/issue-filing.md`
- Rule includes the `## Acceptance criteria` format with concrete example
- Cross-link added to `local-work-artifacts.md` where issues are suggested
- Markdown validation passes for the new rule
```

## Scope

This applies to any issue filed in response to AI Corpus instructions:

- **Direct bot issues** — issues created by the Direct bot or similar automation in response to corpus directives
- **Consuming repository scripts** — issues filed by local tooling or workflows in a repository that uses the Cratis corpus
- **Manual filing** — issues opened by hand when the AI Corpus instructs to file an issue (e.g., "open a follow-up issue for X")

It does **not** mandate acceptance criteria for ad-hoc issues filed outside these contexts, though following the format is encouraged for consistency.

## Related

- [[local-work-artifacts]] — when to suggest opening an issue instead of keeping work records
- [[pull-requests]] — issue references and closing conventions in PR descriptions
