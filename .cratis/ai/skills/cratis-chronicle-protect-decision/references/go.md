# Enroll a Go decision before the owner commits

In client v0.28.2, this path requires successful compatibility preflight with server `19.153.0` or `19.153.0-development` and protocol `19.153.0` exactly. A later server number is not sufficient. Do not skip compatibility checking to enable the operation.

Register a supported event-source-keyed projection, begin a transaction against the same store's event log and retain its owner. With its participant `unit`, read:

```go
reader := readmodels.DecisionsFor(store.ReadModels(), model)
read, err := reader.Get(transactions.WithUnitOfWork(ctx, unit), key)
```

Handle errors first, then check `read.Instance.Exists` before using its value. Stage only the resulting events and let the owner commit once. Inspect both the operation error and the returned disposition and result error. Do not retry an ambiguous write. To prove the guard, let another writer change the same admitted history between `Get` and commit; expect the whole stale batch to be refused.
