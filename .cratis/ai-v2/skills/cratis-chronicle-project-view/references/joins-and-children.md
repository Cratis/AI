# Preserve both keys

For each child event, write its parent selector and child identity separately. A child removed from one author must not remove another child with a similar display name, or remove the parent. For joins, record the foreign key stored by the owner and the key used by incoming changes. Replay the owner then the related changes and check the projected values by key, not by collection count alone.
