---
name: cratis-fundamentals-name-value
description: Use when naming a scalar domain value or distinguishing an entity identity from its primitive representation. Not for choosing which entity owns history.
---

# Name and map a native value

Give each business identity its own name. Choose its owner before its representation: copy an issuer-owned key; generate only when your application owns creation.

- For an ASP.NET Core project, read [C#](references/csharp.md).
- For a TypeScript package, read [TypeScript](references/typescript.md).
- For a Kotlin module, read [Kotlin](references/kotlin.md).
- For a Java module, read [Java](references/java.md).
- For a Go module, read [Go](references/go.md).

For an Elixir command or event identity, read [Elixir](references/elixir.md).

No Python Arc application recipe is verified. Keep the scalar wire contract and validate it at the owning service boundary.

Round-trip through the production wire and storage codecs. Stop if the scalar becomes a wrapper object, loses precision or can no longer hydrate the named value.
