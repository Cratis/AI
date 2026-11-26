# Check the actual collection

Determine the configured read-model sink, namespace database and collection before checking MongoDB. A passive fold returning a value does not establish that a stored row exists. For a materialized model, wait for the matching projection position, inspect the keyed document in that namespace and verify its removal. If the position hasn't advanced, diagnose the observer before changing query filters.
