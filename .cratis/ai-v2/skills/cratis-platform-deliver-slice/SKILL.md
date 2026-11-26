---
name: cratis-platform-deliver-slice
description: Delivers a business outcome from command input to an observable screen change. Use when implementing a vertical slice end to end. Not for changing only a command (use cratis-arc-declare-command).
compatibility: Requires the .NET SDK and a browser test runner for the live journey.
---

# Register an author and show the new row

Start with the [Library host](../cratis-arc-host-application/SKILL.md) using the `Cratis` package, [Chronicle connection](../cratis-chronicle-connect-application/SKILL.md) and [MongoDB storage](../cratis-arc-connect-storage/SKILL.md) configured with `WithMongoDB()`. Then keep registration and its observable list under `Features/Authors/`. Finish at the screen, not at the command response.

1. Fix the caller, the author ID and the submitted name. Identify the exact row that should appear.
2. Put `RegisterAuthor` in `Registration/RegisterAuthor.cs` and `AuthorRegistered` in `Registration/AuthorRegistered.cs`. Have `Handle()` return `new AuthorRegistered(Name)`.
3. Map `AuthorRegistered` onto the `Author` read model with `[FromEvent<AuthorRegistered>]`. Use the typed author ID as the row identity.
4. Expose the collection through `AllAuthors`. Generate the client from the backend contract.
5. In the registration dialog, bind the editable name to the [generated command](../cratis-components-submit-form/SKILL.md). In the Authors list, read `const [authors] = AllAuthors.use()` and render `authors.data`.
6. Open the real list, submit a unique disposable author and observe the matching row without reloading. Contrast an agreed refusal with no new row.

## Implement author registration

`AuthorId` comes from [declaring domain values](../cratis-fundamentals-name-value/SKILL.md). In `Features/Authors/Registration/RegisterAuthor.cs`:

```csharp
using Cratis.Arc.Commands.ModelBound;
using Library.Features.Authors;

namespace Library.Features.Authors.Registration;

[Command]
public record RegisterAuthor(AuthorId Id, string Name)
{
    public AuthorRegistered Handle() => new(Name);
}

```

In `Features/Authors/Registration/AuthorRegistered.cs`:

```csharp
using Cratis.Chronicle.Events;

namespace Library.Features.Authors.Registration;

[EventType]
public record AuthorRegistered(string Name);
```

In `Features/Authors/Author.cs`, map the registration and expose the observable query:

```csharp
using System.Collections.Generic;
using System.Reactive.Subjects;
using Cratis.Arc.MongoDB;
using Cratis.Arc.Queries.ModelBound;
using Cratis.Chronicle.Projections.ModelBound;
using Library.Features.Authors.Registration;
using MongoDB.Driver;

namespace Library.Features.Authors;

[ReadModel]
[FromEvent<AuthorRegistered>]
public record Author(AuthorId Id, string Name)
{
    public static ISubject<IEnumerable<Author>> AllAuthors(IMongoCollection<Author> collection) =>
        collection.Observe();
}
```

For a submission named Aster, follow `Name` through `AuthorRegistered.Name` and `Author.Name`. Looking up Aster after a manual refresh checks a different path from delivery to the already-open list.

## Avoid

- Don't append in the dialog; invoke the generated command.
- Don't append in `Handle` and also return the event; return the event once.
- Don't maintain a second list by inserting a local row on success; observe the query.

## Related skills

- [Declare the command](../cratis-arc-declare-command/SKILL.md) for the write contract.
- [Project the author row](../cratis-chronicle-project-view/SKILL.md) and [expose the query](../cratis-arc-expose-query/SKILL.md) for `AllAuthors`.
- [Bind the generated client](../cratis-arc-react-bind-slice/SKILL.md) to submit and observe in React.
- [Observe UI behavior](../cratis-specifications-observe-ui/SKILL.md) for the visible acceptance check.
