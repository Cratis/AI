# Decide whether to acknowledge

Inspect `IsSuccess`, `ConstraintViolations`, `ConcurrencyViolations` and `Errors` on the append result. Only on success does `SequenceNumber` identify the accepted write. A known invariant violation requires a changed request or a domain refusal, not repeated appends. If the connection was lost after sending, do not assume nothing happened. Reconcile using a stable business identity before issuing another non-idempotent write.
