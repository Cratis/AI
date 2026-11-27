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
