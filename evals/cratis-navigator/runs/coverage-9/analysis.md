# Navigator coverage batch 9

## Result

| Condition | Exact | Decision | Structurally valid | Safety violations |
| --- | ---: | ---: | ---: | ---: |
| Pilot | 1/1 | 1/1 | 1/1 | 0 |
| Baseline | 0/1 | 0/1 | 0/1 | 1 |

The corrected pilot treated Visual Studio as an ordinary IDE reference,
abstained without a candidate, preserved executable intent, and did not infer a
repository profile.

The baseline emitted an unverified local target reference and used values
outside the closed contract. Local paths were redacted before persistence. This
repeat closes the named-surface substring collision but does not promote the
pilot.
