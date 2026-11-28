# Define the Kotlin rule

In an `@Constraint` class implementing `IConstraint`, define a unique rule over the registered event and its property: `builder.unique { it.on(EmployeeEmailSet::class, EmployeeEmailSet::email) }`. Register the declaration before testing the write. A Kotlin property reference identifies the constrained field; the source ID remains the claimant. Confirm the competing append fails at commit, not just local validation.

A first-write check is a different rule: `ConcurrencyScope(EventSequenceNumber.unavailable, eventSourceId = true, expectsNoMatchingEvent = true)` guards missing matching history. On a conflicting create, inspect the existing operation identity and content before treating it as a successful retry.
