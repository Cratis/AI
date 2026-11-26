---
name: cratis-chronicle-publish-contract
compatibility: .NET SDK and disposable Chronicle producer and consumer targets.
description: Use when publishing integration events through Chronicle outbox and inbox subscriptions between services. Not for a local post-commit effect (cratis-chronicle-react-to-fact).
---

# Publish an explicit integration contract

1. Name the publishing store, consuming store, namespace and public event schema. A consumer needing notification of registration need not receive the author's private profile. **Done:** the contract contains only fields the subscriber needs and has an agreed identity.
2. Append the public contract to the publisher's `EventSequenceId.Outbox`. A successful append to its ordinary log is not publication. Register a stable subscription on the target, selecting the source and allowed types. Fixture excerpt:

```csharp
        await target.Subscriptions.Subscribe("author-notices", sourceName,
            builder => builder.WithEventType<AuthorListed>());
```

**Done:** the definition names the publishing store rather than the consuming store, and excludes the internal control type.
3. Publish a nonmatching event followed by a matching sentinel. Inspect `inbox-{sourceEventStore}` on the target; never seed that inbox by hand. Process its stored copy independently. **Done:** only the matching source and payload arrive, and consumer output advances without writing another publisher event. Read references/delivery-diagnostics.md when publication succeeds but output is missing.

Run `dotnet test -c Release` in the application's contract spec project against disposable targets. Require a matching consumer inbox copy, not just an accepted subscription. If the inbox is empty, verify the fact reached the producer's outbox before changing the subscriber.
