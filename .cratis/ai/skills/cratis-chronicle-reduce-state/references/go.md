# Register typed Go folds

With the registered model, use `chronicle.RegisterReducerHandlers(registry, model, "account-balance", []reducers.Handler{reducers.On(fold)})`. Check the error. Have the fold return the updated `*Balance` and an error; initialize a nil prior state on creation. Returning `nil, nil` removes the instance, it does not mean “leave unchanged”. Test that case independently of an error and an ordinary update.

A class-like receiver can instead use `RegisterReducer`; do not confuse it with `RegisterReadModelReactor`, which observes a model change rather than folding event history.
