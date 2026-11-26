---
name: cratis-screenplay-handoff-slice
description: Use when an accepted .play model is ready for implementation or authorized rendering. Not for approving the model (cratis-screenplay-accept-model).
---

# Hand off one accepted outcome

1. Freeze the accepted model, scope, caller, success and refusal examples, approval reference and target. Without revision-specific approval, stop at a candidate package. Read references/extensions-and-locks.md if rendering depends on an extension. **Done:** model agreement and permission to render are two separate entries.
2. Compile with `screenplay ./model --warnaserror` and run `screenplay test model --format json`. Export the slice and its required view together: `screenplay export model --scope Catalog.Authors --output accepted.esm.json`. **Done:** [the scoped contract](../../../../Evaluations/corpus-v2/examples/cratis-screenplay-handoff-slice/accepted.esm.json) contains RegisteringAster, ListingAster and RejectingAnEmptyName at one revision. Send those outcomes to [slice delivery](../cratis-platform-deliver-slice/SKILL.md), not a second implementation recipe.
3. Read references/renderer-parity.md before claiming target support. **Done:** each binding, permission and observable outcome is implemented, assigned as a manual gap, or blocked. Obtain separate target-specific authorization before rendering; do not force through conflicts.
4. Against the approved isolated target, run `npm run test:journey` from the fixture after configuring its host adapter. **Done:** a permitted editor adds Aster and sees exactly one persistent row; compare backend fact/key and refusal independently. Without the approved target and journey result report parity unverified, even if every model spec passed.
