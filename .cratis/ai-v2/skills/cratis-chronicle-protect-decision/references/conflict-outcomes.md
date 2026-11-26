# Classify the refusal

`ReadDependencyChanged` means a relevant write invalidated a decision. Start over: acquire inputs, apply rules again and stage the result only if still allowed. `ReadProtectionUnavailable` means the operation cannot enforce the promised protection; do not fall back to an unguarded append. A transient acquisition failure is not evidence that state changed. Distinguish these outcomes in the client response without exposing the competing caller's data.
