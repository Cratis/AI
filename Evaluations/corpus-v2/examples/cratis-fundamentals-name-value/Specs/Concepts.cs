using Cratis.Chronicle.Events;
using Cratis.Concepts;

namespace Library.Features.Authors;

public record AuthorName(string Value) : ConceptAs<string>(Value);
public record AuthorId(Guid Value) : EventSourceId<Guid>(Value)
{
    public static AuthorId New() => new(Guid.NewGuid());
}
