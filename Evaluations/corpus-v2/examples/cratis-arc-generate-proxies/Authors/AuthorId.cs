namespace Catalog.Authors;

public record AuthorId(Guid Value) : EventSourceId<Guid>(Value);
