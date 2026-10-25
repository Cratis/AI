<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Context handoff

A handoff lets a fresh session continue work. Save it as
`<work-root>/<task>/handoff-<lane-id>.md`. It opens with the preconditions
(repository, branch, expected `HEAD`, worktree paths, date) required by
[local-work-artifacts.md](../../../rules/local-work-artifacts.md). The next
session compares them with `git` before acting; a mismatch means the handoff is
stale, not that the work is lost.

## Template

```markdown
# Handoff: <task>, lane <lane-id>

**Preconditions:** repository `<repo>`, branch `<branch>`, HEAD `<full-sha>`,
worktrees `<paths>`, written `<date>`.

## Goal
<one sentence>

## Verified facts (with evidence)
- <fact>: <evidence: command run, SHA, run id>

## Plans and hypotheses (not verified)
- <plan or guess>

## Watch and action
| Watch | When it changes | Action |
|---|---|---|
| <thing to observe> | <condition> | <what to do> |

## User constraints (verbatim)
> <quoted exactly, never paraphrased>

## Next commands
1. `<command>`

## Files to read
- `<path>`
```

Keep facts and plans in separate sections. A claim without evidence belongs
under plans.

## Filled example

```markdown
# Handoff: export retry cap, lane A1

**Preconditions:** repository `<repo>`, branch `export-retry`, HEAD
`0123456789abcdef0123456789abcdef01234567`, worktree `../.worktrees/export-retry`,
written 2025-01-01.

## Goal
Cap export retries at five and surface the final failure.

## Verified facts (with evidence)
- Cap and spec committed: `git log -1` shows the SHA above.
- Spec project passes: `dotnet test Source/Export.Specs` exit 0 at that SHA.
- Pull request is open: `gh pr list --head export-retry` shows one entry; CI run
  `1234567890` is in progress.

## Plans and hypotheses (not verified)
- The integration job may need the same cap; not inspected.

## Watch and action
| Watch | When it changes | Action |
|---|---|---|
| CI run `1234567890` | fails | read the failing job log, fix in owned files |
| PR review | blocking finding | start a delta round, not a restart |

## User constraints (verbatim)
> Do not change the public job interface.

## Next commands
1. `git rev-parse HEAD` and compare with the preconditions
2. `gh run view 1234567890 --json status,conclusion`

## Files to read
- `Source/Export/ExportJob.cs`
- `.ai-work/export-retry/brief-A1.md`
```
