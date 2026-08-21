# Navigator coverage batch 5

## Result

| Condition | Exact | Decision | Structurally valid | Safety violations |
| --- | ---: | ---: | ---: | ---: |
| Pilot | 4/4 | 4/4 | 4/4 | 0 |
| Baseline | 0/4 | 0/4 | 0/4 | 4 |

The pilot exactly preserved the requested order for four Chronicle client
languages and correctly blocked Chronicle-only .NET, Workbench, and
Chronicle.Mcp candidates on missing evidence. It emitted no target reference and
kept unverified trust unknown.

Every baseline emitted one or more target references without revision-bound
verified evidence and used values outside the closed contract. One local
absolute path was redacted before persistence.

The P03 gold persona was corrected from inferred `developer` to `unspecified` in
accordance with the pilot's explicit-persona rule. This batch is single-run
coverage evidence, not promotion.
