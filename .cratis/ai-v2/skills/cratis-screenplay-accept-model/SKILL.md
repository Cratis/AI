---
name: cratis-screenplay-accept-model
description: Use when reviewing behavior changed by a Screenplay revision before accepting the model change for implementation. Not for applying edits (use cratis-screenplay-edit-workspace).
compatibility: Requires the Screenplay CLI.
---

# Review a changed registration refusal

1. Put the accepted Library model in `before/model` and a copy in `after/model`. Include the [registration and refusal specifications](../cratis-screenplay-specify-outcome/SKILL.md). Use the same `screenplay --version` for both folders.
2. As a review exercise only, change the candidate command rule to `name not empty message "Enter the author's name"` and update its specification to `then error "Enter the author's name"`. Do not change the accepted Library message `Name is required`.
3. From the common parent run:

   ```sh
   screenplay before/model
   screenplay after/model
   screenplay test after/model --format json
   screenplay diff before/model after/model --format json
   ```

4. Require both compilations to succeed. In the test output compare `selected`, `executed` and `passed`; they must match, with `failed` and `unsupported` zero. Read `results[].outcome` for `RejectingAnEmptyName` and `RegisteringAster` by address.
5. In `difference` find the changed registration rule and its refusal specification. For each behavior change identify a passing specification that checks it. Updating the implementation and its test together does not approve a new message: compare the message with the domain owner's accepted wording. Reject this candidate if the agreed message is still `Name is required`.

## Avoid

- Don't interpret a failed baseline compilation as an empty baseline.
- Don't count `unsupported` specifications as passing or reuse approval after the candidate revision changes.

## Related skills

- [Edit the workspace](../cratis-screenplay-edit-workspace/SKILL.md) to revise a rejected change.
- [Hand off the slice](../cratis-screenplay-handoff-slice/SKILL.md) after acceptance.
