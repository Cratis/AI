---
name: cratis-platform-verify-service-handoff
description: Use when a maintainer must prove a producer's published fact reaches a different service and changes what its caller sees. For a missing row inside one application, use cratis-platform-diagnose-slice.
---

# Follow one registration across the service boundary

Start with an agreed producer fact, public contract and receiver outcome. Identify both services' store, namespace and tenant mapping. Use a disposable integration environment, an authorized caller and one fresh business key. A producer command spec cannot prove the real receiver consumed anything.

For example, Library owns author registration. A separate catalog promises to list registered authors under a public author key. Agree which field carries that key; the receiver's internal ID need not equal the producer's event source ID.

1. Query Catalog as the intended reader. Check the fresh key is absent. Submit one registration in Library and record the result, source ID and stored fact position.
2. Inspect the outward message for this registration. Match its public type, version and public key to the agreed contract. A successful internal append alone does not show that translation or publication happened.
3. At Catalog's input, identify that same message by its envelope identity or an agreed correlation field. Record the receiving scope and outcome. Never compare offsets belonging to different streams as if they were one clock.
4. Query Catalog as the original reader until its delivery deadline. Require one row for that public key with the expected name; a receipt, HTTP success or unkeyed row count isn't the promised result. Keep only non-sensitive identifiers and outcomes in the report.

If Library promises a confirmation back to its caller, Catalog receiving the registration proves only the outward hop. For example, trace Catalog's `AuthorListed` reply for the same registration key to Library's input, then query Library as the original caller. Require that registration to change from pending to listed by the deadline; a reply in Library's inbox with the registration still pending is a failed handoff.

If the fact exists but the public message is absent, investigate the publisher. If published but not received, inspect the subscription, route and receiver scope. If received but absent from the ready query, inspect the receiver's mapping and read model. Stop at the first missing observation; don't replay shared streams or resend the command to manufacture a pass.

For a [pure translation rule](../cratis-chronicle-publish-contract/SKILL.md), supply one example input and check the output without hosting the services. Reserve this live check for the delivery promise.
