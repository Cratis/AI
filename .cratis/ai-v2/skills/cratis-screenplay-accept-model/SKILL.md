---
name: cratis-screenplay-accept-model
description: Use before accepting a model change, selecting a Screenplay compiler or admitting a model to delivery. Not for applying workspace edits (cratis-screenplay-edit-workspace).
---

# Separate executable readiness from agreement

1. Identify the intended change and agreed examples independently of the candidate. Pin the native CLI and record `screenplay --version`, language version and model revision. Read references/compiler-selection.md if the editor already reports green. **Done:** all evidence names the same input; a parser-only pass is marked insufficient.
2. Compile with `screenplay ./model --warnaserror`, then run `screenplay test model --format json`. Run `screenplay diff before/model after/model --format json` on the reviewed snapshots. Inspect the matching mode: without persisted identities a rename can appear as removal plus addition. Compare changed outcomes and added defaults, not just counts. **Done:** all required scenarios ran, including refusal; each difference has a disposition. A rename inferred from similar text is unresolved without identity evidence.
3. Read references/admission.md before recording the decision. Compare RegisteringAster, ListingAster and RejectingAnEmptyName to the agreed intent; obtain the owner's decision on the exact revision. **Done:** record accepted, rejected or unresolved, with reasons; only accepted scope goes to [handoff](../cratis-screenplay-handoff-slice/SKILL.md).
4. Run `node --test acceptance.test.mjs` in the fixture. **Done:** the expected scenario set is present in an actual export and an unapproved revision is not admitted. No test manufactures owner approval.
