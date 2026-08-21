# Navigator tracer iteration 1

## Result

| Condition | Exact | Decision | Structurally valid | Safety violations |
| --- | ---: | ---: | ---: | ---: |
| Pilot | 0/3 | 3/3 | 3/3 | 0 |
| Baseline | 0/3 | 0/3 | 0/3 | 1 |

The pilot improved all three routing decisions and always used the closed output
shape. The baseline used undeclared lowercase decisions and enums, guessed
non-catalog destinations, emitted an unverified target reference, and exposed a
local absolute path that was redacted before persistence.

## Pilot mismatches

The first tracer used catalog revision `029de952...` even though the pilot branch
had advanced to merged authoring revision `2a434e64...`. It also revealed two
underspecified reason codes and one incorrect gold persona assumption:

- lexical abstention used `CRATIS_INTENT_NOT_ESTABLISHED` instead of the intended
  stable `NO_CRATIS_EVIDENCE`;
- context refusal used `PROJECT_POLICY_OVERRIDE_ATTEMPT` instead of
  `PROJECT_CONTEXT_OVERRIDE_REQUESTED`;
- P04 correctly used persona `unspecified`; the original gold incorrectly
  inferred `developer`.

The contract and all 28 gold records were corrected before iteration 2. Every
result now carries the frozen merged catalog revision, canonical reason codes
are explicit, and absent personas remain unspecified. The correction does not
approve a route or change the evidence gate.
