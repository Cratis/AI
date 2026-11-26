using Cratis.Chronicle.Events;
using Cratis.Concepts;

public record AuthorName(string Value) : ConceptAs<string>(Value);
public record AuthorId(Guid Value) : EventSourceId<Guid>(Value);
