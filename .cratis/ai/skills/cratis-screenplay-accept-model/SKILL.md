---
name: cratis-screenplay-accept-model
description: Use when a reviewer needs to assess Screenplay behavior and decide whether to accept a model revision for implementation. Not for applying edits (use cratis-screenplay-edit-workspace).
compatibility: Requires the Screenplay CLI.
---

# Review the candidate model for acceptance

1. Identify the proposed revision and its intended outcomes. The baseline is the last accepted revision, if one exists. Use the same `screenplay --version` for both. The requesting user is the decision owner unless they name someone else.
2. Compile the candidate and run its committed [model specifications](../cratis-screenplay-specify-outcome/SKILL.md). From its application directory:

   ```sh
   screenplay model
   screenplay test model --format json
   ```

3. **First revision:** review the whole model and all its specifications. **Existing baseline:** compile the baseline too. From the common parent, run `screenplay diff before/model after/model --format json`, substituting the actual baseline and candidate paths. A baseline that fails compilation is not an empty baseline. Inventory changed or removed decisions, denials and reads in `difference`; deleting a rule and its spec can leave a green suite. If a rename looks like removal and addition, inspect `difference.matching` and confirm continuity.
4. Map each obligation to a specification address or mark it unresolved. Check `results[].outcome` by address and confirm `selected`, `executed` and `passed` match, with `failed` and `unsupported` zero. Passing examples witness selected model behavior, not execution on the target.
5. Ask the owner about all open decisions together. Record acceptance only for the exact revision and named outcomes they accept. If told to proceed on assumptions, record them as assumptions and keep acceptance pending. Do not render on the strength of a self-check.

For example, changing both a blank-name rule and its expected message from `Name is required` to `Enter the author's name` may pass every model spec. It does not establish that the owner wants the new wording. [Revise the model](../cratis-screenplay-edit-workspace/SKILL.md) if needed; [hand off the slice](../cratis-screenplay-handoff-slice/SKILL.md) only after acceptance.
