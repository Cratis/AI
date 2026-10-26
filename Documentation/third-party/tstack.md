<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Tstack review protocol adaptation

The portable review contracts adapt selected protocol concepts from
[tstack's sol-loop](https://github.com/t3dotgg/tstack/blob/7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd/skills/sol-loop/SKILL.md),
pinned at `7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd`.
Upstream is MIT-licensed, copyright 2026 Theo Browne. The complete copyright,
permission notice and disclaimer travel with the skill in
[NOTICE](../../.cratis/ai/skills/cratis-engineering-review-rounds/NOTICE).

## Local adaptation

The `cratis-engineering-review-rounds` skill and shared `review-reports` rule
retain review/writer separation, independent verification of findings, explicit
completion and cancellation, and stable finding continuity through delta rounds.
The adaptation uses host capabilities and configured provider tiers rather than
T3 dispatch APIs. It retains Cratis's existing report vocabulary, typed envelopes,
provider independence, hard three-round cap, full gates and publication authority.
No standalone scheduler, watcher, provider configuration or shipping grant is imported.

## Adoption matrix

Upstream ships nine skills at the pinned commit. Only `sol-loop` is adapted; the
rest stay outside the corpus until a separate change adopts them.

| Upstream skill | Disposition | Reason and location |
| --- | --- | --- |
| `sol-loop` | Adapted | The bounded review protocol lives in `cratis-engineering-review-rounds` and the `review-reports` rule. |
| `leaving-pr-comments` | Deferred | Candidate for a later policy adapter; no skill is added here. |
| `modernize` | Deferred | Candidate for a later policy adapter; no skill is added here. |
| `council` | Deferred | A multi-model panel would be opt-in only; there is no default premium review panel. |
| `file-pr` | Deferred | The existing pull request and publication authority rules stay in force. |
| `babysit-pr` | Deferred | No persistent watcher or session state is imported. |
| `full-stop` | Deferred | It would grant shipping or merge-setting authority transitively. |
| `takeover` | Deferred | It would transfer ownership or replace pull requests implicitly. |
| `full-send` | Rejected | Unattended shipping grants conflict with Cratis release and merge authority. |

## Update procedure

Review upstream changes against the pinned source before changing the adaptation.
Reapply only the portable concepts above; do not import upstream's larger round
allowance or host-specific delegation APIs. Preserve the distributed notice and
update this record's pin and adaptation summary when adopting another revision.
Run the review-contract specifications and the repository's required gates.
