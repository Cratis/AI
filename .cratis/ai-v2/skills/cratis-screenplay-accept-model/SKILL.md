---
name: cratis-screenplay-accept-model
description: Use before signing off a .play change, choosing a Screenplay compiler or deciding whether a semantic diff matches agreed behavior. Not for applying workspace edits (cratis-screenplay-edit-workspace).
compatibility: Requires Node.js and the Screenplay CLI.
---

# Decide whether the model is accepted

**Requires:** Check `node --version` and `screenplay --version`; restore the project's pinned CLI before making a compiler-based decision.

1. Record the intended outcomes independently of the candidate, the compiler and language versions, and the reviewed revision. Read references/compiler-selection.md if the editor reports green. **Done:** an editor parse alone is not counted as execution.
2. Compare the baseline and candidate. Run `node scripts/check-model.mjs <baseline-directory> <candidate-directory>` from this skill's folder with absolute model paths; it compiles the candidate, tests it and prints the compilation diagnostics, scenario report and semantic differences as JSON. **Done:** diagnostics have been reviewed and the required scenario addresses are present and passed, including refusals. For example, changing this expected message changes the reviewed contract even if a matching implementation change keeps the test green:

```screenplay
        when Aster name = ""
        then error "Name is required"
```

3. Read references/admission.md before recording the decision. If the diff shows removal plus addition instead of a rename, inspect persisted identities; do not infer continuity from similar names. **Done:** every difference has an owner disposition, and the decision names the exact revision as accepted, rejected or unresolved. Send only the accepted scope to [Hand off one accepted outcome](../cratis-screenplay-handoff-slice/SKILL.md).
