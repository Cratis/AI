# Review the Arc draft against the C# application

Read the generator diagnostics together with the source member they name. A warning about an omitted behavior means the source and generated model describe different things. Write down the original rule, the generated declaration or omission, who will resolve it and the target check. Fix an invalid source build before treating recovered symbols as evidence.

| Evidence | Safe interpretation |
| --- | --- |
| `SP0056` | Inspect severity and the named binding failure. The generator can withhold binding-invalid productions and leave them in the handler, then verify the returned document again. A draft that now binds does not contain the omitted decision. An unexpected remaining binder error is a generator defect, not permission to change the business rule. |
| `SP0059`, `SP0062`, `SP0063` | Inspect the original marking, affected type or member and identifier use. A marking on a primitive member may not fit a language that classifies concepts. Do not treat an unmarked output as a decision to disclose the value. |
| `[Encrypted]` | At-rest encryption alone does not recover Screenplay `secret`. Look for audit suppression on the actual concept. `[Encrypted]` plus `[NotAudited]` recovers `secret`; `[PII(OperationalSecret = true)]` plus `[NotAudited]` recovers `pii secret`. Do not guess purpose, subject or retention from any of these. |

If a protected concept appears as a stream address, stop before exporting a workaround. Changing it to an unclassified string can put private information into metadata used outside the payload. Ask the owner for a safe address and verify lookup and subject erasure separately. Keep the original source protection until the model and target realization agree.
