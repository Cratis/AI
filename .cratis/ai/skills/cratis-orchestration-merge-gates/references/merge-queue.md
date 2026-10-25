<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Merge queue state checks

Each check reads GitHub or git state immediately before the merge. Use the REST
API through `gh api`. `owner/repo` is the repository, `<n>` a pull request
number, `<sha>` a full SHA from `git rev-parse`. Gate content and run watching
stay in `cratis-engineering-ci-gates`.

## 1. Predecessors are merged

```bash
gh api repos/owner/repo/pulls/<predecessor> --jq '{state: .state, merged: .merged}'
```

Proceed only when `merged` is `true`. A closed pull request with `merged:
false` was abandoned, not delivered: stop and report it.

## 2. No publish run is queued or in progress

```bash
gh api "repos/owner/repo/actions/workflows/<publish-workflow>.yml/runs?status=queued" --jq '.total_count'
gh api "repos/owner/repo/actions/workflows/<publish-workflow>.yml/runs?status=in_progress" --jq '.total_count'
```

Proceed only when both print `0`. Use the repository's own publish workflow
file name. A nonzero count is a stop: report the run ids, never cancel another
owner's publish run (see `cratis-engineering-ci-gates`).

## 3. No overlapping change on main since CI ran

Find the commit the relied-on run used, then compare:

```bash
ci_sha=$(gh api repos/owner/repo/actions/runs/<run-id> --jq '.head_sha')
git fetch origin main
git log --oneline "$ci_sha"..origin/main -- <candidate paths>
```

Proceed only when `git log` prints nothing. If the CI sha is not an ancestor
of the pull request head, the run is stale; see below.

## 4. The run belongs to the current head

```bash
pr_head=$(gh api repos/owner/repo/pulls/<n> --jq '.head.sha')
run_head=$(gh api repos/owner/repo/actions/runs/<run-id> --jq '.head_sha')
test "$pr_head" = "$run_head"
```

A nonzero exit means the green run is stale.

## Worked example

Candidate pull request 12 depends on pull request 10. Its CI run 900 was green.

1. Predecessor: `pulls/10` reports `merged: true`. Passes.
2. Publish: both workflow queries print `0`. Passes.
3. Overlap: run 900 used `aaa111…`; `git log aaa111…..origin/main -- Source/Api`
   prints one commit, which changed `Source/Api`. Fails.

The lane does not merge. It reports "turn blocked: main changed `Source/Api`
after the CI commit" with the commit id, then hands the turn back to
`<coordinator>`. After updating the branch it needs a new run on the new head;
the old green run proves nothing for it. The merge proceeds only when the three
state checks (predecessors merged, no publish running, no overlap since CI ran)
all hold and the stale-head check confirms the run belongs to the current head.
The lane records the commands and their results with the merge.
