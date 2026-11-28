# Protect a library member's name and email

1. Reference `Cratis.Chronicle`, `Cratis.Arc` and `Cratis.Fundamentals`. Use a surrogate member ID, not an email address. Use the event source ID as the subject when the history belongs to the person described.
2. Mark the name concept with `[PII]`. Mark a personal scalar such as email on both the event and the read model. Give the reason for collecting each value.
3. When reading the profile directly from the application's database collection, authorize the caller, check the profile is not null, then use `var readable = await eventStore.ReadModels.Release(profile);`. Release cannot recover the original name or email after key deletion. A successful `Release` does not prove the values were decrypted.

```csharp
// Shared imports for the three feature namespaces below.
using Cratis.Arc.Queries.ModelBound;
using Cratis.Chronicle.Compliance.GDPR;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Projections.ModelBound;
using Cratis.Concepts;

using Library.Features.Members;
using Library.Features.Members.Registration;

namespace Library.Features.Members
{
    // Features/Members/MemberId.cs and MemberName.cs
    public record MemberId(Guid Value) : EventSourceId<Guid>(Value);
    [PII("Member name for identification and correspondence")]
    public record MemberName(string Value) : ConceptAs<string>(Value);
}
namespace Library.Features.Members.Registration
{
    // Features/Members/Registration/MemberRegistered.cs
    [EventType] public record MemberRegistered(MemberName Name, [PII("Email for member correspondence")] string Email);
}
namespace Library.Features.Members.Profiles
{
    // Features/Members/Profiles/MemberProfile.cs
    [ReadModel, FromEvent<MemberRegistered>]
    public record MemberProfile(MemberId Id, MemberName Name, [PII("Email for member correspondence")] string Email);
}
```

## Delete one member's key

Erasure is irreversible. Demonstrate this only in a disposable namespace with synthetic data. In production, require separate authorization, stop in-flight personal-data writes and prevent new ones from recreating protected data. Include other namespaces, retained exports and backup keys in the erasure plan.

With an `IEventStore` from `Cratis.Chronicle` for the correct namespace, call `await eventStore.PII.DeleteEncryptionKeyFor(memberId.Value.ToString());`. For an application store, deletion targets that store and the other registered non-system stores in the same namespace. It needs complete store discovery and authorization where enforced. Successful erasure fences the subject's old key, deletes it and evicts cached copies. It does not remove retained read-model documents or erase plaintext exports.

The call rejects store-discovery or authorization gaps before deleting anything. A failure during deletion can leave some stores erased: resolve it and retry. Other namespaces and forwarding destinations are not covered; erase them separately. Verify that protected values are unreadable in each affected store and check retained documents, exports and recoverable key backups separately before closing the request.

Run these verification reads outside command decision logic. With `using Cratis.Chronicle.Events;` for `EventSequenceNumber`, read `await eventStore.EventLog.GetFromSequenceNumberWithErasedProperties(EventSequenceNumber.First, memberId)`. For the registration, check `registration.Context.ErasedProperties.Any(path => path.EndsWith("email", StringComparison.OrdinalIgnoreCase))` and `((MemberRegistered)registration.Content).Email != originalEmail`. Read `await eventStore.ReadModels.GetInstanceById<MemberProfile>(controlMemberId.Value)` and check the control member's email still equals the original.

## When it goes off the usual path

- **A history describes someone other than its owner:** use `await eventStore.EventLog.Append(historyId, new MemberRegistered(name, email), subject: memberId.Value.ToString());` with the ID of the member described. In a multi-subject view, delete A's key with the call above and check that release withholds A's fields but still releases B's. Don't declare `__subject` or `__subjects` on the model; Chronicle owns them.
- **An old event or projected field was stored unmarked:** adding `[PII]` does not erase plaintext already written. Inventory and verify cleanup of each affected store and independently retained copy instead of relying on key deletion.
- **A released field is empty:** check `registration.Context.ErasedProperties` as above before attributing the empty value to erasure.

## Avoid

- Don't store personal values in IDs.
- Don't use release to decide authorization or pass it a missing profile.
- Don't promise to retract copies already released or erase backups by deleting the key.

## Related skills

- Authorize access (`cratis-arc-authorize-request` skill in `cratis/arc/identity`)
- [Project the member profile](../../cratis-chronicle-project-view/SKILL.md)

## Preserve policy when the schema changes

In this client nonempty `[ComplianceDetails]` takes precedence over the `[PII]` details; the PII attribute’s own details are used as a fallback. Do not combine `[Encrypted]` and `[PII]` as two layers of the same erasure policy: they have different key ownership. After deletion, `EncryptionKeyErased` is a refusal, not permission to re-provision silently. `AllowNewEncryptionKeyFor` is an explicit decision for **future data** and cannot recover previous revisions. `IEventSequence.Redact` targets an event or selected source/types with a reason, not every value protected by a subject key. Protect key storage and its replicas alongside the event store.

For a hosting change, follow the dedicated key store cutover in `cratis-chronicle-deploy-kernel` before interpreting empty values as evidence of erasure.

## Handle retained causation separately

Deleting the subject key does not scrub causation property values. On Chronicle 19.20.0 or later, set `events.causationPropertyRetention` to `Omit` (`Cratis__Chronicle__Events__CausationPropertyRetention=Omit`; default `Retain`) to stop retaining property values on new writes only. For existing events, use targeted Workbench redaction (see `cratis-chronicle-web-workbench`) when authorized; it removes event content as well as retained causation property values. Forwarded copies and backups need separate handling. Check a synthetic marker before and after changing retention or redacting; never use real personal data.
