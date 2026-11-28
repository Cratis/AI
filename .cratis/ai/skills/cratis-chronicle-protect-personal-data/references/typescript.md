# Declare the Node subject and fields

On registered event properties use `@subject()` for the opaque subject and `@pii("contact email")` on the personal value. Mark sensitive model properties in the read model schema too. In an authorized path call `await store.readModels.release(RegisteredPerson, instance)` with the correct subject-bearing instance. In a disposable erasure check only, call `await store.pii.deleteEncryptionKey(personId)` then try a fresh read and release. The release is a distinct operation, not proof that possession of an ID grants access.

Do not put general encryption and subject-owned PII marking on the same personal field. Choose the intended key owner. A personal concept can carry the policy, but a source ID must remain routable and must not itself be a private personal value. Verify the emitted schema and the released result independently.
