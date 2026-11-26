---
applyTo: "**/*"
paths:
  - "**/*"
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Criticality tiers

Judgment-shaped: classify by failure consequences, not repository name. These tiers
scope specification, independent review, Code Health and local gate obligations.

- **Tier A — Critical:** shipped product runtime; authentication, authorization,
  credentials, data integrity and migrations; production deployment; shared automation
  whose failure can disrupt all CI. Require focused specs for changed behavior/rejection
  rules, appropriate independent review and required security/product CI. Full local gates
  run only when inputs or dependency closure change; reuse valid unchanged-input results.
- **Tier B — Operational but bounded:** internal tooling with recoverable, limited
  operational impact, including ordinary runner management. Require a bounded smoke
  or focused regression check for meaningful operational behavior. Independent review
  is required only for changed trust boundaries, destructive actions, elevated
  permissions or broad failure impact. No unrelated whole-product local gate.
  Code Health applies only to maintained code (expected to evolve, not be discarded).
- **Tier C — Disposable or advisory:** dashboards, cosmetic reporting, local convenience
  helpers, demos, samples, experiments, prose and AI-corpus style checks without critical
  behavior. No mandatory new specs, independent review, Code Health scoring/uplift or
  full local build/test gate. Smoke checks are optional unless a specific failure risk
  justifies one. Existing cheap checks may remain without disproportionate ceremony;
  cosmetic findings are advisory.

A change in any tier that touches credentials or secrets, authentication or authorization,
workflow permissions or untrusted-PR triggers (`pull_request_target`, `workflow_run`,
forked-PR inputs), data exposure, a trust boundary, or a destructive or irreversible action
is Tier A for that part and needs independent review, whatever the tool's tier.
A critical subcomponent inherits Tier A even inside a Tier C tool. Unknown critical
dependencies fail closed to the relevant higher tier. Narrow fixes never require
unrelated legacy uplift. No receipt, inventory or review document is needed to claim a tier.

Security, secrets, authorization, destructive-action safeguards and required CI
status-check contracts remain binding. Irrelevant CI execution must report explicit
success/not-applicable rather than leave a required check pending; preserve required
product/integration coverage until a validated narrower replacement exists.
