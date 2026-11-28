# Run durable work without inventing a domain event

Use Chronicle 19.77.0 or later. The kernel must advertise `occurrences`, and `effect-receipts` for receipted work. Absent or unknown capability fails closed. Normal artifact discovery finds trigger types and handlers. Trigger payloads are plaintext; keep them and persisted responses free of personal data and secrets.

```csharp
using Cratis.Chronicle.Occurrences;

[Trigger("refresh-directory")]
public record RefreshDirectory(string BatchId);

public class RefreshDirectoryHandler(IDirectoryRefresher refresher) : IOccurrenceHandler<RefreshDirectory>
{
    public Task Handle(RefreshDirectory trigger, OccurrenceContext context, CancellationToken cancellationToken) =>
        refresher.Refresh(trigger.BatchId, context.EffectKey("refresh").Value, cancellationToken);
}
```

Here `IDirectoryRefresher` is the application adapter; the receiver must deduplicate the effect key atomically with the external effect. A lease can redeliver. Call `eventStore.Occurrences.Record(trigger, idempotencyId)` in the intended namespace using an ID from the originating durable request. `Recorded` and `AlreadyRecorded` succeed. `OccurrenceIdConflict` means the same ID carried different content; `OccurrencePayloadInvalid` means registration or the payload contract refused it. Neither is a successful retry.

For Chronicle writes, use `context.EffectKey(name)` and look up `eventStore.Occurrences.GetEffectReceipt(key)` in the same namespace. If absent, enroll `unitOfWork.UseEffectReceipt(key, response)` before the owning commit and stage the write transactionally. [Refuse escaped appends](../../cratis-chronicle-protect-decision/references/standalone.md#keep-nested-appends-inside-the-transaction-or-receipt). After an unknown commit, use the stored receipt to settle the outcome; if lookup is unavailable fail retryably, not by assuming absence. A Chronicle receipt does not deduplicate an external service.

For built-in `Startup` / `Shutdown` handlers set `ChronicleOptions.ActivationId` to one stable logical deployment ID shared by its instances. Keep the defaults `ActivationScope.Application` and `LifecycleScope.Application`; `eventStore.Occurrences.EndActivation(id)` ends the logical activation, not an individual pod. Use `ActivationScope.PerProcess` only for process-local lifecycle work. Its shutdown is bounded and may not be recorded on a crash or kill.

Use `OccurrenceScenario<THandler>` with `Record`, `DeliverNext` and `DeliverWithoutCompleting` to simulate a lost worker after the effect. Deliver again after lease expiry and assert one durable effect and the original receipt.
