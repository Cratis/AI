---
name: cratis-screenplay-accept-model
description: Use when a reviewer needs to assess Screenplay behavior and decide whether to accept a model revision for implementation. Not for applying edits (use cratis-screenplay-edit-workspace).
compatibility: Requires the Screenplay CLI.
---

# Review the candidate model for acceptance

1. Identify the proposed revision and its intended outcomes. The baseline is the last accepted revision, if one exists. Use the same `screenplay --version` for both. The requesting user is the decision owner unless they name someone else.
2. Compile the candidate and run its committed [model specifications](../cratis-screenplay-specify-outcome/SKILL.md). From its application directory:

   ```sh
   screenplay model --warnaserror
   screenplay test model --format json
   ```

3. **First revision:** review the whole model and all its specifications. **Existing baseline:** compile the baseline too. From the common parent, run `screenplay diff before/model after/model --format json`, substituting the actual baseline and candidate paths. A baseline that fails compilation is not an empty baseline. Inventory changed or removed decisions, denials and reads in `difference`; deleting a rule and its spec can leave a green suite. If a rename looks like removal and addition, inspect `difference.matching` and confirm continuity.
4. Derive and disposition [coverage obligations](references/coverage-obligations.md) across the whole model, including retained behavior. Check `results[].outcome` by address and confirm `selected`, `executed` and `passed` match, with `failed` and `unsupported` zero. Passing examples witness selected model behavior, not execution on the target.
5. Ask the owner about all open decisions together. Record acceptance only for the exact revision and named outcomes they accept. If told to proceed on assumptions, record them as assumptions and keep acceptance pending. Do not render on the strength of a self-check.

Use a whole-application gate before handing off. A draft can preserve unanswered references; accepting the draft for discussion does not make it executable. An unknown construct inside a slice can be reported as a warning (`PLAY0029`) rather than an error: fix the spelling and check that the intended declaration is present. In ordinary compilation an unresolved policy named by a persona is an error; do not interpret it as anonymous access.

If using the Cratis CLI for delivery, `cratis screenplay validate model --warnaserror` checks reported source diagnostics. For an executable handoff, add `--executable` to require binding. If the intended consumer is the bundled Cratis renderer, `cratis screenplay validate model --warnaserror --executable --target cratis` also asks its planner about the whole model in memory. A green scoped source check does not substitute for these gates. Neither binding nor admission executes a specification, writes an application or authorizes a render. Report the gate actually reached, skipped outcomes and any refusal.

For a shared gate, commit the team's selected completeness checks and `warningsAsErrors` in the model root's `screenplay.json`. `cratis screenplay validate model --print-gate` shows the effective settings and their sources **without compiling**. Run validation separately. `--open-questions fail` gates unresolved model notes separately from warnings; [review or resolve notes in the workspace](../cratis-screenplay-edit-workspace/SKILL.md#notes-and-storylines). If changing a model under review, identify its root and revision first. Re-read stale state rather than replaying a failed edit. Acceptance must name the reviewed revision; a rename in source is not proof that deployed event identities or subscriptions survived.

If the handoff is an agent capability manifest, require complete compilation and an explicit `agents` allowlist. An empty allowlist means no operations; a missing block is not permission to expose every command. Exporting that manifest is not executable-model admission or proof of backend authorization. Before exposing operations, apply the [consumer checks](references/capability-consumption.md).

For an unfamiliar warning or a failure in binding, [choose a repair from the reported scope and code](references/diagnostic-decisions.md) rather than disabling a gate.

For example, changing both a blank-name rule and its expected message from `Name is required` to `Enter the author's name` may pass every model spec. It does not establish that the owner wants the new wording. [Revise the model](../cratis-screenplay-edit-workspace/SKILL.md) if needed; [hand off the slice](../cratis-screenplay-handoff-slice/SKILL.md) only after acceptance.
