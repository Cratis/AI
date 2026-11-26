---
name: cratis-platform-diagnose-slice
compatibility: .NET SDK for backend checks; Playwright Chromium for browser checks.
description: Use when a slow or failed application path crosses command, observer and query boundaries and the failing stage is unknown. Not for repairing a known observer partition (cratis-chronicle-inspect-observer).
---

# Find the first boundary that falls behind

1. Pick one accepted example in a disposable namespace. For Register author, follow the permitted editor's single submission to the expected Authors row. Bound the evidence by request/trace ID, event store, namespace, source, sequence and observation window. An intent may have been refused: inspect the command result before looking for a fact. **Done:** one correlated case with an expected observation and no unrelated payloads. If read-only evidence cannot establish the scope, ask for a sanitized fixture capture rather than connecting to a running system.
2. For that case compare command completion, append position, observer checkpoint for the same sequence and partition, keyed view, `AllAuthors` response, and first visible row. Record elapsed times within a clock domain; do not subtract unrelated host clocks. Read references/safe-telemetry.md when assembling spans from separate producers. **Done:** a small ordered record that distinguishes observed failure, missing evidence and downstream consequences. A missing span alone is not a failed append.
3. Name the earliest *observed* divergence. For example: accepted, append 12, observer 11, no row. Read references/replay-vs-render.md when the symptom is a stale screen. **Done:** identify the first behind stage (observer), or the two boundaries between which evidence is missing. Do not tune rendering from a late browser timestamp alone.
4. Hold the request and fact fixed on a disposable target. Compare two snapshots: before the observer reaches the fact's position and after the keyed row becomes readable. For example, given two samples from a single partition:

```csharp
        Assert.Equal("Observer behind", FirstGap(capture, samples[0]));
        Assert.Equal("Row returned; inspect delivery", FirstGap(capture, samples[1]));
```
 **Done:** show which position or duration changed and which upstream observations did not. If the checkpoint had already passed the fact's position, this variation would not explain the original symptom. Pass a known observer/partition and its positions to [Locate the stalled delivery before recovering it](../cratis-chronicle-inspect-observer/SKILL.md); pass a fresh query result with a stale subscription to [Locate the first missing emission](../cratis-arc-diagnose-live-query/SKILL.md). Neither handoff authorizes repair.

Run `dotnet test -c Release` in the application's diagnosis spec project. The same request must move from observer-behind to row-present when only its checkpoint advances.

**Requires (browser boundary):** In an application using Playwright Test, check `npx --no-install playwright install --list` for Chromium. If absent, use the application's provisioned browser-test environment or mark visible readback unverified. Run `npx --no-install playwright test --project=chromium` with the application's Chromium project name. The correlated row should appear only after the query returns it.
