# Bind and register the Go projection

With registered model and event handles, build `p := projections.ModelBound(model, projections.BindEvent("registered", registered), projections.FromEvent(registered))` and check `registry.AddProjection(p)`. After delivery use `reader := readmodels.For(store.ReadModels(), model)` then `instance, err := reader.Get(ctx, key)`. Check the error before `instance.Exists`. A valid zero-value model and a missing instance are different outcomes.
