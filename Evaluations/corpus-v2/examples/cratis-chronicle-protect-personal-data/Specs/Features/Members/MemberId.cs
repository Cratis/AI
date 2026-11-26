using Cratis.Chronicle.Events;

namespace Library.Features.Members;

public record MemberId(Guid Value) : EventSourceId<Guid>(Value);
