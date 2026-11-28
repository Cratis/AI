# Subscribe from the Node destination

Use `await destination.subscriptions.subscribe("listing-feed", "library", b => b.withEventType(AuthorListed));` for the registered public contract. The `@eventType` decorator exposes identity, generation and tombstone options, not public visibility. Use a producer that can mark and route the event, then check actual receipt from the library inbox; do not treat consumer metadata as a publication switch.
