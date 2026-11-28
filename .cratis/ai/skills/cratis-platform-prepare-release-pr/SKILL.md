---
name: cratis-platform-prepare-release-pr
description: Use when a platform maintainer needs a release-note PR body and intent label, or must explain why a merged change is still pending in a release batch. Not for implementing the product change.
---

# Prepare the note a consumer will read

Inspect the diff against the target branch and the repository's publishing workflow. Identify the affected caller and what changes for them. In a repository using Cratis release labels, choose **exactly one**: `major` for a breaking contract, `minor` for a compatible capability, `patch` for a compatible fix, or `no-release` when there is no consumer release. Do not combine a bump with `no-release`. For changes to the installed corpus, use the [Cratis/AI label guidance](../cratis-commits-and-pull-requests/references/pr-labels-and-release.md#cratisai-corpus-changes).

Write the PR body as release notes, using the repository template and only applicable sections. For example:

```markdown
## Fixed

- Empty author names now return a validation error instead of appearing to register successfully.
```

State the migration for a breaking change. Follow the [PR-body preflight](../cratis-commits-and-pull-requests/references/pr-description.md), including the diff recheck, issue reference policy and checker for opted-in repositories. Preparing a note or label does not authorize a push, merge, dispatch or release. Leave a major for explicit human approval and human merge.

## A green Publish run did not publish the change

First check whether the workflow actually enables batching. With release-action 1.5.2 and batching enabled:

1. Read the main-step log or the step summary's **Explanation**. Inspect `reason` and `pull-requests`; `nothing-pending` is different from `batched`. The post-step log also records the skip reason.
2. For an open window, match the intended PR to the pending list. Record the **oldest pending merge time** and the **window expiry**, both in UTC. For example, if the window expires at 16:00 UTC, check the next scheduled Publish after 16:00, not a presumed release at exactly 16:00. Verify a published release/tag and the relevant package or artifact before announcing availability.
3. If waiting is not acceptable, request an authorized manual Publish. In batch mode an empty version or `0.0.0` releases **all pending changes**, not just this fix. Check the entire pending set and obtain explicit human approval for a pending major. A hotfix merge run can fail against a pending major while a scheduled or unrelated merge run warns and leaves it pending. Don't edit the window, relabel another PR or dispatch a workflow just to clear the queue.

If batching isn't enabled, don't apply the empty-version batch procedure. Follow that repository's actual trigger and inspect its release outputs instead.

For a failed Publish run, use release-action recovery in `cratis-release-notes` (in `cratis/engineering/core`), including what to do when another commit claims the calculated tag. After a hook change, remind installed consumers to run `cratis ai update`.
