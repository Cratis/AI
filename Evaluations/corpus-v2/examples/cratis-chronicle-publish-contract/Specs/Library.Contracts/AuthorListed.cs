using Cratis.Chronicle.Events;

namespace Library.Contracts;

[EventType, Public, EventStore("library")] public record AuthorListed(string PublicName);
