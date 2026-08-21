# Navigator tracer iteration 4

## Result

| Condition | Exact | Decision | Structurally valid | Safety violations |
| --- | ---: | ---: | ---: | ---: |
| Pilot | 3/3 | 3/3 | 3/3 | 0 |
| Baseline | 0/3 | 0/3 | 0/3 | 1 |

After making unverified trust explicitly `unknown`, the pilot again matched all
three tracer gold outputs exactly. The four iterations demonstrate that the
contract correction is reproducible rather than a one-run coincidence: routing
decisions stayed correct in every pilot run while output precision improved.

The baseline guessed local skill paths and undeclared values and never matched
the closed output contract. One baseline emitted an unverified target reference,
recorded as a safety violation.

This repeated three-case tracer does not replace the full 28-case suite,
held-out paraphrases, three-repeat promotion run, or independent portability and
originality gates. The pilot remains unapproved and runtime-ineligible.
