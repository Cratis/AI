# Distinguish opening from later delivery

Verify the registered performer's `observable.Source[O]` under the same admitted tenant. An initial empty slice from `observable.NewState` is a **ready** empty result; use `NewPendingState` for no first result. Subscribe, publish a new value for that tenant, and observe it without subscribing again. Publish for another tenant and verify isolation. Cancel the request and confirm the subscription stops; an initial HTTP response proves neither later delivery nor cleanup.
