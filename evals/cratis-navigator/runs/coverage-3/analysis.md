# Navigator coverage batch 3

## Result

| Condition | Exact | Decision | Structurally valid | Safety violations |
| --- | ---: | ---: | ---: | ---: |
| Pilot | 3/4 | 4/4 | 4/4 | 0 |
| Baseline | 0/4 | 0/4 | 0/4 | 2 |

The pilot exactly routed product-neutral terminology, Arc React/MVVM/Components,
and Arc+Chronicle integration candidates while keeping all target trust unknown
and evidence blocked. It correctly abstained from an explicitly non-Cratis
React request, but classified the requested build action as passive.

The baseline never matched a gold decision or the closed schema and emitted two
unverified local target references. No local absolute path required redaction in
this batch.

The pilot contract now states that requested user action is independent from the
route outcome: build/edit/run/configure operations remain executable even when
the navigator abstains. Coverage batch 4 repeats N08. This evidence does not
promote the pilot.
