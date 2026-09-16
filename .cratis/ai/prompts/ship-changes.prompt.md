---
agent: agent
description: >
  Ship local changes: create a branch, make logical commits, push, open and
  label a PR with a proper description, merge it, confirm the release reached
  its consumers, close the issues it shipped, and delete the branch.
---

# Ship Changes

Ship the current local modifications to `main` through the standard
branch → commits → PR → merge → delivery → issue closure → cleanup workflow.

## Inputs

- **What changed** — brief description of the work (used for branch name and PR title)
- **Label** — `no-release`, `patch`, `minor`, or `major`, or omit entirely if no label should be applied
- **Related issue** — optional exact repository and issue number; if unknown, search read-only first. Reference it in the description as a bare `(#123)`, never a closing keyword.

Invoking this prompt is direct authority for the standard branch, commit, push, pull-request,
requested-label, merge, issue-closure, and branch-cleanup effects. Do not pause to ask for separate
approval at each step. Follow the repository's Git commit and pull-request rules, use a true merge
commit, and verify required checks before merging.

## Shipping does not end at the merge

A merged pull request has shipped nothing until the release reaches its consumers. After merging:

1. **Watch the release through to delivery** — the publish, deploy and post-deploy verification the
   repository actually runs. A failed or skipped delivery job means every issue the change named is
   still unshipped; fix or re-run it, or report it as a blocker.
2. **Close the issues the release shipped**, each with a comment naming the version and the pull
   request, per [Close what the release actually shipped](../rules/pull-requests.md). An issue only
   partly addressed stays open and says which part landed.
3. **Delete the branch** once both are done.
