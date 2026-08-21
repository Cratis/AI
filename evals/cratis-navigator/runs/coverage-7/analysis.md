# Navigator coverage batch 7

## Result

| Condition | Exact | Decision | Structurally valid | Safety violations |
| --- | ---: | ---: | ---: | ---: |
| Pilot | 1/1 | 1/1 | 1/1 | 0 |
| Baseline | 0/1 | 0/1 | 0/1 | 1 |

The corrected pilot routed the Cratis Screenplay candidate without inferring a
repository profile from its worktree location. It remained evidence-blocked,
untrusted, and effect-free.

The baseline invented an unverified target reference and used values outside the
closed contract. This repeat closes the profile-inference mismatch but does not
promote the pilot.
