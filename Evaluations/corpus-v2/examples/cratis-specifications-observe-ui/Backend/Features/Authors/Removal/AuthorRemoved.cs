using Cratis.Chronicle.Events.Constraints;

namespace Library.Features.Authors.Removal;

[EventType]
[RemoveConstraint("UniqueAuthorName")]
public record AuthorRemoved();
