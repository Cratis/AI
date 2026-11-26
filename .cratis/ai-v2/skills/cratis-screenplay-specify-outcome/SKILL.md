---
name: cratis-screenplay-specify-outcome
description: Use when writing executable Given/When/Then scenarios for .play behavior, including rejection, denial or conflicting history. Not for runtime integration tests (cratis-specifications-exercise-backend).
compatibility: Requires the Screenplay CLI.
---

# Specify one contrast in the deciding slice

**Requires:** Check `screenplay --version`; restore the project's pinned CLI if missing.

1. Fix the prior facts, key and caller in the deciding slice. Read references/fixture-data.md when reusing command values. **Done:** the positive case exercises the command and asserts the produced event's destination and payload, rather than directly appending the expected fact.
2. Change only the invalid input and assert the specific refusal. For example, override the `name` in an existing command example while retaining the authorized caller:

```screenplay
      specification RejectingAnEmptyName
        given caller
          authenticated
          role "CatalogEditor"
        when Aster name = ""
        then error "Name is required"
```

   **Done:** an authorization failure cannot satisfy the validation example. Read references/negative-paths.md for denial and other negative paths.
3. Run `screenplay ./model` followed by `screenplay test model --format json` against the application model directory. **Done:** every intended address executed and passed. If the report says `unsupported`, inspect the result's `capability` and `reason`; do not count it as coverage. For simultaneous delivery or real storage isolation, send the same examples to [Prove the boundary a direct call misses](../cratis-specifications-exercise-backend/SKILL.md).
