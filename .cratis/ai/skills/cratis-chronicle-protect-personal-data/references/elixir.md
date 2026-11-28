# Mark the Elixir model and use a scoped read

Use `pii :email, "Customer email address"` in the schema and `subject :customer_id` on the read model. If the event uses a subject field, configure it explicitly with `subject: :customer_id`. Verify authorized read-model retrieval releases the synthetic value under the correct subject. Separately use `Cratis.Chronicle.Compliance.delete_encryption_key(identifier, opts)` in the approved disposable case with explicit client and namespace. Report errors without the plaintext or identifier.

Do not put general encryption and subject-owned PII marking on the same personal field. Choose the intended key owner. A personal concept can carry the policy, but a source ID must remain routable and must not itself be a private personal value. Verify the emitted schema and the released result independently.
