# Subscribe from the Kotlin destination

Call `destination.eventStoreSubscriptions.subscribe("listing-feed", "library") { it.withEventType(AuthorListed::class) }` in a coroutine. The JVM `@EventType` annotation does not declare public visibility. Arrange publication in a supported producer and check the public event in the destination inbox before debugging the Kotlin handler.
