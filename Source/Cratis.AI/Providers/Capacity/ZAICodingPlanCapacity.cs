// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// The <see cref="ICanReportAIProviderCapacity"/> for a Z.AI provider on a coding plan - reads the
/// plan's five-hour and weekly token windows from <c>/api/monitor/usage/quota/limit</c>. A key that
/// is not on a coding plan is judged by its configured ceiling instead.
/// </summary>
/// <param name="httpClientFactory">Creates the <see cref="HttpClient"/> requests are sent with.</param>
/// <param name="options">The <see cref="AIProviderOptions"/> the read timeout comes from.</param>
public class ZAICodingPlanCapacity(IHttpClientFactory httpClientFactory, IOptions<AIProviderOptions> options) : ICanReportAIProviderCapacity
{
    /// <summary>
    /// Where Z.AI is reached when the provider names no endpoint of its own.
    /// </summary>
    public const string DefaultBase = "https://api.z.ai";

    /// <summary>
    /// The path a coding plan's quota is read from, relative to the endpoint's origin.
    /// </summary>
    public const string QuotaPath = "/api/monitor/usage/quota/limit";

    static readonly string[] _limitTypes = ["TOKENS_LIMIT", "CREDIT_LIMIT"];

    /// <summary>
    /// Gets the origin the quota is read from - the configured endpoint's scheme and host, since the
    /// endpoint a provider completes against is a path on it (<c>https://api.z.ai/api/anthropic</c>).
    /// </summary>
    /// <param name="endpoint">The provider's configured endpoint.</param>
    /// <returns>The origin, without a trailing slash.</returns>
    public static string BaseFor(AIProviderEndpoint endpoint) =>
        !string.IsNullOrWhiteSpace(endpoint.Value) && Uri.TryCreate(endpoint.Value, UriKind.Absolute, out var uri)
            ? uri.GetLeftPart(UriPartial.Authority)
            : DefaultBase;

    /// <summary>
    /// Reads the plan's windows out of Z.AI's quota response - <c>data.limits[]</c> rows of type
    /// <c>TOKENS_LIMIT</c> or <c>CREDIT_LIMIT</c>, each with a <c>percentage</c> used over a window of
    /// <c>number</c> <c>unit</c>s (unit 3 is hours, unit 6 is weeks) resetting at
    /// <c>nextResetTime</c> (Unix milliseconds).
    /// </summary>
    /// <param name="json">The response body.</param>
    /// <returns>The windows, or <see langword="null"/> when the response is not a coding plan's quota.</returns>
    /// <exception cref="JsonException">Thrown when the body is not JSON.</exception>
    public static IReadOnlyList<UsageWindow>? Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        if (CapacityJson.Flag(root, "success") == false ||
            CapacityJson.Property(CapacityJson.Property(root, "data"), "limits") is not { ValueKind: JsonValueKind.Array } limits)
        {
            return null;
        }

        var windows = limits.EnumerateArray()
            .Where(limit => _limitTypes.Contains(CapacityJson.Text(limit, "type"), StringComparer.OrdinalIgnoreCase))
            .Select(Window)
            .OfType<UsageWindow>()
            .ToList();

        return windows.Count == 0 ? null : windows;
    }

    /// <inheritdoc/>
    public bool CanReport(ConfiguredAIProvider provider) =>
        provider.Type == AIProviderType.ZAI && !string.IsNullOrWhiteSpace(provider.ApiKey.Value);

    /// <inheritdoc/>
    public async Task<AIProviderCapacityReport> Report(ConfiguredAIProvider provider, CancellationToken cancellationToken)
    {
        var response = await CapacityRequests.Get(
            httpClientFactory,
            $"{BaseFor(provider.Endpoint)}{QuotaPath}",
            [new("Authorization", $"Bearer {provider.ApiKey.ForUse().Trim()}")],
            options.Value.CapacityReportTimeout,
            cancellationToken);

        if (response.Status is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden or HttpStatusCode.NotFound)
        {
            return AIProviderCapacityReport.NotApplicable("The Z.AI key reports no coding plan quota");
        }

        if (!response.Succeeded)
        {
            return AIProviderCapacityReport.Unavailable(response.Describe("Z.AI"));
        }

        return Parse(response.Body) is { } windows
            ? AIProviderCapacityReport.Subscription(windows)
            : AIProviderCapacityReport.NotApplicable("The Z.AI key reports no coding plan quota");
    }

    static UsageWindow? Window(JsonElement limit)
    {
        if (CapacityJson.Number(limit, "percentage") is not { } percentage)
        {
            return null;
        }

        var (kind, name) = (CapacityJson.Number(limit, "unit"), CapacityJson.Number(limit, "number")) switch
        {
            (3, 5) => (UsageWindowKind.FiveHour, "5-hour"),
            (6, 1) => (UsageWindowKind.Weekly, "Weekly"),
            _ => (UsageWindowKind.Other, string.Equals(CapacityJson.Text(limit, "type"), "CREDIT_LIMIT", StringComparison.OrdinalIgnoreCase) ? "Credits" : "Tokens")
        };

        DateTimeOffset? resetsAt = CapacityJson.Number(limit, "nextResetTime") is { } milliseconds ? DateTimeOffset.FromUnixTimeMilliseconds((long)milliseconds) : null;
        return new(kind, name, CapacityJson.Fraction(percentage), resetsAt);
    }
}
