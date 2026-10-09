// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Text.Json;
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
        return Classify(response, $"The language model API returned {(int)response.StatusCode}");
    }

    /// <summary>
    /// Builds a classified failure with bounded, credential-free vendor diagnostics.
    /// </summary>
    /// <param name="response">The failed vendor response.</param>
    /// <param name="vendor">The vendor asked.</param>
    /// <param name="model">The model asked for.</param>
    /// <param name="providerId">The configured provider asked.</param>
    /// <param name="cancellationToken">The caller's cancellation token.</param>
    /// <returns>The failure and its structured diagnostic details.</returns>
    internal static async Task<VendorFailure> FromResponse(HttpResponseMessage response, AIProviderType vendor, string model, AIProviderId providerId, CancellationToken cancellationToken = default)
    {
        var body = await VendorErrorBody.Read(response, cancellationToken);
        var (errorType, errorCode) = ErrorFrom(body);

        // A spent quota is not throttling: retrying the same provider after Retry-After cannot help
        // until the vendor's quota resets, so it is classified apart for a pool to fail over on.
        var quotaExhausted = QuotaExhaustion.IsIndicatedBy((int)response.StatusCode, errorCode, body);
        var classified = quotaExhausted ? LanguageModelResult.QuotaExhausted(string.Empty) : FromStatusCode(response);
        var retryAfter = response.Headers.TryGetValues("Retry-After", out var values)
            ? VendorErrorBody.Redact(string.Join(", ", values))
            : null;
        var reason = $"{vendor} model {model} returned {(int)response.StatusCode}";
        if (errorType is not null)
        {
            reason += $" {errorType}";
        }

        if (errorCode is not null)
        {
            reason += $" ({errorCode})";
        }

        if (quotaExhausted)
        {
            reason += "; quota exhausted";
        }

        reason += $"; provider {providerId}";
        if (retryAfter is not null)
        {
            reason += $"; Retry-After: {retryAfter}";
        }

        reason += $"; vendor body: {body}";
        var result = classified with { FailureReason = reason, Model = model, ProviderId = providerId };

        return new(result, model, body, errorType, errorCode, retryAfter);
    }

    static (string? Type, string? Code) ErrorFrom(string body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            var error = root.ValueKind == JsonValueKind.Object && root.TryGetProperty("error", out var nested) && nested.ValueKind == JsonValueKind.Object
                ? nested
                : root;
            var type = StringFrom(error, "type");
            var code = StringFrom(error, "code");
            if (error.ValueKind == JsonValueKind.Object && error.TryGetProperty("details", out var details))
            {
                code = StringFrom(details, "error_code") ?? code;
            }

            return (type, code);
        }
        catch (JsonException)
        {
            return (null, null);
        }
    }

    static string? StringFrom(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? VendorErrorBody.Redact(value.GetString()!)
            : null;

    static LanguageModelResult Classify(HttpResponseMessage response, string reason)
    {
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
