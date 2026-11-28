# Carry the Java decision's scope into the append

With the registered event and a `ConcurrencyScope` covering the actual source, filters and position read, construct `var options = new AppendOptionsBuilder().concurrencyScope(scope).build();`. Pass those options to the append that records the decision. A scope of `none` deliberately removes protection. If a second worker changes the guarded history after the read, require the append to refuse and verify no stale event was stored.

Do not assume automatic protection for an injected view. If the worker cannot construct a scope covering all the decision's inputs, delegate both evaluation and append to a guarded service.
