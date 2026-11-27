using Cratis.Concepts;

namespace Library.Features.Books.Reservations;

public record BookId(Guid Value) : ConceptAs<Guid>(Value);
