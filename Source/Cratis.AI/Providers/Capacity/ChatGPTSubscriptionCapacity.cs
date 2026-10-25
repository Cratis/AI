// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text;
using System.Text.Json;
using Cratis.AI.Providers.OpenAI;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// The <see cref="ICanReportAIProviderCapacity"/> for a provider authenticated with a ChatGPT
/// subscription (Codex) - reads the primary and secondary rate-limit windows Codex itself shows from
/// <c>chatgpt.com/backend-api/wham/usage</c>.
/// </summary>
/// <remarks>
/// The stored access token is used as it is and never refreshed here: OpenAI rotates the refresh
/// token on every refresh, and a capacity read is not worth spending the subscription's one live
/// lineage on. An expired token simply reads as an unknown capacity until dispatch refreshes it.
/// </remarks>
/// <param name="httpClientFactory">Creates the <see cref="HttpClient"/> requests are sent with.</param>
/// <param name="timeProvider">The <see cref="TimeProvider"/> a relative reset is measured from.</param>
/// <param name="options">The <see cref="AIProviderOptions"/> the read timeout comes from.</param>
public class ChatGPTSubscriptionCapacity(IHttpClientFactory httpClientFactory, TimeProvider timeProvider, IOptions<AIProviderOptions> options) : ICanReportAIProviderCapacity
{
    /// <summary>
    /// Where ChatGPT reports a subscription's usage windows.
    /// </summary>
    public const string UsageUrl = "https://chatgpt.com/backend-api/wham/usage";

    const string AuthClaim = "https://api.openai.com/auth";

    /// <summary>
    /// Reads the usage windows out of ChatGPT's usage response - <c>rate_limit.primary_window</c> and
    /// <c>rate_limit.secondary_window</c>, each a <c>used_percent</c> over a window of
    /// <c>limit_window_seconds</c> resetting at <c>reset_at</c> (Unix seconds) or after
    /// <c>reset_after_seconds</c>.
    /// </summary>
    /// <param name="json">The response body.</param>
    /// <param name="now">The current time, which a relative reset is measured from.</param>
    /// <returns>The windows the response reported - one without a <c>used_percent</c> is left out.</returns>
    /// <exception cref="JsonException">Thrown when the body is not JSON.</exception>
    public static IReadOnlyList<UsageWindow> Parse(string json, DateTimeOffset now)
    {
        using var document = JsonDocument.Parse(json);
        var rateLimit = CapacityJson.Property(document.RootElement, "rate_limit");

        return
        [
            .. new[] { ("primary_window", "Primary"), ("secondary_window", "Secondary") }
                .Select(window => Window(CapacityJson.Property(rateLimit, window.Item1), window.Item2, now))
                .OfType<UsageWindow>()
        ];
    }

    /// <inheritdoc/>
    public bool CanReport(ConfiguredAIProvider provider) =>
        provider.Type is AIProviderType.OpenAICodex or AIProviderType.OpenAI &&
        OpenAISubscriptionCredential.TryParse(provider.ApiKey) is not null;

    /// <inheritdoc/>
    public async Task<AIProviderCapacityReport> Report(ConfiguredAIProvider provider, CancellationToken cancellationToken)
    {
        var credential = OpenAISubscriptionCredential.TryParse(provider.ApiKey)!;
        var headers = new List<KeyValuePair<string, string>> { new("Authorization", $"Bearer {credential.Access}") };
        if ((credential.AccountId ?? AccountIdIn(credential.Access)) is { } accountId)
        {
            headers.Add(new("ChatGPT-Account-Id", accountId));
        }

        var response = await CapacityRequests.Get(httpClientFactory, UsageUrl, headers, options.Value.CapacityReportTimeout, cancellationToken);
        return response.Succeeded
            ? AIProviderCapacityReport.Subscription(Parse(response.Body, timeProvider.GetUtcNow()))
            : AIProviderCapacityReport.Unavailable(response.Describe("ChatGPT"));
    }

    static UsageWindow? Window(JsonElement? window, string fallbackName, DateTimeOffset now)
    {
        if (CapacityJson.Number(window, "used_percent") is not { } usedPercent)
        {
            return null;
        }

        var length = CapacityJson.Number(window, "limit_window_seconds") is { } seconds ? TimeSpan.FromSeconds(seconds) : (TimeSpan?)null;
        var kind = length switch
        {
            null => UsageWindowKind.Other,
            { TotalHours: <= 6 } => UsageWindowKind.FiveHour,
            { TotalHours: >= 20 and <= 28 } => UsageWindowKind.Daily,
            { TotalDays: >= 6 and <= 8 } => UsageWindowKind.Weekly,
            _ => UsageWindowKind.Other
        };
        var name = kind switch
        {
            UsageWindowKind.FiveHour => "5-hour",
            UsageWindowKind.Daily => "Daily",
            UsageWindowKind.Weekly => "Weekly",
            _ => fallbackName
        };

        DateTimeOffset? resetsAt = CapacityJson.Number(window, "reset_at") is { } resetAt
            ? DateTimeOffset.FromUnixTimeSeconds((long)resetAt)
            : CapacityJson.Number(window, "reset_after_seconds") is { } resetAfter ? now.AddSeconds(resetAfter) : null;

        return new(kind, name, CapacityJson.Fraction(usedPercent), resetsAt);
    }

    static string? AccountIdIn(string accessToken)
    {
        // The access token is a JWT whose OpenAI auth claim names the ChatGPT account - read only
        // when the stored record did not carry the account id itself. Never logged.
        var segments = accessToken.Split('.');
        if (segments.Length < 2)
        {
            return null;
        }

        try
        {
            var payload = segments[1].Replace('-', '+').Replace('_', '/');
            payload = payload.PadRight(payload.Length + ((4 - (payload.Length % 4)) % 4), '=');
            using var document = JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(payload)));
            return CapacityJson.Text(CapacityJson.Property(document.RootElement, AuthClaim), "chatgpt_account_id");
        }
        catch (Exception exception) when (exception is FormatException or JsonException or ArgumentException)
        {
            // Not a JWT this can read - the request goes without the header, which the vendor
            // answers with an error the cache records as an unknown capacity.
            return null;
        }
    }
}
