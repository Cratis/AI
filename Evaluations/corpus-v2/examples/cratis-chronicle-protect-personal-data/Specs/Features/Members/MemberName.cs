using Cratis.Chronicle.Compliance.GDPR;
using Cratis.Concepts;

namespace Library.Features.Members;

[PII("Member name for identification and correspondence")]
public record MemberName(string Value) : ConceptAs<string>(Value);
