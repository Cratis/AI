# Stub Arc command outcomes

Stub separate resolved `CommandResult` values where the UI differs: accepted (`isSuccess`), unauthorized (`isAuthorized` false), invalid (`isValid` false with the relevant `validationResults`), and captured exceptions (`hasExceptions` true). Assert the visible reaction to each, such as field errors for invalid input. A resolved `hasExceptions` result does not enter a promise rejection path; test rejected promises separately.

## Isolate suspense query scenarios

In suspense query suites, call `clearSuspenseQueryCache()` and `clearSuspenseObservableQueryCache()` between scenarios after unmounting. Unmounting alone does not reset the shared caches.
