# Separate replay policy from duplicate suppression

A replay policy controls whether the handler participates in an intentional rebuild. It does not prevent redelivery when a failed partition recovers. Inspect the provider's receipt for the original delivery identity before recovery. If the effect completed, the same key should resolve to its original outcome. Without an atomic claim-and-effect or a receiver idempotency guarantee, escalate uncertain outcomes rather than promise exactly once.
