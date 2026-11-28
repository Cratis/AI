# Which instance does this read select?

Start with two rows that would collide under the suspected key. For a monthly total, use two resources in the same month **and** the same resource in a different month. The answer should identify exactly one pair. Do not fix a collision by concatenating strings in the query.

1. Mark the identifying top-level read-model properties `key`. Explicit keys take precedence over inferred identity. Without them, single-instance query `by` names are considered first; an eligible collection query can fall back to conventional names ending in `Id`. A collection filter is not a reliable declaration of row identity. Make the intent explicit if adding a query might change inference.
2. Several scalar keys form **one** identity with named parts. For `ResourceMonth`, compare both `resourceId` and `period`, not argument order. For an optional single result, declare every part in the query's `by` block as `name Type`; for a command read, map each as `name = source`. A list may filter on fewer parts because it need not identify one row.
3. Supply every key part in `given readmodel` and `then readmodel`. Require all parts on expected collection rows. Otherwise a passing comparison may answer a different question from the one the owner asked.
4. Match each event to the same instance in the projection. The `key` on the model describes the lookup; it does not route incoming facts. For several separate key properties, use an untyped key block with every named part on each root `from` and `remove with`. A typed composite property is a different shape.

## Stored answer or decision-only state?

The default read model is active, even if a command is its only consumer today. If it exists solely to decide a command from replayed history, declare `passive` on its own line **inside** the read model. Do not return it from a query or bind it to a screen. If an operator needs to browse those totals, design an active view for that purpose. The passive marker describes realization; successful binding is not evidence of how a particular runtime stored or replayed state. Verify the actual command and, for active models, the intended lookup on the target.
