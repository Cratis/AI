# Name a scalar in Kotlin

Implement `ConceptAs<T>` for the scalar rather than using a type alias that remains interchangeable with the primitive. Expose the underlying value, not a nested persistence model. Check the interface imported by the host and by the Chronicle client when the same declaration crosses both. Verify an actual command body deserializes into the named type and a persisted query result emits the underlying scalar.
