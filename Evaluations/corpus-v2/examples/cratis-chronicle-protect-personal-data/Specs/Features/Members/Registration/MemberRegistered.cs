using Cratis.Chronicle.Compliance.GDPR;
using Cratis.Chronicle.Events;

namespace Library.Features.Members.Registration;

[EventType] public record MemberRegistered(MemberName Name, [PII("Email for member correspondence")] string Email);
