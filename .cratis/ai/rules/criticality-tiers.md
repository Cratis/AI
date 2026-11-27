---
profile: framework
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Criticality tiers

Classify by failure consequences, not repository name.

- **Tier A — Critical:** product runtime, auth/credentials, data integrity/migrations,
  production deployment or automation that can disrupt all CI. Require focused
  behavior/rejection specs, independent review and security/product CI. Run full local
  gates for changed inputs and their dependencies; reuse valid unchanged-input results.
- **Tier B — Operational but bounded:** internal tools with limited, recoverable impact
  (e.g. runner management). Smoke/regression-test meaningful behavior; review elevated
  permissions, broad impact or escalation below. No unrelated product gate; Code Health
  only for maintained, non-disposable code.
- **Tier C — Disposable or advisory:** noncritical dashboards, reports, local helpers,
  samples, experiments, prose and style checks. No mandatory new specs, review/artifacts,
  Code Health scoring/uplift or full local gate. Smoke checks are optional absent a
  specific failure risk; cheap checks may stay. Cosmetics are advisory.

Credentials, secrets, authentication, authorization, workflow permissions, untrusted PRs
(`pull_request_target`, `workflow_run`, forked-PR inputs), data exposure, trust boundaries,
and destructive or irreversible actions escalate the affected part to Tier A with
independent review. Critical subcomponents inherit Tier A; unknown critical dependencies
fail closed to the higher tier. No unrelated legacy uplift or tier artifacts.

Security, secrets, authorization, destructive-action and required CI contracts remain
binding. Irrelevant CI checks report success/not-applicable, not pending. Keep required
product/integration coverage until a validated narrower replacement exists.

## Always kept, at every tier

- Security and authorization checks
- Secret redaction checks
- Data integrity and migration checks
- Event schema compatibility, upcasting, replay, and projection idempotency checks
- Published contract tests (public APIs, wire formats, generated proxies)
- Runner cost guards
