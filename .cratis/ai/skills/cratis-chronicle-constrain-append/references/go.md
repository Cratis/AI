# Build and register the Go constraint

After registering reservation and release event types, use `unique, err := constraints.UniqueValues("UniqueEmail").On(reserved.Descriptor(), "email").IgnoreCasing().RemovedWith(released.Descriptor()).Build()`. Check the error, then check `registry.AddConstraint(unique)` before starting the client. Try the same email with a different case and source; inspect the rejected append before releasing the original claim.

Use `UniqueEventTypes` for once-per-source events, not value ownership. When the constraint depends on registry-resolved descriptors, register its factory against that same registry (`RegisterConstraintFactory`); a type registered elsewhere is not a handle in this client.
