# Inspect from the Kotlin service

From a suspending function with the affected store, read `val observers = store.observers.getAll()`. Find the configured observer ID and verify its sequence before comparing a checkpoint with the write. If it exists, load `val failures = store.failedPartitions.getFor(observerId)` using that same ID string.

Report the observer's progress separately from failures for the actual partition. If the observer is absent, check registration and namespace rather than retrying a partition. If the read throws, report the lookup error, not “no failures.”
