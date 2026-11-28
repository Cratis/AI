# Configure the Java subscription bridge

Given the destination `IEventStoreSubscriptionsService`, call `EventStoreSubscriptionsServiceJavaBridge.subscribe(service, "listing-feed", "library", b -> EventStoreSubscriptionBuilderJavaBridge.withEventType(b, AuthorListed.class));`. This bridges the suspending operation. The Java annotation cannot mark the producer event public; use a producer that can and verify arrival at the destination independently of registration.
