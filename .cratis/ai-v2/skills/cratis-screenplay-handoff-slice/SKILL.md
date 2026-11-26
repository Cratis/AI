---
name: cratis-screenplay-handoff-slice
description: Use when an approved .play slice needs a scoped export for implementation or authorized rendering. Not for approving a candidate model (cratis-screenplay-accept-model).
compatibility: Requires Node.js and the Screenplay CLI.
---

# Hand off one accepted outcome

**Requires:** Check `node --version` and `screenplay --version`; restore the project's pinned CLI before exporting.

1. Freeze the approved revision, scope, caller, success and refusal examples, approval reference and target. Read references/extensions-and-locks.md when rendering depends on an extension. **Done:** acceptance of the model and permission to render have separate entries.
2. Export the dependency-ready scope. Run `node scripts/export-scope.mjs <model-directory> <dotted-scope>` from this skill's folder with an absolute model path; it prints the scoped ESM as JSON after checking for a revision and executable scenarios. **Done:** compare the revision to the approval and inspect the write, refusal and required view. For example, this assertion requires exactly the expected query result, not merely a successful command:

```screenplay
        then query AllAuthors exactly
          result
            id = "11111111-1111-4111-8111-111111111111"
            name = "Aster"
```

3. Read references/renderer-parity.md before claiming target support. **Done:** assign each binding and permission to a supported implementation, a manual task or an explicit blocker. If the renderer lacks a binding, do not force through the conflict; hand the contract and gap to [Deliver one observable change](../cratis-platform-deliver-slice/SKILL.md).
4. Run `screenplay test model --format json` against the approved model directory and inspect the named outcomes. **Done:** the accepted cases execute and pass. Run the application's journey against the approved target to compare actual persistence, refusal and visible results; without it, report runtime parity unverified.
