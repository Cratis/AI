using System;
using Cratis.Chronicle.Events;

namespace Library.Features.Authors;

public record AuthorId(Guid Value) : EventSourceId<Guid>(Value)
{
    public static AuthorId New() => new(Guid.NewGuid());
}
