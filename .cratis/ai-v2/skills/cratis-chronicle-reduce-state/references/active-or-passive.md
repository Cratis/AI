# Decide when the fold runs

Use a passive read model when a caller needs a single keyed state reconstructed from history. Use active materialization when queries must enumerate stored results and can tolerate observer lag. The transition itself must mean the same thing in both modes. To compare them, use the same source and event boundary: comparing a caught-up fold to a lagging sink does not reveal a reducer defect.
