# @cratis/pi-direct

A [Pi](https://github.com/earendil-works/pi) package for Cratis Direct local sessions. When a Direct runner launches Pi for a work item, this package claims the work, keeps the claim alive with heartbeats and releases it with an outcome. In any other Pi session it does nothing.

```bash
pi install npm:@cratis/pi-direct
```

From the start of a Direct-launched session (including credential retrieval, the claim and its confirming heartbeat), and after claim authority is lost, local tools are blocked except `read`, `grep`, `find` and `ls`. The guard opens only after a confirmed grant; refusal keeps it restricted, and acknowledgement does not restore authority. A Direct-launched session also fails closed if launch setup fails (for example, missing credentials or invalid environment), even if no claim was sent. Shells (including `bash` and `powershell`) and unknown extension tools cannot be proven read-only, so they are blocked too. Unlaunched sessions and personal follow-up after release are unaffected. Leases use both wall and monotonic time: wall rollback relative to monotonic time beyond a 1-second tolerance ends authority, suspend counts toward expiry, and a forward wall-clock jump may end authority early. Timing grants are capped at 24 hours, and heartbeat intervals must be shorter than every granted lease after both are rounded to milliseconds, including confirmation and renewal grants. A renewal lease equal to or shorter than the heartbeat interval ends authority synchronously when the response is processed and stops heartbeats without extending the lease deadline. Each shutdown/failed-launch cleanup attempt is bounded to 5 seconds without renewing authority.

**Known limitation:** A wall-clock rollback and suspend within the same ~1-second lease-observation window can cancel out and cannot be detected client-side: Node has no portable suspend-inclusive clock. The Direct server's lease remains authoritative for completion.

Setup, the personal access token and the harness contract are documented in the [Pi harness guide](https://www.cratis.io/direct/runner/harnesses#pi). If a session refuses to start, see [A harness session refuses to start](https://www.cratis.io/direct/runner/troubleshooting#a-harness-session-refuses-to-start).
