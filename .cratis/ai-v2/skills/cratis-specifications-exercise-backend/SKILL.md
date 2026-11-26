---
name: cratis-specifications-exercise-backend
description: Use when a backend integration test must exercise Arc middleware, a Chronicle append or observer materialization. Not for a pure transition (cratis-specifications-isolate-behavior).
compatibility: Requires the .NET SDK. Container-backed scenarios also need a Docker engine.
---

# Prove the boundary a direct call misses

1. State the failure a direct `Handle()` assertion would miss. For a command that returns a fact, choose an in-process Arc command scenario with Chronicle testing support. Read references/command-scenario.md for pipeline setup. **Done:** the claimed outcome names an execution boundary (for registration: actual scenario append to the requested source), not just the returned object.
2. Use a fresh scenario, supply collaborators and configure the trusted principal *before* first dispatch. Seed only prior facts needed by the decision under the intended source. Execute once. **Done:** the command result distinguishes rejection from success and setup events cannot be mistaken for output.
3. For success, inspect both exact appended events and their destination. For refusal, assert the specific validation or authorization result and absence of writes, not just an exception. **Done:** a disabled handler or a wrong stream would fail the spec. Read references/provider-failures.md when setup fails before dispatch.
4. If the claim extends to an observer, feed the accepted event to the real mapping and check its keyed state. Read references/chronicle-fixture.md when the claim requires a running store/observer rather than the in-process scenario. **Done:** the requested model appears at the correct key with the expected name, or a bounded wait fails with the last observed state. An append check alone is not delivery evidence.

Example: execute registration for Aster; expect success, exactly `AuthorRegistered("Aster")`, at the submitted author's ID. Execute a separate blank-name case; expect a name validation failure and no registration. Run `dotnet test -c Release` in the application's backend-spec project and confirm both outcomes. Report whether assertions exercised a scenario, a projection in isolation or the running observer; don't substitute one for another.

Requires Docker only for a container-backed scenario: check `docker info`. If the engine is unavailable, run the in-process dispatch check and mark store delivery unverified.
