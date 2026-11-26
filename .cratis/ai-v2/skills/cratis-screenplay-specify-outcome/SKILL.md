---
name: cratis-screenplay-specify-outcome
description: Use when writing executable Given/When/Then examples for .play behavior, including refusal or races. Not for testing the actual application pipeline (cratis-specifications-exercise-backend).
---

# Specify one contrast in the deciding slice

1. Fix the prior facts, key and caller; omit history when the source is new. Read references/fixture-data.md when reusing command values. **Done:** [RegisteringAster](../../../../Evaluations/corpus-v2/examples/cratis-screenplay-specify-outcome/model/authors.play) supplies one AuthorId and asserts the same destination on the fact.
2. Exercise the command, not a direct append, when testing its decision. Assert the event set and payload; use a separate given-event example to observe the projection. **Done:** ListingAster fails if Name maps correctly but Id does not.
3. Vary only the invalid input. Read references/negative-paths.md when the outcome is rejection or denial. **Done:** RejectingAnEmptyName expects the validation message rather than any failure. For proof that refusal left the real stream and row untouched, send the same input to [backend verification](../cratis-specifications-exercise-backend/SKILL.md).
4. Run `screenplay ./model --warnaserror` followed by `screenplay test model --format json` from the fixture. **Done:** each named specification executed, none unsupported or skipped. For a pure C# decision outside Screenplay, use [isolated behavior specs](../cratis-specifications-isolate-behavior/SKILL.md). Prior conflicting history is a modelable input; simultaneous delivery, isolation and timing need runtime evidence.
