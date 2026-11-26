---
name: cratis-arc-declare-command
description: Use when creating an Arc command, adding an event to a command or returning an event from Handle(). Not for declaring the event type or appending directly (cratis-chronicle-record-event), or invoking an existing command (cratis-arc-invoke-command).
compatibility: Requires the .NET SDK.
---

# Return the outcome of an intent

1. Name the intent and include only caller-controlled inputs. For `RegisterAuthor`, the input selects the author's history and supplies `Name`; get the authenticated actor from trusted context, not an input field. Give unresolved ID semantics to [Name a value](../cratis-fundamentals-name-value/SKILL.md). **Done:** two registrations for different authors cannot accidentally select the same history through a constant or an ID allocated inside the handler.
2. Put the handler on the command record. For an event-backed command, return the fact; the Chronicle integration appends it. Excerpt with the application's `AuthorId` and `AuthorRegistered` contracts:

```csharp
[Command]
[Cratis.Arc.Authorization.Authorize(Roles = "catalog-editor")]
public record RegisterAuthor(AuthorId Id, string Name)
{
    public AuthorRegistered Handle() => new(Name);
}
```

   **Done:** one success path produces one fact; no second append or controller write. Pass the payload contract to [Record an event](../cratis-chronicle-record-event/SKILL.md) if a new fact type is needed.
3. Dispatch Aster once as a permitted catalog editor and inspect the append list for the submitted source. Hand the blank-name case to [Validate a command](../cratis-arc-validate-command/SKILL.md). **Done:** exactly one matching fact for success, none for refusal. If direct `Handle()` succeeds but nothing is stored, verify that dispatch used the pipeline and that the host activated Chronicle. Run the command scenario with `dotnet test -c Release` in the application's spec project as in [Exercise the backend](../cratis-specifications-exercise-backend/SKILL.md); don't return an event log receipt as a client contract.
