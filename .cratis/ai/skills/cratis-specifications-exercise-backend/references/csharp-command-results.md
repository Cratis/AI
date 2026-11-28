# Prove a specific C# command outcome and its effects

Applies to `CommandScenario<TCommand>` with `Cratis.Arc.Testing.Commands` and, for events, `Cratis.Arc.Chronicle.Testing.Commands` imported. Configure the scenario in `Establish`, execute once in `Because`, and dispose it in `Destroy`.

## Arrange what the command reads

Set everything here before the first `Execute` or `Validate`. The caller and pinned generated values cannot change after that call.

- **History.** `_scenario.Given.ForEventSource(id).Events(first, second)` supplies the events the command's read models are built from. For a per-stream model, add `.OnRoute(route)` before `.Events(...)`, resolving the route from `_scenario.EventRoutes`.
- **A fixed read model.** `_scenario.Given.ForEventSource(id).ReadModel(instance)` pins the instance the command receives. A pin wins over seeded events for that model and key. It cannot back a `DecisionRead<T>` parameter (`PinnedReadModelCannotProvideDecisionToken`) or a per-stream model; seed events for those.
- **The caller.** `.WithClaims(new Claim(ClaimTypes.Role, "Librarian"))` runs the command as an authenticated caller with those claims, `.WithPrincipal(principal)` uses an existing `ClaimsPrincipal`, and `.Unauthenticated()` runs it anonymously. These set the principal authorization reads; they do not exercise login or token validation.
- **Server-generated values.** `_scenario.PinGeneratedValue("orderId", id)` fixes a generated parameter so the spec can assert it. When the exact value is irrelevant, call `.AllowGeneration()`. With neither, `Execute` returns a result carrying a `GeneratedValueNotPinned` exception instead of running the command.

When the spec comes from a Screenplay slice, map it directly: `given <Event>` becomes `.Events(...)`, `given readmodel` becomes `.ReadModel(...)`, and `then <Event>` becomes an appended-event assertion with a predicate. Assert every value the slice names and nothing it does not mention.

## Assert the reason, not only the refusal

| Assertion on `CommandResult` | Passes when |
| --- | --- |
| `ShouldBeSuccessful()` / `ShouldNotBeSuccessful()` | The result is, or is not, a success |
| `ShouldBeValid()` | `IsValid` is true |
| `ShouldHaveValidationErrors()` | A validation result is present; fails when every one is `DependencyUnavailable` |
| `ShouldHaveValidationErrorFor(message)` | A validation message contains the text (ordinal, case-sensitive); not a property lookup |
| `ShouldHaveValidationErrorBecauseOf(reason)` | A validation result has that `ValidationResultReason` |
| `ShouldHaveConstraintViolationFor(name)` | A result has reason `ConstraintViolation` and exactly that constraint name |
| `ShouldBeRejected()` | Validation rejected the command; `DependencyUnavailable` alone does not count |
| `ShouldBeRejected(reason)` | A validation message equals the reason exactly |
| `ShouldBeAuthorized()` / `ShouldNotBeAuthorized()` / `ShouldBeDenied()` | The caller was, or was not, authorized |
| `ShouldHaveExceptions()` / `ShouldNotHaveExceptions()` | An exception was, or was not, captured |

Three false greens to rule out:

- **The rule never ran.** A read model the validator or `Provide()` needs but the spec did not seed rejects the command before the validator is constructed, so `ShouldNotBeSuccessful()` passes without the rule. Seed the state and assert the rule's message, or assert `ShouldHaveValidationErrorBecauseOf(ValidationResultReason.DependencyUnavailable)` (from `Cratis.Arc.Validation`) when missing state is the intended outcome.
- **Authorization refused first.** Pair a refusal with `ShouldBeAuthorized()` when the caller should have been allowed.
- **The framework refused, not the rule.** For a constraint or concurrency rejection, assert the reason or the constraint name and that nothing was appended. Message text is presentation and changes; the reason and name are the contract. Check `Execute` as well as `Validate`: `Validate` runs the pipeline filters but skips `Provide()` and `Handle()`, so it cannot show what the command commits.

## Assert what was appended

These return `Task`; await each one.

| Assertion on the scenario | Passes when |
| --- | --- |
| `ShouldHaveAppendedEvent<TCommand, TEvent>(id, e => ...)` | The captured appends contain a `TEvent` for that source matching the predicate; use a fresh source or baseline to exclude seeded matches |
| `ShouldNotHaveAppendedEvents()` | The last `Execute` appended nothing to any source |
| `ShouldHaveAppendedEventsInOrder(...)` / `ShouldHaveAppendedEventsInAnyOrder(...)` | The last `Execute` appended exactly those events, in that order or in any order |
| `ShouldHaveTailSequenceNumber(expected)` | The highest captured sequence number equals `expected`; numbering starts at 0, so one event gives 0 |

Always pass the source ID: an event appended to the wrong source is the defect a returned object hides.

## Order the proof for a command with an external effect

1. Call `Handle()` directly and assert the intent it returns.
2. Run the scenario with a fake for the adapter and assert the calls the fake received.
3. Force a real rejection at commit, such as a seeded constraint conflict, and assert the compensation.

`_scenario.ShouldHaveExecutedOperation<T>()` and `ShouldHaveCompensatedOperation<T>()` prove that `Execute()` or `Compensate()` returned for at least one operation of that type. They do not prove the remote system undid anything; assert that on the fake.
