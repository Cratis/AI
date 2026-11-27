using Cratis.Concepts;

namespace Library.Features.Books.Reservations;

public record ReservationId(Guid Value) : ConceptAs<Guid>(Value);
