---
name: cratis-orchestration-merge-gates
description: Decide when an assembled candidate may merge during multi-lane work, using tier names, GitHub state for serial merge turns, a stale-head check, the review budget and an unattended no-prompt contract. Use when naming the gate tier for a lane, deciding whether it is this pull request's turn to merge, checking that a green run belongs to the current head, bounding review rounds for a lane, or making a command safe to run unattended. Not for ordinary single-session merging (use cratis-engineering-ci-gates), lane claims and briefs (use cratis-orchestration-lanes), review rounds themselves (use cratis-engineering-review-rounds), or grouping a release candidate (use cratis-engineering-release-trains).
license: LICENSE
compatibility: Requires git and the GitHub CLI (gh).
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Merge in turn, on evidence

This skill applies to multi-lane work where several pull requests merge into
one repository. A single session follows `cratis-engineering-ci-gates`.
Merging, like any external effect, needs the user's request or brief to
authorize it: read
[capability-is-not-authority.md](../../rules/capability-is-not-authority.md).
Placeholders such as `<coordinator>` and the default time boxes come from
`cratis-orchestration-lanes` and its
[placeholders.md](../cratis-orchestration-lanes/references/placeholders.md);
they are not redefined here.

## Tier names

Lanes use short names for the gates already defined in
`cratis-engineering-ci-gates`. That skill owns the gate content; this table only
maps names.

| Lane term | Gate | When |
|---|---|---|
| Iteration | Affected checks | While editing, per lane |
| Ready to merge | Tier 1 on the assembled candidate | Before asking for a merge turn |
| Integration | Tier 2 or CI | On the pushed head, before merge |

A lane's own green iteration result is never ready-to-merge evidence for the
assembled candidate.

## Serial merge is decided by GitHub state

Merge turns are decided by GitHub state, never by a chat or inbox message
saying "go". Merge only when all three hold, each read from GitHub or git just
before the merge:

1. **Predecessors are merged.** Every predecessor pull request the candidate
   depends on is `MERGED`, not merely approved or green.
2. **No publish is running.** No publish run of the repository is queued or
   in progress. A merge during a publish can race the release or be released
   under an unexpected version.
3. **No overlap since CI ran.** Main has no changes touching the candidate's
   paths since the commit its CI ran on:
   `git log <ci-sha>..origin/main -- <paths>` prints nothing.

If any check fails, do not merge and do not wait in a loop: report which check
failed and the evidence, then hand the turn back to `<coordinator>`. Read
[references/merge-queue.md](references/merge-queue.md) for the `gh api`
commands and a worked example.

## Green but stale

A green run on an older head is not evidence for the current head. Before
merging, compare the full SHA of the pull request head with the head SHA of the
run you rely on. Different SHAs mean the run proves nothing: wait for or start
the run for the current head, following `cratis-engineering-ci-gates`. The same
applies after a base update: a run on the pre-update head is stale.

## Review budget

Review rounds follow `cratis-engineering-review-rounds`, including its
**Contract** table of round inputs and result states. The cap is 3 rounds per
work item; a brief may lower it, never raise it. A review that fails on a
provider or tool error is Incomplete, not approval, and does not open an extra
round.

## Unattended contract

Unattended lanes have nobody to answer a question. No hook or tool may wait for
interactive input.

- Make every command non-interactive: pass explicit flags, close stdin, and
  provide values rather than prompting for them.
- Time boxes for a targeted check, a build or test phase and the detach
  threshold are the defaults in the lanes skill's
  [placeholders.md](../cratis-orchestration-lanes/references/placeholders.md);
  the queue wait is set by the brief.
- A silent command is diagnosed, not given more time: check the process, its
  output and what it waits on, then fix or report.
- Work beyond the detach threshold runs detached and reports through a
  completion notification; the lane does not poll it.
- Never loosen a hook, allowlist or guard to get past a prompt. A prompt that
  cannot be answered is a blocker: send a `blocked` message and stop.

Read [references/unattended-guards.md](references/unattended-guards.md) for the
checkable form of this contract.

## Verify

- Each merge records the three state checks with the commands and results.
- The run relied on names the same full SHA as the pull request head.
- The ready-to-merge gate ran on the assembled candidate, not a lane branch.
- No command in the lane's brief waits for input or runs without a time box.
