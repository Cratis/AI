# Staged sources

> **Status:** Source material, not skills. Nothing in this directory is
> packaged, projected, or served to any harness.

General AI-corpus content migrated out of consuming repositories during the
#256 corpus retirement (see
[`Documentation/corpus-generations.md`](../../Documentation/corpus-generations.md))
that had no authored home here yet. It is preserved verbatim so the retirement
loses nothing; turning any of it into a capability happens only through the
[skill-authoring contract](../../Documentation/skill-authoring-contract.md),
reviewed against its owning repository.

## Provenance

| Path | Migrated from | Intended eventual home |
| --- | --- | --- |
| `arc-kotlin/rules/kotlin.md` | `Cratis/Arc.Kotlin` `.ai/rules/kotlin.md` | the `cratis/language/kotlin` cell content gap |
| `arc-kotlin/rules/kotlin-java-interop.md` | `Cratis/Arc.Kotlin` `.ai/rules/kotlin-java-interop.md` | the `cratis/language/kotlin` cell content gap |
| `arc-kotlin/rules/java.md` | `Cratis/Arc.Kotlin` `.ai/rules/java.md` | JVM-consumer guidance under `cratis/language/kotlin` |
| `arc-kotlin/rules/gradle.md` | `Cratis/Arc.Kotlin` `.ai/rules/gradle.md` | JVM build guidance under `cratis/language/kotlin` |
| `studio-issues/upstream-issues.md` | `Cratis/Studio` and `Cratis/Stagehand` `.ai/rules/upstream-issues.md` (identical) | a `cratis/engineering` upstream-discipline procedure |
| `studio-issues/writing-on-issues.md` | `Cratis/Studio` and `Cratis/Stagehand` `.ai/rules/writing-on-issues.md` (identical) | a `cratis/engineering` issue-communication procedure |

Repository-specific rules and skills that were unique to a consuming
repository were **not** moved here: they stayed in their owning repository,
either as sections of its `.cratis/PROJECT.md` or as repository-local skills
under `.agents/skills/`.

## Rules

- Never edit these files into shape here; authoring happens against the
  contract, from the owning repository as authority.
- Never project this directory from a profile; it contributes no capability.
- Delete a row (and this table's row with it) once its authored replacement
  lands, so this directory trends toward empty.
