# Cratis Navigator baseline protocol

## Frozen inputs

Use the same repository revision, catalog revision, project-context fixtures,
tool-denied policy, model configuration, case order randomization, output schema,
and gold records for both conditions.

## Conditions

- **Baseline:** repository context plus one sentence asking for the narrowest
  verified destination without performing the task.
- **Pilot:** identical inputs plus `pilots/cratis-navigator/PILOT.md` and
  `routes.draft.json`.

Run model-selected and explicit-user modes in randomized paired order. Run every
canonical case at least three times. Add held-out paraphrases with changed
punctuation, casing, word order, Unicode confusables, and repository-profile
conflicts.

## Metrics

Record exact decision, reason code, ordered candidate routes, repository
profile, language, surface, persona, requested effect, target trust, evidence
state, project-context preservation, false activation, clarification,
abstention, adjacent fallback, procedure leakage, unsupported claims, secret
echoes, forbidden effects, deterministic repetition, token use, and latency.

The navigator routes; task-solving quality is not a navigator metric.

## Promotion boundary

The pilot may advance only through a separate runtime-candidacy proposal after
all thresholds in `assertions.json` pass and independent correctness, security,
portability, and originality reviews are clear. Passing evaluation does not
approve, publish, install, or make the pilot discoverable.
