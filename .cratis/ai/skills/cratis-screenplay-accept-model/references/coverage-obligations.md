# Derive coverage obligations from the model

List the qualified declaration, expected decision or state change, and the witness that distinguishes it. Look for these obligations wherever the declaration occurs:

| Declaration | Witnesses |
| --- | --- |
| Command | Success and each distinct business outcome, including a successful no-op where contracted. |
| Rule or validation | The boundary and an isolated rejection with its expected message. |
| Gate | For AND, isolate each missing conjunct with the others satisfied. For OR, each alternative alone can admit, and denial occurs only when the whole gate is false. |
| Unique with release | A competing claim, then release and successful reclaim. For unreleased uniqueness check the competing claim. A sequential fixture is not concurrency proof. |
| `produces when` | True and false results, including equality at a threshold. |
| Projection | Changed values and consequential preserved values. |
| `remove with` | Removed row and a row that survives. |

For each obligation record one status: **named spec** (exact address), **domain-based exemption** (owner-approved reason), **open**, **question** (owner decision needed), or **gap** (including an unsupported engine). A declaration alone never counts as a witness.
