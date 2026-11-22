---
id: 154
title: Install-phase conformance gates publication in Publish verify
status: proposed
stage: none
class: contract
reversibility: easy
applies-to:
  - ".github/workflows/publish.yml"
  - "Source/Verification/conformance-workflow.spec.ts"
  - "Source/Verification/verify.ts"
  - "README.md"
issues:
  - "Cratis/AI#1294"
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

## Context

Install-phase conformance installs the source corpus for each fixture and checks the installed files. Static fixture validation in the corpus verifier checks fixture shape, not installation behavior. The former standalone workflow ran only for pull requests touching the corpus, conformance fixtures, or that workflow. It neither covered every PR nor gated publishing on pushes to main and manual runs.

Main's protection requires `verify` and `policy / verify`, with strict status checks and admin enforcement. A read-only protection audit confirmed both contexts and no repository rulesets when implementing this decision. The standalone install-phase check was not required. Preserve these required names and their workflows; no protection change is needed.

## Decision

Run install-phase conformance once inside Publish's existing `verify` job, immediately after corpus verification and before screens smoke. Every PR, push to main, and manual publishing run receives the same unconditional step, without path filters or tolerated failure. Keep the existing exclusions for advisory schedule and repository-dispatch sync events, which do not release. Remove the redundant standalone workflow and its verifier allowlist entry.

Keep the dedicated Cratis CLI pin at `3.100.0`, the proven version supporting `--install-only`. Install it into a private runner-temp tool directory and invoke that absolute executable; do not reuse the screens-smoke CLI or change SDK/action versions.

The verdict is fail-closed: preserve a nonzero CLI exit even if diagnostic JSON parsing fails; reject unreadable, empty, or malformed reports and unexpected results; require at least one passed result. Only `skipped` with the exact reason `no install-phase checks` is acceptable alongside a pass. Diagnostic output cannot override the verdict.

Release continues to require successful `[verify, dotnet-verify]`, and all publishers stay downstream of release confirmation. Neither conformance nor this prerequisite depends on Pi Direct publication. A separate Pi Direct first-publication failure is not a reason to bypass this gate or change that publisher.

## Assurance boundary

This is **pre-publication assurance** about installing the tested source revision. It does not independently download and install published package bytes, replace packaging checks, or evaluate agent/model output. Model/result-phase evaluation remains separate and optional; install-phase checks need no harness credentials, model tokens, or quota.

`verify-published` is **post-publication health**: it aggregates whether release assets actually shipped together. Moving conformance there would discover failures after publication, too late to prevent it. Leave that job unchanged.

## Cost and alternatives

Observed standalone jobs in [run 44958075393](https://github.com/Cratis/AI/actions/runs/44958075393) and [run 44939553264](https://github.com/Cratis/AI/actions/runs/44939553264) took 30–33 seconds: CLI installation 9–11 seconds and checks 15 seconds. Publish verification in [run 44958075418](https://github.com/Cratis/AI/actions/runs/44958075418) and [run 44949983298](https://github.com/Cratis/AI/actions/runs/44949983298) took about 18 minutes 40 seconds against a 30-minute timeout. Expected incremental cost is roughly 0.4–0.5 minutes, subject to network variance, without another checkout, SDK setup, or runner startup. These are hosted observations, not local benchmarks. PR and main checks intentionally test separate revisions.

- **Keep the path-filtered workflow:** rejected; static shape checks and a non-required partial-coverage job do not protect publication.
- **Require an unfiltered standalone workflow and duplicate its publishing check:** rejected; requires protection migration and duplicate work on PRs.
- **Add a separate Publish job and aggregator:** rejected for this small cost; reconsider if conformance grows materially.
- **Use the post-publication summary:** rejected; too late to block release assets.
- **Share screens-smoke installation or extract a new validator:** rejected; couples unrelated pins or adds an unnecessary production abstraction. Specs execute the actual inline shell using real bash and jq.

## Verification

The workflow specs pin event coverage, single execution, release prerequisites, installer arguments, CLI exit propagation, and report verdicts. A real pinned-CLI run against current fixtures and a disposable corpus with a deliberately violated install assertion check the installation boundary without changing tracked fixtures. CI remains responsible for the complete Linux/container and .NET verification gates.
