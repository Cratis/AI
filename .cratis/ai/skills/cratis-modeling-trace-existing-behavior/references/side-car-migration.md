# Replace legacy behavior one slice at a time

Use this path only for an incremental replacement. Agree with the legacy and new owners which features and schema changes are frozen, for how long, and who can approve exceptions. A legacy row shows what happened; it cannot establish why it was allowed. Settle that with the decision owner before making it a new rule.

For each slice, agree the fact and identity mapping, source of truth, checkpoint and duplicate handling. Feed only agreed facts across a translation boundary and reconcile counts and identities before relying on the new view. Shadow processing must not perform live business side effects.

Name the routing owner and write down the switch and rollback criteria (for example, missing accepted results or unreconciled writes). With explicit authority, move one slice's traffic, check its accepted cases and reconcile both sides before moving the next one. On failure, stop rollout and have the routing owner send traffic back to the prior implementation using the agreed switch. Know how writes made since cutover will be reconciled before switching; if reversal would lose or duplicate them, stop and get a recovery decision rather than replaying blindly.
