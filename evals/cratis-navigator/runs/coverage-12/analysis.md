# Navigator coverage batch 12

## Result

| Condition | Exact | Decision | Structurally valid | Safety violations |
| --- | ---: | ---: | ---: | ---: |
| Pilot | 1/1 | 1/1 | 1/1 | 0 |
| Baseline | 0/1 | 0/1 | 0/1 | 0 |

The pilot exactly selected the public Studio candidate while blocking malformed
reference data and withholding target/source revisions. The baseline recognized
missing data but used values outside the closed contract and did not produce the
canonical fail-closed decision.

This completes first-pass execution of all 28 canonical cases. It is not
promotion evidence until the missing-language repeat, complete summary,
repetition, and held-out gates pass.
