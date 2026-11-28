---
name: cratis-specifications-test-typescript-behavior
description: Use when a TypeScript library author needs to isolate a calculation, serializer or service decision in the package runner. Not for mounting application UI (use cratis-specifications-test-application-ui).
compatibility: Requires the application’s TypeScript test project and its installed runner.
---

# Isolate a TypeScript decision in its real runner

Start with the nearest discovered spec for the package, not a new test framework. Match its file pattern, imports and assertion setup. For a deterministic transformation, call the function directly; use a shared context only when several observations need the same arrangement.

For example, to specify that a serializer preserves an empty collection, pass an object with an explicitly empty list, deserialize its serialized form and compare the returned list with `[]`. Test a missing member separately only if its contract differs. Neither case needs a DOM or an assertion on an internal call.

**Context lifetime matters.** Import `given` from the local fixture used by adjacent specs. `given(Context, callback)` creates one context for the registered suite, not one for each `it`. Put one awaited action in suite setup and keep observations read-only. If each observation must act, construct fresh mutable state in per-test setup. A second test that passes only because the first populated a stub is a false green.

Use Chai’s `should` when the package setup installs it; promise and spy assertions need their corresponding plugins, and metadata-dependent code needs the package’s reflection setup. Use `expect` where adjacent tests already use it. Restore timers and stubs before leaving the suite. Run the package’s configured test project and confirm that the new case is collected: a green run of a different project proves nothing.

Do not assume every local `given` has the same constructor signature: the Components helper passes the registered suite, whereas the Fundamentals serializer fixture creates a parameterless context. Copy the import and signature from the package whose tests will actually run.
