---
applyTo: "**/*"
paths:
  - "**/*"
---
<!-- cratis-ai: generated Copilot instructions. Do not edit; rules/ is the source. -->

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Criticality tiers

Judgment-shaped: classify by failure consequences, not repository name.

- **Tier A — Critical:** product runtime, auth/credentials, data integrity/migrations,
  production deployment or automation able to disrupt all CI. Require focused
  behavior/rejection specs, independent review and security/product CI. Full local gates
  run only for changed inputs/dependency closure; reuse valid unchanged-input results.
- **Tier B — Operational but bounded:** internal tooling with limited, recoverable
  impact (e.g. ordinary runner management). Require bounded smoke/regression checks
  for meaningful behavior; review elevated permissions, broad impact or the escalation
  below. No unrelated product gate; Code Health only for maintained, non-disposable code.
- **Tier C — Disposable or advisory:** noncritical dashboards, reports, local helpers,
  demos/samples, experiments, prose and corpus style checks. No mandatory new specs,
  review/artifacts, Code Health scoring/uplift or full local gate. Smoke checks are
  optional absent specific failure risk; cheap checks may remain, cosmetics are advisory.

A change in any tier that touches credentials or secrets, authentication or authorization,
workflow permissions or untrusted-PR triggers (`pull_request_target`, `workflow_run`,
forked-PR inputs), data exposure, a trust boundary, or a destructive or irreversible action
is Tier A for that part and needs independent review, whatever the tool's tier.
Critical subcomponents inherit Tier A; unknown critical dependencies fail closed to
the higher tier. Narrow fixes need no unrelated legacy uplift. No artifacts needed
to claim a tier.

Security, secrets, authorization, destructive-action safeguards and required CI
status-check contracts remain binding. Irrelevant CI execution must report explicit
success/not-applicable rather than leave a required check pending; preserve required
product/integration coverage until a validated narrower replacement exists.
