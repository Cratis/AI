# Repair stored history only with explicit authorization

1. Obtain authorization for the exact store, namespace, write targets and rollback plan. Scale every application registrant to zero and stop other writers to those targets.
2. Take a consistent backup of every collection the repair writes. Verify that the backups form one usable rollback point before making any changes.
3. Dry-run every step and review the counts. Use an idempotent repair that preserves persisted types, including BSON numeric types. Set each step’s maximum write count from the reviewed dry run; if preflight exceeds that maximum, stop before writing, rather than trimming the work. Follow `guards-and-fuses` where installed by the maintainer profile.
4. Recheck counts after a quiet period, immediately before applying. Investigate drift before proceeding. After applying, restart the kernel if it caches the affected registry, then bring the application back up. Rerun the dry run; each step must report zero remaining work. Recheck that after a quiet period.
5. For each affected replayable observer, verify the approved replay actually runs to completion and reconstructs representative rows. Migration registration and a healthy process are not evidence of rebuilt state. For an observer that cannot be replayed, stop for a supported recovery plan.
