# Read Go observer snapshots

Use the store already scoped to the write. Call `observers, err := store.Observers().List(ctx)` and handle the error before inspecting the returned snapshots. Find the expected ID and verify its sequence. For that ID, call `failures, err := store.Observers().FailedPartitions(ctx, id)`; do not pass an empty ID, which selects every observer.

Compare actual positions only: zero can be a valid position. Report a matching failed partition separately from a checkpoint behind the write. If the list or failure read fails, report the read error rather than diagnosing missing registration or healthy delivery.
