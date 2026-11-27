using Cratis.Chronicle.Events;
using Cratis.Chronicle.Events.Constraints;

namespace Library.Features.Authors.Registration;

[EventType(generation: 2)] public record AuthorRegistered(
    [property: Unique(name: "UniqueAuthorName", message: "Author name must be unique")] string DisplayName);
