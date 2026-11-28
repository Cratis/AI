# Repair the decision, not the severity

Save the code, location, selected root and failing gate. Fix the earliest defect that explains the others, then repeat the same gate. When an edit changes what a caller can do or what history means, get the new behavior reviewed rather than calling it a mechanical repair.

| Observed code | What to inspect and change |
| --- | --- |
| `PLAY0029` | The parser skipped an unknown construct in a slice. Look at its indentation and spelling; confirm the expected declaration is in the resulting model. |
| `PLAY0479` | Use postfix `optional` on the intended type. This information diagnostic is not a warnings-as-errors tripwire. |
| `PLAY0817` | Put one subject (`for item` or `for screen`) on the action, before its inline label. A toolbar heading is not an action. |
| `PLAY0819`, `PLAY0820` | Name the binding explicitly when case or multiple compatible nominal keys could change the submitted value. Recheck with two distinct IDs. |
| `PLAY0821` | A screen-wide action cannot choose a row to satisfy its guard. Use an item action for row work; don't select an arbitrary row. |
| `PLAY0822`, `PLAY0823` | Decide whether the body chooses events or just their payloads. For possible events, supply the body and its nonempty allowed set, with each distinct event routed correctly. Don't also declare a fixed production list. |
| `PLAY0828`, `PLAY0831` | An onboarding draft may be incomplete. Resolve the application authentication block and the named invitation personas before handoff. A draft warning does not permit signup. |
| `PLAY0833` | Replace inline JSON with the DSL's indented member assignments or list items. Check the model value, not just that the file parses. |
| `PLAY0835`, `PLAY0836`, `PLAY0837` | Give the machine exactly one initial state. Trace reachability and missing outgoing transitions; label a state final only if that is the owner's intended end. |
| `PLAY0838`, `PLAY0842` | A final state cannot transition again. Two unguarded transitions on the same event compete; clarify the choice rather than swapping their order. |
| `PLAY0844`, `PLAY0845` | A workflow needs a trigger and a path from a trigger to each intended node. A node's name alone does not start it. |
| `PLAY0848`, `PLAY0849` | Connect both decision outcomes. A wait without expiry can last forever; model that intentionally or agree a deadline and its consequence. |
| `PLAY0852` | Correct the IANA zone on the app, command or fixture. Do not replace an invalid business zone with UTC just to pass the test. |
| `PLAY0859`, `PLAY0860` | A passive model is for command reads, not query or screen consumers. Find the decision that needs it, or use an active read model for a real read surface. |
| `PLAY0864`, `PLAY0870` | Give each graph node precisely one key. On removal, decide whether incident edges disappear too; declare `detach` or remove edges explicitly if needed. |
| `PLAY0872`, `PLAY0880` | Use node and edge handlers, not a document join, for graph projection. Follow the declared edge direction in the query. |
| `PLAY0881`, `PLAY0883` | The graph query's `return` must populate the result shape with compatible types. A property reached only through an optional path cannot promise a required value. |

On a missing result without diagnostics, check file reachability, whether the query is looking up the full identity, and whether the target actually supports the bound feature. Preserve comments the model owner relies on before applying an edit that canonically prints the file. Use a model note rather than a comment for a question the acceptance gate must detect.
