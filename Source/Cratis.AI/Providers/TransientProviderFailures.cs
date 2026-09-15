// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers;

/// <summary>
/// Decides which vendor HTTP failures are worth retrying, and reads how long a rate-limited (429)
/// response asked a retry to wait - shared by every <see cref="IAIProviderClient"/> so the "which
/// status codes are transient" decision and the <c>Retry-After</c> parsing exist in exactly one
/// place rather than once per vendor. Ported from Direct's <c>AIProviders.TransientProviderFailures</c>
/// (plan Section 5.2 step 3).
/// </summary>
public static class TransientProviderFailures
{
    /// <summary>
    /// The most a single vendor-requested <c>Retry-After</c> wait is honored for - long enough to
    /// respect a deliberate rate-limit response, short enough that one vendor asking for an
    /// unreasonable wait cannot dominate <see cref="ManagedLanguageModel"/>'s retry budget.
    /// </summary>
    public static readonly TimeSpan MaxRetryAfter = TimeSpan.FromSeconds(10);

    /// <summary>
    /// Builds the <see cref="LanguageModelResult"/> for a non-success vendor response - transient for
    /// a rate limit (429) or a server error (5xx), permanent for everything else (a rejected
    /// request, bad credentials, an unknown model) that retrying can never fix.
    /// </summary>
    /// <param name="response">The response the vendor returned.</param>
    /// <returns>The <see cref="LanguageModelResult"/>.</returns>
    public static LanguageModelResult FromStatusCode(HttpResponseMessage response)
    {
        var reason = $"The language model API returned {(int)response.StatusCode}";
        var isRateLimited = response.StatusCode == HttpStatusCode.TooManyRequests;
        if (!isRateLimited && (int)response.StatusCode < 500)
        {
            return LanguageModelResult.Failure(reason);
        }

        return LanguageModelResult.TransientFailure(reason, isRateLimited ? RetryAfterFrom(response) : null);
    }

    /// <summary>
    /// Reads the wait a rate-limited response's <c>Retry-After</c> header asked for, capped at
    /// <see cref="MaxRetryAfter"/>.
    /// </summary>
    /// <param name="response">The rate-limited response.</param>
    /// <returns>The wait to honor, or <see langword="null"/> when the header is absent, expired, or unparsable.</returns>
    static TimeSpan? RetryAfterFrom(HttpResponseMessage response)
    {
        var retryAfter = response.Headers.RetryAfter;
        var wait = retryAfter?.Delta ?? (retryAfter?.Date - DateTimeOffset.UtcNow);
        if (wait is not { } value || value <= TimeSpan.Zero)
        {
            return null;
        }

        return value > MaxRetryAfter ? MaxRetryAfter : value;
    }
}
