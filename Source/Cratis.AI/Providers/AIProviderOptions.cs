// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// The configuration for dispatch to configured AI providers, bound from a consumer's
/// <c>Cratis:AI:Providers</c> configuration section. Ported from Direct's
/// <c>AIProviders.AIProviderOptions</c> (plan Section 5.2 step 6).
/// </summary>
public class AIProviderOptions
{
    /// <summary>
    /// The configuration section name the options are bound from.
    /// </summary>
    public const string SectionName = "Cratis:AI:Providers";

    /// <summary>
    /// Gets or sets how many calls to one configured provider may be in flight at once - see
    /// <see cref="ProviderConcurrencyGate"/>. Applied independently per provider id, so this one
    /// number sizes every provider's own gate rather than a single shared bound across all of them:
    /// two different configured providers (different vendors, or even different API keys on the
    /// same vendor) can have very different rate limits, and an idle provider must never queue
    /// behind a busy, unrelated one.
    /// </summary>
    public int MaxConcurrency { get; set; } = 4;

    /// <summary>
    /// Gets or sets how long a call may wait for a concurrency slot on its provider before giving up.
    /// A saturated provider is meant to degrade the same way every other resolution failure does in
    /// a resolution layer built on this gate - rather than hanging the caller (often a reactor with
    /// its own timeout) indefinitely.
    /// </summary>
    public TimeSpan MaxConcurrencyWaitTimeout { get; set; } = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Gets or sets how long a single completion - resolution, the concurrency wait, and the vendor
    /// call together - may run before it is abandoned. Most callers of a Chronicle-backed consumer
    /// are reactors, and a Chronicle observer processes one call at a time: a vendor that stops
    /// responding without ever erroring does not just fail that one completion, it wedges the
    /// observer behind it forever, with nothing to quarantine and no failed partition to retry -
    /// Chronicle itself has no ceiling for a reactor call that never returns (Cratis/Chronicle#3899).
    /// Bounding the call turns that silent, permanent hang into an ordinary failed completion
    /// Chronicle can record and retry.
    /// </summary>
    public TimeSpan CompletionTimeout { get; set; } = TimeSpan.FromSeconds(45);

    /// <summary>
    /// Gets or sets how much life a ChatGPT subscription's access token must have left for a worker
    /// session to be dispatched with it as-is; below this it is refreshed first.
    /// </summary>
    /// <remarks>
    /// This is a bet on how long a worker session runs, because the container cannot renew the
    /// credential itself without retiring the one the host holds. Too small and a long session
    /// outlives its token mid-run; too large and every dispatch spends a refresh. Half an hour covers
    /// the ordinary session while still reusing a token across a busy pass.
    /// </remarks>
    public TimeSpan SubscriptionRefreshMargin { get; set; } = TimeSpan.FromMinutes(30);

    /// <summary>
    /// Gets or sets how long a provider is left alone after it turned work away over its own usage
    /// limit.
    /// </summary>
    /// <remarks>
    /// Vendors do not say when the allowance resets, so this is a guess that corrects itself: too
    /// short and the provider is tried again and re-parked, costing one worker session; too long and
    /// capacity sits idle. An hour is short enough to recover promptly and long enough not to spend a
    /// session every few minutes discovering the same answer.
    /// </remarks>
    public TimeSpan RateLimitCooldown { get; set; } = TimeSpan.FromHours(1);

    /// <summary>
    /// Gets or sets how far back a provider failure still counts against it when picking a pool member.
    /// </summary>
    public TimeSpan RecentFailureWindow { get; set; } = TimeSpan.FromMinutes(15);

    /// <summary>
    /// Gets or sets how long a usage snapshot stays good enough to answer from without asking the vendor again.
    /// </summary>
    public TimeSpan UsageSnapshotFreshness { get; set; } = TimeSpan.FromMinutes(5);

    /// <summary>
    /// Gets or sets how long a vendor's usage surface may take before the read is abandoned.
    /// </summary>
    public TimeSpan UsageReportTimeout { get; set; } = TimeSpan.FromSeconds(8);
}
