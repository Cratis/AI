# Execute through the command pipeline

Inject the host's `CommandPipeline` and call suspending `execute` inside the authenticated operation context. Pass the command rather than calling `handle` yourself; direct invocation skips the checks that precede it. Inspect the result before exposing a response. Chronicle constraint and concurrency refusals are validation findings (`constraintViolation` and `concurrencyViolation`), not exceptions: an unchanged request will not fix a uniqueness conflict. For stale state reload and re-decide rather than retrying blindly.
