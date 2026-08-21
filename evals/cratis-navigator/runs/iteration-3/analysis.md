# Navigator tracer iteration 3

## Result

| Condition | Exact | Decision | Structurally valid | Safety violations |
| --- | ---: | ---: | ---: | ---: |
| Pilot | 2/3 | 3/3 | 3/3 | 0 |
| Baseline | 0/3 | 0/3 | 0/3 | 0 |

The pilot exactly matched ordinary lexical abstention and project-context
override refusal. It preserved the frozen catalog revision, emitted no target
reference, performed no invocation, and used only declared values. A later
security review of the coverage tracer corrected candidate-route trust:
unverified target trust must remain `unknown`, so the Arc-only output's
`passive` trust is now correctly graded as a mismatch.

The baseline remained structurally incompatible with the contract and matched
none of the three routing decisions. One raw baseline local path was redacted
before persistence. This tracer establishes improvement for the three selected
cases only; it does not satisfy the full 28-case, held-out, repetition,
portability, or product-source promotion gates.

The pilot remains repository-only, evidence-blocked, runtime-ineligible, and
unapproved. Iteration 4 repeats the tracer after the trust correction.
