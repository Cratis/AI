# Navigator held-out pass 1

## Result

| Condition | Strict exact | Contract | Decision | Structurally valid | Observed output violations |
| --- | ---: | ---: | ---: | ---: | ---: |
| Pilot | 8/10 | 10/10 | 10/10 | 10/10 | 0 |
| Baseline | 0/10 | 0/10 | 0/10 | 0/10 | 7 |

The pilot matched all ten held-out decisions and contract fields. Eight outputs
strictly matched the frozen JSON. H05 and H10 used different non-empty
clarification wording than the frozen gold. The Contract metric checks only whether a clarification is required, not semantic equivalence.
The wording is not strict equality, so the 95% strict held-out threshold is not met.

The baseline used no valid closed output and emitted seven target references
without verified revision-bound evidence. Local paths and sensitive placeholders
were redacted before persistence.

Zero observed pilot output violations covers only self-reported invocation,
unverified references, local paths, and credential-shaped strings. No tool/
network/write/approval telemetry was persisted, so absence of out-of-band effects
is unverified. This held-out round is closed and will not be tuned after exposure.
Promotion remains blocked on strict held-out exactness, three full repetitions,
portability, independent promotion reviews, telemetry, and verified product
sources.
