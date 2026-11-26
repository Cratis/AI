---
name: cratis-screenplay-accept-model
description: Evaluates whether a complete Screenplay change preserves the agreed behavior. Use when reviewing a model change or admitting a model to delivery. Not for applying the edit (use cratis-screenplay-edit-workspace).
compatibility: Requires Node.js and the Screenplay CLI.
---

# Decide whether to accept the model change

Compile the complete model, execute its examples and compare both successful compilations. A clean structural check alone does not say what the changed command will do.

1. Keep separate folders for the baseline and candidate. Use the same compatible compiler on both.
2. Compile each complete folder before interpreting a scoped result. Treat a failed side as unknown, not as a model with nothing in it.
3. Run the candidate's specifications. Compare selected, executed and unsupported counts and inspect the named outcomes.
4. Compare semantic changes against the agreed examples. Check removed expectations separately from deleted seed data.

## Review a change to the blank-name error

Keep the accepted Library model in `before/model/` and the proposed change in `after/model/`. Include the Authors [registration and refusal specifications](../cratis-screenplay-specify-outcome/SKILL.md) in both. Run from their common parent:

```sh
screenplay before/model
screenplay after/model
screenplay test after/model --format json
screenplay diff before/model after/model --format json
```

Trace the new blank-name error through the command's validation rule and the refusal example. Compare the old and new model revisions before reusing an earlier acceptance decision. If the candidate no longer checks the expected destination, a passing test count does not preserve that expectation. Compare scope and exposure changes even when operation names are unchanged.

## Avoid

- Don't count unsupported or `NotEvaluable` outcomes as passes.
- Don't treat an agent allowlist as caller authorization; review them separately.
- Don't compare localized diagnostic messages; compare the code and declared arguments.
- Don't change the stored shape of a shipped event revision through a shared nested type.

## Related skills

- [Edit the workspace](../cratis-screenplay-edit-workspace/SKILL.md) to revise the proposal.
- [Hand off the slice](../cratis-screenplay-handoff-slice/SKILL.md) once the change is accepted.
