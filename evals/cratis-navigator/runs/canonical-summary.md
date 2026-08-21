# Navigator canonical evaluation summary

**Catalog revision:** `2a434e6458f571cfa009c2112763c8f0f6091945`

**Promotion:** blocked

| Condition | Strict exact | Semantic | Decision | Structurally valid | Observed output violations | Tokens | Duration (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Pilot | 26/28 | 28/28 | 28/28 | 28/28 | 0 | 251460 | 417144 |
| Baseline | 0/28 | 0/28 | 0/28 | 0/28 | 16 | 187293 | 274921 |

## Promotion blockers

- three-repeat full canonical run is incomplete
- held-out strict exactness threshold is not met
- portability evaluation is incomplete
- independent originality and security promotion reviews are incomplete
- product targets and source contracts remain unverified

## Scope

The selected run for each canonical case is declared in
`canonical-selection.json`. This summary compares one corrected pilot run
per case with its paired baseline. It does not claim the repetition or
held-out evidence required for promotion, and it grants no runtime approval.
Observed output violations do not prove absence of out-of-band tool, network,
repository, approval, or project-context effects; those require telemetry.
