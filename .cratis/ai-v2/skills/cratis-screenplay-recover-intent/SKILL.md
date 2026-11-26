---
name: cratis-screenplay-recover-intent
description: Use when comparing legacy source, recordings or observed app behavior with a proposed .play model. Not for deciding missing acceptance criteria (cratis-modeling-discover-timeline).
compatibility: Requires the Screenplay CLI to check the candidate model.
---

# Recover evidence without inventing intent

**Requires:** Check `screenplay --version`; if missing, compare supplied observations without claiming the candidate binds. Do not launch an extractor or inspect a live workspace without permission.

1. Bound the supplied evidence by revision, component, caller and observation period. Read references/observation-record.md when coverage is partial. **Done:** each claim identifies its observed input and result, or explicitly identifies the missing observation.
2. Compare one observed behavior and a counterexample with the proposed model. For example, a recording can support the claim that a name appeared in the list, but not that this candidate key was used in storage:

```screenplay
      readmodel Author
        id Uuid key
        name String
      query AllAuthors => observable Author[]
```

   **Done:** observed display, inferred identity and proposed behavior have separate entries. If there is no blank-input recording, leave rejection unresolved and send the question to [Discover one timeline](../cratis-modeling-discover-timeline/SKILL.md).
3. Run `screenplay ./model` on the candidate directory. **Done:** the compiler resolves the proposed declarations; independently, each claim about the legacy app cites an observation in scope. A clean compile cannot establish intent or turn an open model note into an executable requirement.
