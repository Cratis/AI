// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools;

/// <summary>
/// What a vendor's own rate-limit headers most recently said about a provider's remaining headroom -
/// known ahead of the next call, rather than learned by getting a 429 back. See
/// <see cref="AIProviderQuotaHeaders"/> for where this is read from, and <see cref="IAIProviderQuotaTracker"/>
/// for where it is kept (Cratis/AI#337).
/// </summary>
/// <param name="RemainingRequests">Requests left in the current window, when the vendor reports one.</param>
/// <param name="RemainingTokens">Tokens left in the current window, when the vendor reports one - the
/// lower of input/output remaining, for a vendor (Anthropic) that reports the two separately: the
/// call fails the moment either one runs out, so the tighter figure is the one worth knowing.</param>
/// <param name="ResetsAt">When the window resets, when the vendor reports one.</param>
public record AIProviderQuotaStatus(long? RemainingRequests, long? RemainingTokens, DateTimeOffset? ResetsAt)
{
    /// <summary>
    /// Whether this status means the provider is known, right now, to have nothing left to spend.
    /// </summary>
    /// <param name="timeProvider">The <see cref="TimeProvider"/> to judge "right now" against.</param>
    /// <returns>
    /// <see langword="true"/> when either figure the vendor reported was zero and the window it
    /// reported has not yet reset (or the vendor did not say when it resets, in which case the zero
    /// reading is trusted outright); <see langword="false"/> otherwise - including once
    /// <see cref="ResetsAt"/> has passed, since the window has to be treated as fresh again even
    /// though nothing has confirmed that yet.
    /// </returns>
    public bool IsExhausted(TimeProvider timeProvider)
    {
        var reportedEmpty = RemainingRequests == 0 || RemainingTokens == 0;
        if (!reportedEmpty)
        {
            return false;
        }

        return ResetsAt is not { } resetsAt || resetsAt > timeProvider.GetUtcNow();
    }
}
