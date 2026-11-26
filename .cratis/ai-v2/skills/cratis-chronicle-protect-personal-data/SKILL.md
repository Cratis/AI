---
name: cratis-chronicle-protect-personal-data
compatibility: .NET SDK and a compliance-enabled disposable Chronicle kernel.
description: Use when Chronicle events contain PII or a subject's data must be forgotten under GDPR. Not for changing an event generation (cratis-chronicle-evolve-event).
---

# Protect values for the right subject

1. Remove unnecessary personal fields. Inventory the retained property, purpose, subject, copies and control subject. Use a surrogate source ID; an email in a source ID remains visible even if payload properties are encrypted. **Done:** no personal data in identifiers, tags, exception text or diagnostics.
2. Mark the needed property or value concept with `PII`, enable compliance services and bind the subject before append. The source identifies the history, not necessarily the person in the payload. Example declaration for a profile fact distinct from the registration contract:

```csharp
[EventType]
public record ProfileSupplied([Subject] string Author, [property: PII] string DisplayName);
```

**Done:** an authorized reader can read the synthetic value before erasure, and the unrelated author's record uses a different subject key.
3. On an explicitly disposable store only, authorize erasure for the test subject; delete that subject's encryption key and inspect reads that report erased properties. Read references/redaction-vs-erasure.md for different retention requirements. **Done:** the subject's value is unavailable, the control remains readable, and any separate exports, baseline snapshots or cached plaintext have a named cleanup owner. Never promise that deleting a key recalls an export.

Run `dotnet test -c Release` in the application's compliance spec project against a compliance-enabled disposable kernel. Verify the forgotten subject's protected value cannot be recovered but the control subject's still can. If both become unreadable, check whether both writes used the same subject identifier. Never use production credentials for this check.
