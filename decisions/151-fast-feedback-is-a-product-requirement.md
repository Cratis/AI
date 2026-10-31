---
id: 151
title: Fast feedback is a product requirement across Cratis repositories, including specs, analyzers and CI
status: accepted
stage: implemented
class: strategy
reversibility: costly
decided: 2026-10-31
decider: Sindre Alstad Wilting
applies-to:
  - ".cratis/ai/rules/verification-discipline.md"
  - ".cratis/ai/rules/framework.md"
  - ".cratis/ai/rules/specs.scenarios.csharp.md"
  - ".cratis/ai/skills/cratis-ci-pipeline-performance/**"
issues: []
---

## Context

Specs, builds and analyzers have become slow enough to shape how work is done. The decider's ruling: "runinig the tests should take seconds, one test should take millieseconds and they should run in parllel"; "the amount of time spent on running tests, and builds and analyzers needs to be drastically improved accross all our things!"; "the speed of the analyzers needs to be as fast as possible, so that they don't halt the builds in any particular way, or we need to find some other way that is better."

Measured in one downstream application on 2026-10-31 (a loaded machine, so ratios matter more than absolutes): compiling the main project took 395 s with analyzers, 180 s after switching off rules that cannot apply, and 90 s with analyzers off. One analyzer family spent most of its time re-binding every call site in the compilation, up to five times, with no syntactic prefilter. Separately, a Chronicle scenario fix cut 30 spec facts from 498.5 s to 42.3 s, and decision command scenarios from a 34.6 s median to 1.2 s, against a 20 to 50 ms plain-call control.

## Decision

Fast feedback is a requirement for every Cratis repository, not a nicety.

1. Specs share setup where that is safe and run in parallel. A plain decision spec takes milliseconds; a scenario fact justifies seconds only by the extra behavior it proves.
2. Analyzers and generators are written for speed: incremental generators; a syntactic prefilter before any semantic work; compute shared evidence once per compilation, not once per analyzer; touch it only after cheap relevance checks; and a performance spec for every expensive analyzer.
3. CI builds the spec path without analyzers and enforces every analyzer, with warnings as errors, in a parallel required job. The local fast loop may skip analyzers; the local pre-push gate runs them.
4. Cost is measured before and after, on the same inputs and concurrency, and a regression is a defect.

## Options considered

- **Keep analyzers in every build and accept the cost.** Simplest and never lets a warning slip, but halts every build and the spec loop. Not taken.
- **Drop analyzers from CI to save time.** Fast, but loses enforcement. Not taken: moving them to a parallel required job keeps enforcement and removes them from the critical path.
- **Make analyzers optional locally with no pre-push run.** Not taken: the failure would surface only in CI, after push.
- **Rely on faster machines.** Does not fix algorithmic cost such as repeated whole-compilation binding. Not taken.

## Default if unanswered

Builds and specs keep their current cost, analyzers stay on the critical path, and each new analyzer adds to it with nobody owning the total.

## Timeline and scope

Holds from the corpus release carrying it, for all Cratis repositories. In scope: guidance for specs, analyzer and generator authors, and CI shape. Out of scope: the per-repository work to hit the target, which each repository plans and measures itself.

Done when: the always-on verification rule states the requirement, the framework rule carries the analyzer-authoring constraints, and the CI performance skill describes the analyzer lane.

Verify by: read those three places, and run the corpus verification with the always-on budget check passing.
