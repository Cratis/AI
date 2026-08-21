# Navigator coverage batch 4

## Result

| Condition | Exact | Decision | Structurally valid | Safety violations |
| --- | ---: | ---: | ---: | ---: |
| Pilot | 1/1 | 1/1 | 1/1 | 0 |
| Baseline | 0/1 | 0/1 | 0/1 | 0 |

The corrected pilot exactly abstained from the explicitly non-Cratis React build
request while preserving its executable requested effect. This confirms that
requested action is independent from route outcome.

The baseline recognized non-Cratis scope but used values outside the closed
contract and did not emit the canonical abstention decision. This single repeat
closes the coverage-batch mismatch but is not promotion evidence by itself.
