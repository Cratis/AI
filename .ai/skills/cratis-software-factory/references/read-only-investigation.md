# Read-only investigation pattern

Use this pattern when diagnosis combines source semantics with Chronicle or
other sensitive runtime evidence.

## Preconditions

Execution requires:

- One target application repository and immutable revision.
- A human-approved statement of the intended semantic invariant.
- Explicit classified and sanitized static artifacts declared as workflow
  inputs; repository-global notes, `.agents/PROJECT.md`, credentials, and
  undeclared files are not supplied by default.
- An exact development environment, server reference, event store, namespace,
  and data classification.
- A `ChronicleReadGrant` that names allowed stable command IDs and fields,
  maximum records, short-lived read-only credential reference, expiry,
  retention, and independent approver.
- No production, mutation, source write, Git write, or publishing capability.

Without these, produce a planning-only workflow or static hypotheses and mark
runtime/root-cause acceptance blocked.

## Recommended DAG

```text
human scope
→ code resolves profile and immutable source evidence
→ agent builds a semantic map from sanitized static evidence
→ human/policy grants exact development read scope
→ code collects capped cohorts and traces
→ code runs existing semantic checks
→ agent assesses causes from sanitized reports
→ independent read-only review when compliance impact warrants it
→ code computes acceptance
→ human accepts result
```

Agents do not query raw runtime data or discover additional repository-global
context. Trusted code should derive counts, equality relations, event/projection
version metadata, and run-scoped pseudonyms, then supply only declared
classified/sanitized artifacts. Raw values stay in encrypted phase scratch with
the shortest practical retention and never enter Chronicle telemetry or model
prompts by default.

## Subject/key investigations

State the expected functions separately:

```text
DocumentKey(document) = ...
ComplianceSubject(document) = ...
EventSourceId(event context) = ...
IntendedIdentity(domain contract) = ...
```

Do not infer one from another. A property whose type is `Subject` does not prove
how a stored document's compliance subject is selected.

Build cohorts for subject equals intended identity, subject equals document key,
neither, and both. The “both” cohort is inconclusive when document key and
intended identity happen to be equal; provenance must show which selection rule
executed.

Compare creation/update paths, event result subjects and context,
projection/reducer versions, replay history, migrations, and missing/default
identity behavior. Correlation is not a root cause unless the candidate explains
both correct and incorrect cohorts and survives alternative-hypothesis checks.

## Default risk bands

These are ceilings, not grants; policy may be stricter:

<!-- markdownlint-disable MD013 -->

| Risk                       | Runtime records | Raw scratch retention | Agent correction | Network                    |
| -------------------------- | --------------: | --------------------: | ---------------: | -------------------------- |
| Low, non-PII static        |               0 |               0 hours |                1 | None                       |
| Confidential development   |             100 |              24 hours |                1 | Exact development endpoint |
| Restricted/PII development |              50 |               4 hours |                1 | Exact development endpoint |

<!-- markdownlint-enable MD013 -->

Any production target, runtime mutation, more than 1,000 records, retention
beyond seven days, or provider exposure of raw restricted identifiers requires a
different security-reviewed workflow.

## Acceptance

Require scope/profile validity, static provenance, read-grant validity, capped
query evidence, artifact hashes, PII minimization, clean workspace, causal
sufficiency, deterministic semantic proof, independent review where required,
and human acceptance.

If semantic proof is unavailable, return a useful provisional diagnosis and a
proposed specification/analyzer task, but do not mark definitive root cause
accepted.
