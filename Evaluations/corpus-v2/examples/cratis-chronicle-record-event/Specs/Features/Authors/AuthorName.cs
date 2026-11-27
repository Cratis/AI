using Cratis.Concepts;

namespace Library.Features.Authors;

public record AuthorName(string Value) : ConceptAs<string>(Value);
