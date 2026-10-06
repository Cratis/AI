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
/// <para>
/// The endpoint is undocumented and answers 429 readily, which is why every read goes through
/// <see cref="IAIProviderCapacities"/>' cache and back-off rather than being asked per dispatch.
/// </para>
/// <para>
/// It also needs the <c>user:profile</c> scope, which a long-lived token from <c>claude setup-token</c> - the kind a
/// server holds - does not have: it answers 403. Such a token is read instead through the
/// <c>anthropic-ratelimit-unified-*</c> headers Anthropic sends on every Messages response to a subscription
/// request, by sending the smallest request there is - one token from the fast model.
/// </para>
/// </remarks>
/// <param name="httpClientFactory">Creates the <see cref="HttpClient"/> requests are sent with.</param>
/// <param name="options">The <see cref="AIProviderOptions"/> the read timeout comes from.</param>
public class ClaudeSubscriptionCapacity(IHttpClientFactory httpClientFactory, IOptions<AIProviderOptions> options) : ICanReportAIProviderCapacity
{
    /// <summary>
    /// Where Claude reports a subscription's usage windows.
    /// </summary>
    public const string UsageUrl = "https://api.anthropic.com/api/oauth/usage";

    /// <summary>
    /// Where the header probe is sent when the usage endpoint refuses the token.
    /// </summary>
    public const string MessagesUrl = "https://api.anthropic.com/v1/messages";

    /// <summary>
    /// The model the header probe asks for a single token from - the cheapest a subscription serves.
    /// </summary>
    public const string ProbeModel = "claude-haiku-4-5";

    const string BetaHeader = "oauth-2025-04-20";

    static readonly (string Window, UsageWindowKind Kind, string Name)[] _headerWindows =
    [
        ("5h", UsageWindowKind.FiveHour, "5-hour"),
        ("7d", UsageWindowKind.Weekly, "Weekly"),
        ("7d_opus", UsageWindowKind.Weekly, "Weekly (Opus)"),
        ("7d_sonnet", UsageWindowKind.Weekly, "Weekly (Sonnet)"),
    ];

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

    /// <summary>
    /// Reads the usage windows out of the <c>anthropic-ratelimit-unified-*</c> headers of a Messages response, where
    /// utilization is a fraction from 0 to 1 and a reset is in Unix seconds.
    /// </summary>
    /// <param name="headers">The response headers, by name.</param>
    /// <returns>The windows the headers stated - a window without a utilization is left out.</returns>
    public static IReadOnlyList<UsageWindow> ParseHeaders(IReadOnlyDictionary<string, string> headers)
    {
        var lookup = new Dictionary<string, string>(headers, StringComparer.OrdinalIgnoreCase);
        var windows = new List<UsageWindow>();
        foreach (var (window, kind, name) in _headerWindows)
        {
            if (!lookup.TryGetValue($"anthropic-ratelimit-unified-{window}-utilization", out var utilization) ||
                !double.TryParse(utilization, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var used))
            {
                continue;
            }

            DateTimeOffset? resetsAt = lookup.TryGetValue($"anthropic-ratelimit-unified-{window}-reset", out var reset) &&
                long.TryParse(reset, System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out var seconds)
                ? DateTimeOffset.FromUnixTimeSeconds(seconds)
                : null;
            windows.Add(new UsageWindow(kind, name, Math.Clamp(used, 0d, 1d), resetsAt));
        }

        return windows;
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

        if (response.Succeeded)
        {
            return AIProviderCapacityReport.Subscription(Parse(response.Body));
        }

        return response.Status == System.Net.HttpStatusCode.Forbidden
            ? await ReportFromHeaders(token, cancellationToken)
            : AIProviderCapacityReport.Unavailable(response.Describe("Claude"));
    }

    async Task<AIProviderCapacityReport> ReportFromHeaders(string token, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, MessagesUrl)
        {
            Content = new StringContent(
                $$"""{"model":"{{ProbeModel}}","max_tokens":1,"messages":[{"role":"user","content":"."}]}""",
                System.Text.Encoding.UTF8,
                "application/json"),
        };
        request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {token}");
        request.Headers.TryAddWithoutValidation("anthropic-beta", BetaHeader);
        request.Headers.TryAddWithoutValidation("anthropic-version", "2023-06-01");

        // A subscription over its limit answers the probe 429 - with the same headers, which is exactly when they
        // matter most - so the windows are read whatever the status.
        var (status, _, headers) = await CapacityRequests.Send(httpClientFactory, request, options.Value.CapacityReportTimeout, cancellationToken);
        var windows = ParseHeaders(headers);
        return windows.Count > 0
            ? AIProviderCapacityReport.Subscription(windows)
            : AIProviderCapacityReport.Unavailable($"Claude refused the usage read for this token, and its Messages answer ({(int)status} {status}) stated no usage windows");
    }
}
