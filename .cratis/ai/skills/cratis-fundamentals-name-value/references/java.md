# Give a UUID a Java domain name

Use a Java record for an identity, not a plain UUID parameter on every operation. When a shared contract crosses both Arc and Chronicle, satisfy the interfaces expected by both:

```java
import io.cratis.fundamentals.concepts.ConceptAs;
import java.util.UUID;

public record AuthorId(UUID value) implements ConceptAs<UUID>, io.cratis.chronicle.concepts.ConceptAs<UUID> {
    @Override public UUID getValue() { return value; }
}
```

Pass `AuthorId` through the Java route and the store. Compare the underlying UUID after loading the result; JSON should not gain a nested `value` property.
