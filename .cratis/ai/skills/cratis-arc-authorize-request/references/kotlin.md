# Enforce admission at the server in Kotlin

Once the JVM host authenticates callers, put `@Authorize(policy = "activeSubscription")` on the Kotlin command and register the policy. Use `@Roles("Librarian")` when group membership alone decides access. Invoke the command through Arc as a librarian and as a signed-in nonmember: only the librarian should change state under the role requirement.

`IdentityDetailsProvider` enriches the identity presented to the client. It does not protect an operation. If the nonmember succeeds, inspect the declaration on the executed command rather than its identity details.
