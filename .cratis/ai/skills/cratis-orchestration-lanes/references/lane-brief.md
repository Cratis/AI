<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Lane brief

A brief is the contract between the coordinator and one lane. Write it so a
session with no other context can carry it out. Save it as
`<work-root>/<task>/brief-<lane-id>.md`.

## Template

```markdown
# Brief: <task title>, lane <lane-id>

**Valid for:** repository `<repo>`, branch `<branch>`, base `<base-sha>`,
written `<date>`. If these differ from `git`, the brief is stale: stop and
report.
**Worktree:** `<worktree-path>`. This lane is the only writer.

**Goal:** <one or two sentences, the outcome and why>.

**Read first:** <rules, skills and files the lane needs, by path>.

**Owned files:** <exact paths or globs. Nothing else may change>.

**Decisions already made:** <choices the lane must not reopen>.

**Gate command:** `<gate-command>`. Run it as written; run nothing heavier.

**Done =**
- [ ] <observable outcome 1>
- [ ] `<gate-command>` exits 0 on the final state
- [ ] `git diff --stat` shows only the owned files
- [ ] <regenerate generated evidence, if the change affects any>

**Stop and report if:** <conditions: a rule conflicts with a decision, the
change needs a file outside the owned list, a consequential item appears>.

**Report (at most <n> characters):** files changed, checks run with exact
results, unrelated issues observed, open questions.
```

## Filled example

```markdown
# Brief: add retry limit to the export job, lane A1

**Valid for:** repository `<repo>`, branch `export-retry`, base `0123abc`,
written 2025-01-01.
**Worktree:** `../.worktrees/export-retry`. This lane is the only writer.

**Goal:** The export job retries forever on a failing upload. Cap it at five
attempts and surface the final failure.

**Read first:** `Source/Export/ExportJob.cs`, its specs, and the repository's
C# rules.

**Owned files:** `Source/Export/ExportJob.cs`, `Source/Export.Specs/**`.

**Decisions already made:** the cap is five and is a constant, not
configuration.

**Gate command:** `dotnet test Source/Export.Specs`.

**Done =**
- [ ] A failing upload stops after five attempts and reports the error
- [ ] A spec covers the fifth failure and a success on the third attempt
- [ ] `dotnet test Source/Export.Specs` exits 0
- [ ] `git diff --stat` shows only the owned files

**Stop and report if:** a public type must change, or another file needs edits.

**Report (at most 1,500 characters):** files changed, checks run, unrelated
issues, open questions.
```

## Rules for the author

- One gate command, copied from the repository's own gate; no ad hoc builds.
- Every `Done =` item is checkable by a command or a diff, not by opinion.
- Stop conditions name the escalation classes from the skill: public contract,
  breaking change, security, production data, product direction, spending.
- No credentials and no personal values in a brief.
