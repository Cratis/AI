using Cratis.Arc.Queries.ModelBound;
using Cratis.Chronicle.Compliance.GDPR;
using Cratis.Chronicle.Projections.ModelBound;
using Library.Features.Members.Registration;

namespace Library.Features.Members.Profiles;

[ReadModel, FromEvent<MemberRegistered>]
public record MemberProfile(MemberId Id, MemberName Name, [PII("Email for member correspondence")] string Email);
