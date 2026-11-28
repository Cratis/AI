# Read progress in the Node service

Use the store handle for the accepted write. With the configured `observerId`:

```ts
const observer = (await store.observers.getAll()).find(o => o.id === observerId);
if (observer) {
    const failures = await store.failedPartitions.getFailedPartitionsFor(observerId);
    // Match the projection's partition key before attributing a failure to this write.
}
```

If the ID is missing, inspect registration, not lag. Otherwise report the observer's sequence, running state and positions alongside any matching failed partition. A rejected query is not an empty failure list.
