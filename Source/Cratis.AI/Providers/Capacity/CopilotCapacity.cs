// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Globalization;
using System.Text.Json;
using Cratis.AI.Providers.Copilot;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// The <see cref="ICanReportAIProviderCapacity"/> for GitHub Copilot - reads the monthly premium
/// request allowance from <c>api.github.com/copilot_internal/user</c>, the surface Copilot's own
/// clients show it from.
/// </summary>
/// <param name="httpClientFactory">Creates the <see cref="HttpClient"/> requests are sent with.</param>
/// <param name="options">The <see cref="AIProviderOptions"/> the read timeout comes from.</param>
public class CopilotCapacity(IHttpClientFactory httpClientFactory, IOptions<AIProviderOptions> options) : ICanReportAIProviderCapacity
{
    /// <summary>
    /// Where GitHub reports a Copilot user's quotas.
    /// </summary>
    public const string UserUrl = "https://api.github.com/copilot_internal/user";

    /// <summary>
    /// The label for Copilot's premium request window.
    /// </summary>
    public const string PremiumRequests = "Monthly premium requests";

    /// <summary>
    /// Reads the premium request allowance out of Copilot's user response -
    /// <c>quota_snapshots.premium_interactions</c> with its <c>percent_remaining</c> and
    /// <c>unlimited</c>, resetting at <c>quota_reset_date</c>.
    /// </summary>
    /// <param name="json">The response body.</param>
    /// <returns>
    /// A subscription report with the monthly window; unmetered when the allowance is unlimited; one
    /// that falls back to the configured ceiling when the response carries no premium quota at all.
    /// </returns>
    /// <exception cref="JsonException">Thrown when the body is not JSON.</exception>
    public static AIProviderCapacityReport Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var premium = CapacityJson.Property(CapacityJson.Property(root, "quota_snapshots"), "premium_interactions");
        if (premium is null)
        {
            return AIProviderCapacityReport.NotApplicable("GitHub Copilot reported no premium request quota");
        }

        if (CapacityJson.Flag(premium, "unlimited") == true)
        {
            return AIProviderCapacityReport.Unmetered();
        }

        if (CapacityJson.Number(premium, "percent_remaining") is not { } percentRemaining)
        {
            return AIProviderCapacityReport.NotApplicable("GitHub Copilot reported no remaining premium requests");
        }

        var resetsAt = CapacityJson.Timestamp(root, "quota_reset_date_utc") ?? ResetDate(CapacityJson.Text(root, "quota_reset_date"));
        return AIProviderCapacityReport.Subscription([new(UsageWindowKind.Monthly, PremiumRequests, 1d - CapacityJson.Fraction(percentRemaining), resetsAt)]);
    }

    /// <inheritdoc/>
    public bool CanReport(ConfiguredAIProvider provider) =>
        provider.Type == AIProviderType.Copilot && CopilotCredential.IsUsable(provider.ApiKey);

    /// <inheritdoc/>
    public async Task<AIProviderCapacityReport> Report(ConfiguredAIProvider provider, CancellationToken cancellationToken)
    {
        var response = await CapacityRequests.Get(
            httpClientFactory,
            UserUrl,
            [new("Authorization", $"token {CopilotCredential.AccessTokenFor(provider.ApiKey)}")],
            options.Value.CapacityReportTimeout,
            cancellationToken);

        return response.Succeeded ? Parse(response.Body) : AIProviderCapacityReport.Unavailable(response.Describe("GitHub Copilot"));
    }

    static DateTimeOffset? ResetDate(string? text) =>
        text is not null && DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var date) ? date : null;
}
