# What if the provider acted but the reply was lost?

Follow one welcome request across the boundary. Suppose the mail service accepted it, then the worker crashed before recording delivery. A constraint can prevent a second request fact without preventing a second email. Redelivering a fact successfully in a specification does not prove a real provider deduplicates deliveries.

Choose the ability's effect class from the provider's contract, not the desired retry policy:

| Class | After a timeout with unknown outcome |
| --- | --- |
| `safe` | Retry a read with no external effect. Do not classify “send” as safe because most calls succeed. |
| `idempotent` | Retry with **the same key**. Name the provider, the logical request the key identifies and how the worker recovers it after restart. A fresh attempt ID defeats the guarantee. |
| `once` (default) | Stop for reconciliation. Look up the original request with the provider before deciding whether another attempt is authorized. Do not convert “no reply” to “not sent”. |

Separate what came back from what happened. A returned value feeds a successful continuation. A declared domain outcome such as no pickup capacity is an answer, not a connection failure. A failed invocation follows its failure path. Assert the branch and the resulting fact separately. A scripted answer proves the model handles that answer, not that it contacted the system. Test the real delivery contract in an authorized integration environment, including interruption after acceptance and before local confirmation.
