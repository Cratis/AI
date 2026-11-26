# Distinguish fixture failure from application refusal

An unresolved dependency before `Handle()` is not evidence of rejection. Identify the missing constructor parameter; register the application-owned collaborator before the first `Execute` or `Validate` and use a fresh scenario. If the dependency is the provider whose persistence behavior the spec claims to exercise, run against an isolated real provider instead of substituting it. Assert the expected validation member or authorization result separately from setup exceptions.
