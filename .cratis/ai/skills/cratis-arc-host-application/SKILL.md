---
name: cratis-arc-host-application
description: Use when starting an Arc application and verifying that its host serves a registered endpoint. Not for connecting a Chronicle kernel (use cratis-chronicle-connect-application).
---

# Start and verify the registered host

Start with one finite query or command that needs no external store. Read the recipe for the module that serves requests, not the language of its client:

- For an ASP.NET Core web project, read [C#](references/csharp.md).
- For a Node server package, read [TypeScript](references/typescript.md).
- For Spring Boot with Kotlin sources, read [Kotlin](references/kotlin.md).
- For Spring Boot with Java sources, read [Java](references/java.md).
- For a Go service, read [Go](references/go.md).
- For an OTP application, read [Elixir](references/elixir.md).

No released [Python](references/python.md) Arc host recipe is verified. Call a supported service over HTTP instead.

Call the registered route with its actual credentials and inputs. Stop when the response contains the expected application value: a listening port alone does not prove registration. If the route is missing, check registration and the configured prefix before changing business logic. This probe does not prove event delivery.
