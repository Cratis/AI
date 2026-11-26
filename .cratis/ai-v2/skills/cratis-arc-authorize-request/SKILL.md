---
name: cratis-arc-authorize-request
description: Protects model-bound commands and queries with Arc authorization. Use when requiring sign-in or restricting an operation to a role. Not for selecting a tenant (use cratis-arc-isolate-tenant).
compatibility: Requires the Cratis package and a configured authentication provider.
---

# Restrict author registration to editors

Add Arc's authorization attribute to the [existing command](../cratis-arc-declare-command/SKILL.md) in `Authors/RegisterAuthor.cs`. Use the role name issued by your identity provider. Leave `Handle`, `AuthorId` and the event unchanged.

```csharp
namespace Catalog.Authors;

[Command]
[Cratis.Arc.Authorization.Authorize(Roles = "catalog-editor")]
public record RegisterAuthor(AuthorId Id, string Name)
{
    public AuthorRegistered Handle() => new(Name);
}
```

Execute through the pipeline as an anonymous caller, a signed-in reader and a catalog editor. Both refused results have `IsAuthorized` false and append nothing; the editor succeeds. Arc maps the unauthorized command result to HTTP 403. Check that response rather than whether the UI shows the registration button.

Use `[Cratis.Arc.Authorization.Authorize]` without roles to require sign-in alone. On queries, put it on the read model to cover its methods, or on an individual query method for that query's requirements.

## Avoid

- Do not authorize only in React; protect the server operation.
- Do not add method and model role lists together; the method declaration takes precedence.
- Do not test access by invoking `Handle` directly; this bypasses the pipeline.

## Related skills

- [Check tenant membership](../cratis-arc-isolate-tenant/SKILL.md)
- [Exercise the backend](../cratis-specifications-exercise-backend/SKILL.md)
