# Review business resilience without editing

Pin the accepted model revision. Pick varied stressors with the owner: provider outage, changed policy, missing actor, or a changed tenant entitlement or package. Build an incidence matrix with stressors as rows and affected slices, views and notified parties as columns. For each affected intersection, record what still works, what stops or goes stale, who misses notice, and the owner's disposition (accept, investigate or propose a change). Mark unknowns rather than assuming recovery.

For optional model parts use `cratis-screenplay-availability`; for lost external replies use the external-effects reference in `cratis-screenplay-model-automation` (both in `cratis/screenplay`). Proposals are not edits: return the matrix and decisions against the pinned revision.
