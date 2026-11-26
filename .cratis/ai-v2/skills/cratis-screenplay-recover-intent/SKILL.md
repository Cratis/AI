---
name: cratis-screenplay-recover-intent
description: Use when inherited source or observed application behavior must be compared with a proposed model. Not for deciding missing acceptance criteria (cratis-modeling-discover-timeline).
---

# Recover evidence without inventing intent

1. Bound the permitted input: revision, component, caller and period observed. Default to supplied source or observations; do not launch an extractor or read a live workspace. **Done:** the record names both observed paths and gaps. Read references/observation-record.md when coverage is partial.
2. Trace one input to its evidence, then seek a counterexample. **Done:** a supplied observation of one Aster row is recorded as a read; neither the stream key nor absence of duplicate facts is inferred from it. Label each inference separately from the evidence.
3. Compare the proposed model with those observations within scope. **Done:** each difference names the evidence, competing explanations and a decision owner. Record uncertainty as a note, not an executable requirement. If the team must decide blank-name behavior, pass that unanswered contrast to [timeline discovery](../cratis-modeling-discover-timeline/SKILL.md).
4. Run `node --test acceptance.test.mjs` in the observation fixture. **Done:** the missing blank-input observation remains unresolved and no policy is promoted from inference. This checks the evidence record, not the inherited app.
