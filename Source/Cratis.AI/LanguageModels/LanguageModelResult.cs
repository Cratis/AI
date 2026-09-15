// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers;

namespace Cratis.AI.LanguageModels;

/// <summary>
/// The outcome of asking a language model to complete a prompt. Ported from Direct's
/// <c>LanguageModels.LanguageModelResult</c> (plan Section 5.2 step 7) - already the "return usage for
/// every operation we do" contract the brief asks for; <see cref="Usage"/> is widened from Direct's
/// original two-field shape to the full concept set the package's usage subsystem formalizes.
/// </summary>
/// <param name="Succeeded">Whether the model produced a completion.</param>
/// <param name="Text">The completion text - empty when it did not succeed.</param>
/// <param name="FailureReason">Why it did not succeed - empty when it did.</param>
/// <param name="Usage">The usage the completion reported - <see langword="null"/> when it did not succeed or the provider did not report it.</param>
/// <param name="Model">The model that actually produced the completion - may differ from the configured default when the calling purpose has its own role model.</param>
/// <param name="ProviderId">The configured AI provider that served the completion - <see langword="null"/> only on results that never reached one.</param>
/// <param name="IsTransient">
/// Whether this failure is worth retrying - a vendor rate limit, a server error, or a network-level
/// failure reaching it, as opposed to a permanent one (misconfiguration, a rejected request) that
/// retrying can never fix. <see cref="ManagedLanguageModel"/> is the only reader of this - callers
/// beyond it only ever see the outcome retries eventually settled on.
/// </param>
/// <param name="RetryAfter">
/// How long the vendor asked a retry to wait, when a rate-limited (429) response said so - honored by
/// <see cref="ManagedLanguageModel"/>'s retry in place of its own default backoff, capped so one
/// vendor-requested wait can never dominate the retry budget.
/// </param>
public record LanguageModelResult(
    bool Succeeded,
    string Text,
    string FailureReason,
    LanguageModelUsage? Usage = null,
    ModelName? Model = null,
    AIProviderId? ProviderId = null,
    bool IsTransient = false,
    TimeSpan? RetryAfter = null)
{
    /// <summary>
    /// Builds a successful result.
    /// </summary>
    /// <param name="text">The completion text.</param>
    /// <param name="usage">The usage the completion reported, when the provider reported it.</param>
    /// <param name="model">The model that actually produced the completion.</param>
    /// <param name="providerId">The configured AI provider that served the completion, when one did.</param>
    /// <returns>The <see cref="LanguageModelResult"/>.</returns>
    public static LanguageModelResult Success(string text, LanguageModelUsage? usage = null, ModelName? model = null, AIProviderId? providerId = null) =>
        new(true, text, string.Empty, usage, model, providerId);

    /// <summary>
    /// Builds a failed result that retrying can never fix (misconfiguration, a rejected request).
    /// </summary>
    /// <param name="reason">Why it did not succeed.</param>
    /// <returns>The <see cref="LanguageModelResult"/>.</returns>
    public static LanguageModelResult Failure(string reason) => new(false, string.Empty, reason);

    /// <summary>
    /// Builds a failed result worth retrying - a vendor rate limit, server error, or network-level
    /// failure reaching it.
    /// </summary>
    /// <param name="reason">Why it did not succeed.</param>
    /// <param name="retryAfter">How long the vendor asked a retry to wait, when it said so.</param>
    /// <returns>The <see cref="LanguageModelResult"/>.</returns>
    public static LanguageModelResult TransientFailure(string reason, TimeSpan? retryAfter = null) =>
        new(false, string.Empty, reason, IsTransient: true, RetryAfter: retryAfter);
}
