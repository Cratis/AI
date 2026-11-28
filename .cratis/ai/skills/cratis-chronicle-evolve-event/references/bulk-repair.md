# Repair stored history only with explicit authorization

1. Obtain authorization for the exact store, namespace, write targets and rollback plan. Scale every application registrant to zero and stop other writers to those targets.
2. Take a consistent backup of every collection the repair writes. Verify that the backups form one usable rollback point before making any changes.
3. Dry-run every step and review the scanned and qualifying counts separately; an unexpectedly empty scan is not a clean result. Use an idempotent repair that preserves persisted types, including BSON numeric types. Set each step’s maximum write count from the reviewed dry run.
4. After a quiet period, recheck the scope, rollback preconditions and write count immediately before each step. If the preconditions no longer hold or the count exceeds the step’s maximum, stop before writing; do not trim the work. After applying, restart the kernel if it caches the affected registry, then bring the application back up. Rerun the dry run; each step must report zero remaining work. Recheck that after a quiet period.
5. For each affected replayable observer, verify the approved replay actually runs to completion and reconstructs representative rows. Migration registration and a healthy process are not evidence of rebuilt state. For an observer that cannot be replayed, stop for a supported recovery plan.
