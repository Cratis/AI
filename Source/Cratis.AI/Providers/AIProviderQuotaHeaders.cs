// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Globalization;
using System.Text.RegularExpressions;
using Cratis.AI.Providers.Pools;

namespace Cratis.AI.Providers;

/// <summary>
/// Reads a vendor's own rate-limit response headers into an <see cref="AIProviderQuotaStatus"/> -
/// shared by every <see cref="IAIProviderClient"/> so the "which headers, in which shape, mean what"
/// decision exists in exactly one place per vendor rather than once per client (Cratis/AI#337, the
/// same reasoning <see cref="TransientProviderFailures"/> already centralizes for status-code
/// classification). A vendor that sends none of its expected headers, or a value that does not
/// parse, yields <see langword="null"/> rather than a partially-populated guess - "nothing known" is
/// a safe default a pool dispatcher can treat as "not exhausted"; a wrong guess is not.
/// </summary>
public static partial class AIProviderQuotaHeaders
{
    /// <summary>
    /// Reads the quota status from a response, in the shape the given vendor is known to send.
    /// </summary>
    /// <param name="type">The vendor the response came from.</param>
    /// <param name="response">The response to read headers from.</param>
    /// <returns>The <see cref="AIProviderQuotaStatus"/>, or <see langword="null"/> when the vendor reported nothing this can read.</returns>
    public static AIProviderQuotaStatus? Read(AIProviderType type, HttpResponseMessage response) => type switch
    {
        AIProviderType.Anthropic or AIProviderType.ZAI => FromAnthropicHeaders(response),
        AIProviderType.OpenAI or AIProviderType.AzureOpenAI or AIProviderType.OpenAICompatible => FromOpenAIHeaders(response),
        _ => null,
    };

    /// <summary>
    /// Anthropic sends rate-limit headers on every response, not only a 429 - <c>anthropic-ratelimit-requests-remaining</c>,
    /// separate <c>anthropic-ratelimit-input-tokens-remaining</c>/<c>-output-tokens-remaining</c> (the
    /// lower of the two becomes <see cref="AIProviderQuotaStatus.RemainingTokens"/> - a call fails the
    /// moment either runs out), and <c>anthropic-ratelimit-requests-reset</c> as an ISO 8601 timestamp.
    /// Z.ai's Anthropic-compatible gateway is read with the same shape, on the same reasoning
    /// <see cref="Cratis.AI.Providers.ZAI.ZAIProviderClient"/> already reuses the Anthropic payload
    /// builder for - worth revisiting if Z.ai's actual headers ever prove to differ.
    /// </summary>
    /// <param name="response">The response to read headers from.</param>
    /// <returns>The <see cref="AIProviderQuotaStatus"/>, or <see langword="null"/> when none of the expected headers were present.</returns>
    static AIProviderQuotaStatus? FromAnthropicHeaders(HttpResponseMessage response)
    {
        var requests = LongHeader(response, "anthropic-ratelimit-requests-remaining");
        var inputTokens = LongHeader(response, "anthropic-ratelimit-input-tokens-remaining");
        var outputTokens = LongHeader(response, "anthropic-ratelimit-output-tokens-remaining");
        var resetsAt = DateHeader(response, "anthropic-ratelimit-requests-reset");

        long? tokens = (inputTokens, outputTokens) switch
        {
            ({ } i, { } o) => Math.Min(i, o),
            ({ } i, null) => i,
            (null, { } o) => o,
            _ => null,
        };

        return requests is null && tokens is null && resetsAt is null
            ? null
            : new AIProviderQuotaStatus(requests, tokens, resetsAt);
    }

    /// <summary>
    /// OpenAI (and Azure OpenAI, and the OpenAI-compatible gateways that bother to send them) report
    /// <c>x-ratelimit-remaining-requests</c>/<c>x-ratelimit-remaining-tokens</c>, and reset windows as
    /// a compact duration string (<c>"1s"</c>, <c>"6m0s"</c>, <c>"2h30m3s"</c>) rather than a
    /// timestamp - <see cref="ParseDuration"/> reads it and this adds it to "now" itself. The tighter
    /// (sooner) of the requests/tokens reset windows is kept, since either one resetting is what lets
    /// the next call through.
    /// </summary>
    /// <param name="response">The response to read headers from.</param>
    /// <returns>The <see cref="AIProviderQuotaStatus"/>, or <see langword="null"/> when none of the expected headers were present.</returns>
    static AIProviderQuotaStatus? FromOpenAIHeaders(HttpResponseMessage response)
    {
        var requests = LongHeader(response, "x-ratelimit-remaining-requests");
        var tokens = LongHeader(response, "x-ratelimit-remaining-tokens");
        var requestsReset = DurationHeader(response, "x-ratelimit-reset-requests");
        var tokensReset = DurationHeader(response, "x-ratelimit-reset-tokens");

        DateTimeOffset? resetsAt = (requestsReset, tokensReset) switch
        {
            ({ } r, { } t) => DateTimeOffset.UtcNow + (r < t ? r : t),
            ({ } r, null) => DateTimeOffset.UtcNow + r,
            (null, { } t) => DateTimeOffset.UtcNow + t,
            _ => null,
        };

        return requests is null && tokens is null && resetsAt is null
            ? null
            : new AIProviderQuotaStatus(requests, tokens, resetsAt);
    }

    /// <summary>
    /// Parses OpenAI's compact duration format - a sequence of <c>&lt;number&gt;&lt;unit&gt;</c>
    /// segments (<c>h</c>/<c>m</c>/<c>s</c>/<c>ms</c>), e.g. <c>"1s"</c>, <c>"6m0s"</c>,
    /// <c>"2h30m3s"</c>. Not <see cref="TimeSpan"/>'s own format, and not documented anywhere
    /// authoritative enough to cite - reverse-engineered from observed header values, so this stays
    /// deliberately forgiving: an unparsable or empty value yields <see langword="null"/> ("unknown
    /// reset time") rather than throwing, since the reset time is the least critical of the three
    /// figures a pool dispatch reads.
    /// </summary>
    /// <param name="value">The duration string.</param>
    /// <returns>The parsed <see cref="TimeSpan"/>, or <see langword="null"/> when it could not be parsed.</returns>
    internal static TimeSpan? ParseDuration(string value)
    {
        var matches = DurationSegment().Matches(value);
        if (matches.Count == 0)
        {
            return null;
        }

        var total = TimeSpan.Zero;
        foreach (Match match in matches)
        {
            if (!double.TryParse(match.Groups["amount"].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var amount))
            {
                return null;
            }

            total += match.Groups["unit"].Value switch
            {
                "ms" => TimeSpan.FromMilliseconds(amount),
                "s" => TimeSpan.FromSeconds(amount),
                "m" => TimeSpan.FromMinutes(amount),
                "h" => TimeSpan.FromHours(amount),
                _ => TimeSpan.Zero,
            };
        }

        return total;
    }

    static long? LongHeader(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values) &&
        long.TryParse(values.FirstOrDefault(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
            ? value
            : null;

    static DateTimeOffset? DateHeader(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values) &&
        DateTimeOffset.TryParse(values.FirstOrDefault(), CultureInfo.InvariantCulture, DateTimeStyles.None, out var value)
            ? value
            : null;

    static TimeSpan? DurationHeader(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values) && values.FirstOrDefault() is { } value
            ? ParseDuration(value)
            : null;

    [GeneratedRegex(@"(?<amount>\d+(\.\d+)?)(?<unit>ms|s|m|h)", RegexOptions.None, matchTimeoutMilliseconds: 100)]
    private static partial Regex DurationSegment();
}
