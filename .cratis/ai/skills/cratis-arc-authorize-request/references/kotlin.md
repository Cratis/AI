# Enforce admission at the server in Kotlin

Once the JVM host authenticates callers, declare the named policy on the command. This example assumes the Chronicle integration is installed and `BookRetired` is registered as an event type:

```kotlin
import io.cratis.arc.artifacts.Command
import io.cratis.arc.authorization.Authorize
import io.cratis.chronicle.eventSequences.EventForEventSourceId
import io.cratis.chronicle.events.EventType

@EventType(id = "book-retired")
data class BookRetired(val reason: String)

@Command
@Authorize(policy = "retireBooks")
data class RetireBook(val bookId: String, val reason: String) {
    fun handle() = EventForEventSourceId(bookId, BookRetired(reason))
}
```

Use an already registered `retireBooks` policy or expose a Spring bean of type `io.cratis.arc.authorization.AuthorizationPolicy` named `retireBooks`. The default Arc Spring Boot configuration registers each policy under its Spring bean name; the name in `@Authorize` must match it. Evaluate the authenticated principal supplied to the policy, not a caller ID from the command. A missing named policy denies access.

Use `@Roles("Librarian")` (from `io.cratis.arc.authorization.Roles`) when group membership alone decides access. Exercise the command through Arc as a librarian and as a signed-in nonmember: only the librarian should change state under the role requirement.

`IdentityDetailsProvider` enriches the identity presented to the client. It does not protect an operation. If the nonmember succeeds, inspect the declaration on the executed command rather than its identity details.
