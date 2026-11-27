using Cratis.Chronicle.Events;

namespace Library.Features.Books;

public record Isbn(string Value) : EventSourceId<string>(Value);
