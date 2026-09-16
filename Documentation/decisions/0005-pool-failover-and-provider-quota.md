# 0005 - Pool-level failover on transient failure, and provider-reported quota ahead of a call

Status: Accepted
Related: [Cratis/AI#337](https://github.com/Cratis/AI/issues/337), `Providers/Pools/PoolMemberSelector.cs`,
`Providers/Pools/AIProviderPoolDispatcher.cs`, `Providers/AIProviderQuotaHeaders.cs`.

## Context

`PoolMemberSelector` picked the single best pool member before a call, based on our own recorded
trailing-week burn - but nothing tried a *second* member if the one picked came back rate-limited.
`TransientProviderFailures` already classified a 429 as retry-worthy, but only for
`ManagedLanguageModel`'s own single-provider retry loop. A pool existed only as a source of "who is
least busy right now" - never as a set of alternatives to fail over across.

Separately, every provider client learned it was rate-limited only by *getting* a 429 back - after
the round trip was already spent. Every vendor the package talks to (OpenAI, Azure OpenAI, Anthropic)
in fact reports its own remaining-quota headroom on ordinary responses too, not only on the request
that finally exceeds it.

## Decision

1. **`PoolMemberSelector.Candidates`** returns the pool's members in full preference order (the same
   ordering `Select` already used, `Select` now defined as `Candidates(...).FirstOrDefault()`) -
   `AIProviderPoolDispatcher` walks it to fail over past a member that just answered transiently.
2. **`AIProviderPoolDispatcher`** dispatches a completion across a pool: tries the head candidate,
   and on a transient result (any of them - a 429 most commonly, but a 5xx or network failure too;
   a pool exists precisely to route around a member currently in a bad way, not only a rate-limited
   one) moves to the next, until one succeeds, one fails permanently, or the pool is exhausted - in
   which case the last result is returned rather than swallowed.
3. **`IAIProviderQuotaTracker`** remembers the most recent `AIProviderQuotaStatus` each provider's own
   responses reported - process-local (in-memory, one instance per replica), which is the right scope
   for a live fact about the last call this process made, not something worth persisting or
   replicating. `AIProviderPoolDispatcher` skips a member `IsKnownExhausted` before ever calling it -
   *unless* that would skip the whole pool, in which case it tries everyone anyway: a known-exhausted
   reading can itself be stale (the vendor's window may have rolled over since the last call), and
   refusing to even attempt a whole pool over a stale reading would be worse than the wasted round
   trip a wrong skip costs.
4. **`AIProviderQuotaHeaders`** centralizes the vendor-specific header parsing - one place per vendor,
   the same reasoning `TransientProviderFailures` already applies to status-code classification:
   - **Anthropic (and Z.ai, read the same way - see caveat below):** `anthropic-ratelimit-requests-remaining`,
     the lower of `anthropic-ratelimit-input-tokens-remaining`/`-output-tokens-remaining` (a call fails
     the moment either runs out, so the tighter figure is the useful one), and
     `anthropic-ratelimit-requests-reset` as an ISO 8601 timestamp. Anthropic documents these as present
     on every response, not only a 429.
   - **OpenAI, Azure OpenAI, OpenAI-compatible gateways:** `x-ratelimit-remaining-requests`,
     `x-ratelimit-remaining-tokens`, and reset windows as a compact, non-standard duration string
     (`"1s"`, `"6m0s"`, `"2h30m3s"`) rather than a timestamp - parsed and added to "now" rather than
     read as an absolute time.
   - A vendor that sends none of its expected headers, or a value that fails to parse, yields
     `null` - "nothing known" is a safe default a dispatcher treats as "not exhausted"; a
     wrong guess from a misparsed header is not.
5. Every `IAIProviderClient` implementation now takes `IAIProviderQuotaTracker` and reports into it
   right after receiving a response (both the OpenAI-shaped clients, through the one shared
   `OpenAIChatCompletionsProtocol.Complete` call site, and the two hand-rolled ones, Anthropic and
   Z.ai) - regardless of status code, since a vendor's own rate-limit headers are informative on a
   success too.

## Consequences

- `AddCratisAI()` now registers `IAIProviderQuotaTracker` and `IAIProviderPoolDispatcher` as
  singletons - every `IAIProviderClient` and the dispatcher must share the one tracker instance for a
  report from one call to be visible to the next.
- Every existing `IAIProviderClient` constructor gained a required `IAIProviderQuotaTracker`
  parameter - a source-breaking change for any direct instantiation (none exist outside this
  package's own specs, which are updated). Not a *release*-breaking one: nothing in Direct or Studio
  constructs these clients directly yet, and DI resolution is unaffected once `AddCratisAI()` is
  called (or the tracker is registered directly).
- **Caveat on Z.ai's headers**: read with the same shape as Anthropic's, on the same reasoning
  `ZAIProviderClient` already reuses Anthropic's payload builder for (Z.ai's gateway is
  Anthropic-compatible). Not independently verified against Z.ai's actual response headers - worth
  revisiting if they prove to differ; the failure mode if they do is simply "no quota known for Z.ai
  providers" (`AIProviderQuotaHeaders` yields `null` for headers it does not recognize), never a wrong
  reading.
- **Caveat on OpenAI's duration format**: `"1s"`, `"6m0s"`, `"2h30m3s"` is reverse-engineered from
  observed header values, not documented anywhere authoritative enough to cite. `ParseDuration` stays
  deliberately forgiving - an unparsable value yields `null` (`ResetsAt` unknown) rather than
  throwing, since the reset time is the least critical of the three quota figures a dispatch reads
  (whether something is remaining and how much matters far more than exactly when it resets).

## Alternatives rejected

- **Retrying the same pool member with backoff instead of failing over.** Already `ManagedLanguageModel`'s
  job, one layer up - a pool exists specifically because a caller has alternatives, and exhausting a
  rate-limited member's own backoff budget before ever trying a sibling wastes the exact headroom a
  pool is meant to provide.
- **Treating a known-exhausted provider as permanently unusable until its reported reset time.**
  Rejected in favor of "skip only when it still leaves a candidate" - a known-exhausted reading is a
  cache of the last response, not a live fact, and trusting it absolutely would let one stale
  read block a whole pool that may have already recovered.
