# Bound the read, not just the append

List source, stream (if applicable), store, namespace and event types contributing to the decision. The boundary must cover the original read, including removals or creation after an absent result. A narrower stream condition cannot protect a whole-source read. An explicit boundary captured later can miss intervening writes; retain the one acquired with the state.
