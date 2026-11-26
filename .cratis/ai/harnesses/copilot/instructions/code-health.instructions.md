---
applyTo: "**/*.cs,**/*.ts,**/*.tsx,**/*.go,**/*.kt,**/*.kts,**/*.java,**/*.ex,**/*.exs"
paths:
  - "**/*.cs"
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.go"
  - "**/*.kt"
  - "**/*.kts"
  - "**/*.java"
  - "**/*.ex"
  - "**/*.exs"
---
<!-- cratis-ai: generated Copilot instructions. Do not edit; rules/ is the source. -->

# Code Health floor

Apply [criticality tiers](./criticality-tiers.instructions.md) first: score Tier A code and
maintained Tier B code when CodeScene is available. Tier C requires no scoring or
uplift. Without tools or an account, report that and continue; never block.
MCP setup, approval-gated tools and tool-output handling: [codescene.md](../../../rules/codescene.md).

## The floor

- In-scope code ends at Code Health **9.5 or higher**; new code aims for 10. A touched file never declines.
- Uplift safely with behavior-preserving refactoring and specs. A narrow fix does not require unrelated legacy uplift. If 9.5 exceeds safe scope, report the gap and suggest a follow-up; do not widen the change.
- Never refactor generated code. A "could not determine" Code Health score is not a failure. Other Cratis rules win over a finding.
- CodeScene has no floor setting, so the check is ours.

## Checking

- For in-scope code, run `code_health_review` while shaping it, `code_health_score` before delivery, then `pre_commit_code_health_safeguard` (or `analyze_change_set` against the base branch).
- The delivery report has a table: file, score before, score after; name each exception with its reason.

## No fix loops

- **Once, before the gate.** Handle Code Health once per in-scope file: review while shaping the code (design for the score, do not write first and fix later), refactor, then one `code_health_score`. The gate and review then run once on the final shape.
- **Never a cycle.** No gate, score, refactor, gate loops. A score check never triggers an extra build or test run on its own; batch score fixes with the other fixes.
- **One refactor pass per file per change.** If it does not reach 9.5, report before/after and the reason, suggest the uplift follow-up, and stop.
- **A reported reason closes the item.** Reviewers flag only an in-scope file below 9.5 with no reason, together with the round's other findings, never as a review round of its own.
- **A second Code Health round is itself a finding.** Name the cause (wrong approach, file too large for the task, tool problem) instead of iterating.
