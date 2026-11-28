---
name: cratis-chronicle-protect-personal-data
description: Use when marking personal fields, releasing an encrypted read model or evaluating subject-key erasure. Not for deciding who may access a profile (use cratis-arc-authorize-request).
compatibility: A supported application client and access to the intended kernel.
---

# Separate field protection, authorized release and key deletion

Choose an opaque subject ID, not an email, phone number or name. Mark each sensitive field in the schema that stores it. Do not assume the source ID is the data subject, that field marking grants access, or that a new annotation retroactively protects old plaintext.

- C# (`.csproj`): [mark the C# schema and check release and erasure](references/csharp.md).
- Node server (`package.json`): [declare the Node subject and fields](references/typescript.md).
- Kotlin (`.kt`): [use a Kotlin personal concept](references/kotlin.md).
- Java (`.java`): [use the Java compliance bridges](references/java.md).
- Go (`go.mod`): [declare Go field policies and the subject](references/go.md).
- Elixir (`mix.exs`): [mark the Elixir model and use a scoped read](references/elixir.md).
- Python has no released application client: [delegate authorized release and erasure](references/python.md).

Use synthetic data in a disposable namespace. Verify stored and authorized released representations separately. Before any real key deletion, obtain explicit approval for the store, namespace and subject. Confirm the formerly protected value cannot be released again; external exports, logs, backups and earlier plaintext require separate treatment. Deleting a subject key does not scrub retained causation properties; handle those and their copies separately (see [retention and redaction](references/csharp.md#handle-retained-causation-separately)). Never put released data in diagnostics.
