---
id: 150
title: Application specs never see decision reads or concurrency, and state-dependent rules use the read model as a Handle parameter
status: accepted
stage: implemented
class: product
reversibility: costly
decided: 2026-10-31
decider: Sindre Alstad Wilting
applies-to:
  - ".cratis/ai/rules/specs.scenarios.csharp.md"
  - ".cratis/ai/skills/cratis-application-slice-specifications/**"
  - ".cratis/ai/skills/cratis-arc-command/**"
  - ".cratis/ai/skills/cratis-arc-command-validation/**"
  - ".cratis/ai/skills/cratis-chronicle-decision-reads/**"
issues: []
---

## Context

Application specs had grown to configure read protection (`UseDecisionReads`) and to simulate competing appends (`AppendConcurrently`) so a decision could be exercised under concurrency. Both are framework and infrastructure concerns. The decider's ruling: "I don't understand at all why the tests have the decision read stuff, that should be entirely invisible to the tester", and "We don't want specs to simmulate copeting appends, concurrency issues, those are framewokr and infrastructure concerns and a user / developer should not have to think about it, especially not in tests."

A second pull toward complexity: code that takes `IDecisionReads` inside `Handle` so the rule can read state. The decider's ruling: "Hande(IDecisionReads ...) should probably never be used using Arc, it is not recommended. What is recommended is to just take the read model as a dependency, we don't need to spend lots of resources to support things that the developers should not be doing", and "There should be clear recommendatiojns from arc in terms of how to use this effectively and be the most idiomatic, should come from docs and AI corpus."

Until now the corpus still described `AppendConcurrently` as available for an application-owned race policy, and listed `IDecisionReads` shapes without saying which one to prefer.

## Decision

1. An application spec supplies read-model state and asserts business outcomes. It never configures decision reads (`UseDecisionReads`) and never simulates competing appends (`AppendConcurrently`). Concurrency and decision-read guarantees are proven by Arc's and Chronicle's own specifications.
2. A state-dependent rule takes the read model as a `Handle` parameter, with `[ReadProtection(On)]` where it must hold under concurrent writers. Taking `IDecisionReads` in `Handle` is not recommended; the corpus teaches and the platform invests in the read-model parameter shape, not in supporting the alternative.
3. Arc's guidance for effective, idiomatic use belongs in its documentation and in this AI corpus, and the two say the same thing.
4. General principle: Cratis code, documentation and examples always use and recommend the most idiomatic Cratis way, unless something else is explicitly needed. Advanced or non-idiomatic APIs are documented only as such, with the explicit need that justifies them. Decider, 2026-10-31: "we should always use and recommend the most idiomatic way to write Cratis code, unless explcitily something else is needed."
5. `AppendConcurrently` is not being obsoleted. It remains a public, advanced framework-verification API hidden from IntelliSense: its purpose is internal proof that Arc and Chronicle handle concurrency well. It is outside the recommended application testing guidance and is used only for a specific explicit need. Decider: "AppendConcurrently its only use is for testing interenally that we handle these concurrency issues in a good way, but should not really be used by the develoeprs using Arc unless they have some very specific needs to do so."


Where Arc behavior is still pending (pins for protected parameters; obsolescence of `UseDecisionReads`), the corpus states the direction and makes no version claim until a release carries it.

## Options considered

- **Keep `AppendConcurrently` for an application-owned race policy** (the previous wording). Lets an application prove its own retry rule, but makes every developer reason about interleaving in tests and invites re-proving the platform. Not taken: the business outcome is asserted from supplied state, and races are the platform's to prove.
- **Support `Handle(IDecisionReads ...)` as a first-class shape.** Covers computed keys without a read-model parameter, but costs harness, analyzer and documentation work for a shape developers should not choose. Not taken; a computed key stays in `Provide()` until the read-model shape covers it.
- **Hide the plumbing in a test helper** rather than forbid it. Keeps the concepts visible in the spec's vocabulary. Not taken: invisible means the spec author never names them.

## Default if unanswered

The corpus keeps offering `AppendConcurrently` and an unranked list of read shapes. Sessions keep writing concurrency simulations and slow decision scenarios, and every one is a spec the platform already proves.

## Timeline and scope

Holds from the corpus release carrying it. In scope: C# application specs and the Arc command, validation and decision-read guidance. Out of scope: Arc and Chronicle's own specifications (they prove the guarantees and keep their harness, including `AppendConcurrently`), framework-side implementation of pins and of `UseDecisionReads` obsolescence, and the single assembly-level shape-admission spec, which the current rule keeps unchanged.

Done when: no corpus rule or skill tells an application author to call `UseDecisionReads` or `AppendConcurrently`, and the command guidance names the read-model parameter as the recommended shape.

Verify by: search `.cratis/ai` for both names and confirm each hit forbids or deprecates the call; run the corpus verification.
