---
name: cratis-commits-and-pull-requests
description: Use before staging changes, writing a commit message or deciding when to commit. Not for preparing a release-note PR body or choosing its label (use cratis-platform-prepare-release-pr).
license: LICENSE
compatibility: Requires Git.
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Commits and pull requests

Loading this skill grants no permission to push, publish, merge or mutate issues.

Inspect the diff before choosing logical commit boundaries. Read
[references/commits.md](references/commits.md) when staging, writing a message or
deciding when to commit. Stage specific files and inspect `git diff --cached`;
never commit an unbuildable unit. Run affected-project gates, then the
repository-required checks before pushing. Never replace history for a tidier PR.

cratis-platform-prepare-release-pr (`cratis/engineering/core`) owns PR bodies and
release labels.

## When asked to ship

An explicit ship or land request authorizes the delivery chain only as repository policy permits. A commit-only or PR-only request stops there. Review holds, release trains and explicit no-merge instructions win. A release label grants no authority: secure human confirmation or human merge for major releases where required. Before opening the PR, check its [description](references/pr-description.md) and [release label](references/pr-labels-and-release.md).
