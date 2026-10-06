// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.AI.Providers.Anthropic;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// The <see cref="ICanReportAIProviderCapacity"/> for an Anthropic provider authenticated with a
/// Claude subscription's OAuth token - reads the five-hour and weekly windows Claude Code itself shows
/// from <c>api.anthropic.com/api/oauth/usage</c>.
/// </summary>
/// <remarks>
/// The endpoint is undocumented and answers 429 readily, which is why every read goes through
/// <see cref="IAIProviderCapacities"/>' cache and back-off rather than being asked per dispatch.
/// </remarks>
/// <param name="httpClientFactory">Creates the <see cref="HttpClient"/> requests are sent with.</param>
/// <param name="options">The <see cref="AIProviderOptions"/> the read timeout comes from.</param>
public class ClaudeSubscriptionCapacity(IHttpClientFactory httpClientFactory, IOptions<AIProviderOptions> options) : ICanReportAIProviderCapacity
{
    /// <summary>
    /// Where Claude reports a subscription's usage windows.
    /// </summary>
    public const string UsageUrl = "https://api.anthropic.com/api/oauth/usage";

    static readonly (string Property, UsageWindowKind Kind, string Name)[] _windows =
    [
        ("five_hour", UsageWindowKind.FiveHour, "5-hour"),
        ("seven_day", UsageWindowKind.Weekly, "Weekly"),
        ("seven_day_opus", UsageWindowKind.Weekly, "Weekly (Opus)"),
        ("seven_day_sonnet", UsageWindowKind.Weekly, "Weekly (Sonnet)"),
    ];

    /// <summary>
    /// Reads the usage windows out of Claude's usage response, where <c>utilization</c> is a percentage.
    /// </summary>
    /// <param name="json">The response body.</param>
    /// <returns>The windows the response reported - a window it sent as null, or without a utilization, is left out.</returns>
    /// <exception cref="JsonException">Thrown when the body is not JSON.</exception>
    public static IReadOnlyList<UsageWindow> Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        return
        [
            .. _windows
                .Select(window => (window.Kind, window.Name, Element: CapacityJson.Property(root, window.Property)))
                .Select(window => (window.Kind, window.Name, window.Element, Utilization: CapacityJson.Number(window.Element, "utilization")))
                .Where(window => window.Utilization is not null)
                .Select(window => new UsageWindow(window.Kind, window.Name, CapacityJson.Fraction(window.Utilization!.Value), CapacityJson.Timestamp(window.Element, "resets_at")))
        ];
    }

    /// <inheritdoc/>
    public bool CanReport(ConfiguredAIProvider provider) =>
        provider.Type == AIProviderType.Anthropic && AnthropicCredential.IsOAuthToken(provider.ApiKey);

    /// <inheritdoc/>
    public async Task<AIProviderCapacityReport> Report(ConfiguredAIProvider provider, CancellationToken cancellationToken)
    {
        var token = AnthropicCredential.Normalize(provider.ApiKey).Value;
        var response = await CapacityRequests.Get(
            httpClientFactory,
            UsageUrl,
            [new("Authorization", $"Bearer {token}"), new("anthropic-beta", "oauth-2025-04-20")],
            options.Value.CapacityReportTimeout,
            cancellationToken);

        return response.Succeeded
            ? AIProviderCapacityReport.Subscription(Parse(response.Body))
            : AIProviderCapacityReport.Unavailable(response.Describe("Claude"));
    }
}
