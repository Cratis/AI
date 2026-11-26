---
name: cratis-chronicle-protect-personal-data
description: Protects personal values in Chronicle events and read models. Use when classifying member data, releasing a profile or deleting a member's encryption key. Not for deciding who can access the profile (use cratis-arc-authorize-request).
compatibility: .NET SDK and a compliance-enabled Chronicle kernel.
---

# Protect a library member's name and email

1. Reference `Cratis.Chronicle`, `Cratis.Arc` and `Cratis.Fundamentals`. Use a surrogate member ID, not an email address. By default the event source ID identifies the subject; release uses the read model's `Id` when it has no `[Subject]` member.
2. Mark the name concept with `[PII]`. Mark a personal scalar such as email on both the event and the read model. Give the reason for collecting each value.
3. When reading the profile directly from the application's database collection, authorize the caller, check the profile is not null, then use `var readable = await eventStore.ReadModels.Release(profile);`. Release cannot recover the original name or email after key deletion. Don't use object identity or a successful call as a test that the key exists.

```csharp
// Features/Members/Profiles/MemberProfile.cs
using Cratis.Arc.Queries.ModelBound;
using Cratis.Chronicle.Compliance.GDPR;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Projections.ModelBound;
using Cratis.Concepts;

namespace Library.Members.Profiles;

public record MemberId(Guid Value) : EventSourceId<Guid>(Value);

[PII("Member name for identification and correspondence")]
public record MemberName(string Value) : ConceptAs<string>(Value);

[EventType]
public record MemberRegistered(MemberName Name, [PII("Email for member correspondence")] string Email);

[ReadModel, FromEvent<MemberRegistered>]
public record MemberProfile(MemberId Id, MemberName Name, [PII("Email for member correspondence")] string Email);
```

## Delete one member's key

With an `IEventStore` from `Cratis.Chronicle` for the correct namespace, call `await eventStore.PII.DeleteEncryptionKeyFor(memberId.Value.ToString());`. The subject loses that key in every event store in this namespace. Read both this member and a control member; the first member's email must no longer be readable, while the control member's email must still be readable.

## Avoid

- Don't store personal values in IDs.
- Don't use release to decide authorization or pass it a missing profile.
- Don't promise to retract copies already released or erase backups by deleting the key.

## Related skills

- [Authorize access](../cratis-arc-authorize-request/SKILL.md)
- [Project the member profile](../cratis-chronicle-project-view/SKILL.md)
