// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Cratis.AI.Common;

namespace Cratis.AI.Providers.UsageReporting;

/// <summary>
/// The <see cref="ICanReportAIUsage"/> for Anthropic - reads the Console's organization usage and cost
/// reports (<c>/v1/organizations/usage_report/messages</c> and <c>/v1/organizations/cost_report</c>),
/// which require a separate Admin API key from the Messages API key completions use. Fixed to a
/// trailing 30-day daily window, which fits Anthropic's 31-bucket <c>1d</c> page limit in one request,
/// so no pagination loop is needed. Ported from Direct's
/// <c>AIProviders.UsageReporting.AnthropicUsageReporting</c> (migration-status.md, "Usage reporting").
/// </summary>
/// <param name="httpClientFactory">Creates the <see cref="HttpClient"/> requests are sent with.</param>
/// <param name="timeProvider">The <see cref="TimeProvider"/> the trailing window is measured from.</param>
public class AnthropicUsageReporting(IHttpClientFactory httpClientFactory, TimeProvider timeProvider) : ICanReportAIUsage
{
    const string ApiVersion = "2023-06-01";

    static readonly JsonSerializerOptions _serializerOptions = new(JsonSerializerDefaults.Web);

    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.Anthropic;

    /// <inheritdoc/>
    public async Task<AIProviderUsageData> ReportFor(ConfiguredAIProvider provider)
    {
        var startingAt = timeProvider.GetUtcNow().AddDays(-30).ToString("yyyy-MM-ddT00:00:00Z", CultureInfo.InvariantCulture);
        using var httpClient = httpClientFactory.CreateClient();

        var usage = await ReadUsage(httpClient, provider, startingAt);
        var costs = await ReadCosts(httpClient, provider, startingAt);
        return new(usage, costs);
    }

    static async Task<IEnumerable<AIProviderUsageDay>> ReadUsage(HttpClient httpClient, ConfiguredAIProvider provider, string startingAt)
    {
        var url = $"https://api.anthropic.com/v1/organizations/usage_report/messages?starting_at={startingAt}&group_by[]=model&bucket_width=1d&limit=31";
        var response = await Send(httpClient, provider, url);
        var report = JsonSerializer.Deserialize<UsageReportResponse>(response, _serializerOptions);

        return
        [
            .. (report?.Data ?? [])
                .SelectMany(bucket => bucket.Results.Select(result => new AIProviderUsageDay(
                    DateOnly.FromDateTime(bucket.StartingAt),
                    new ModelName(result.Model),
                    result.UncachedInputTokens,
                    (result.CacheCreation?.Ephemeral5MInputTokens ?? 0) + (result.CacheCreation?.Ephemeral1HInputTokens ?? 0),
                    result.CacheReadInputTokens,
                    result.OutputTokens)))
        ];
    }

    static async Task<IEnumerable<AIProviderCostDay>> ReadCosts(HttpClient httpClient, ConfiguredAIProvider provider, string startingAt)
    {
        var url = $"https://api.anthropic.com/v1/organizations/cost_report?starting_at={startingAt}&bucket_width=1d&limit=31";
        var response = await Send(httpClient, provider, url);
        var report = JsonSerializer.Deserialize<CostReportResponse>(response, _serializerOptions);

        return
        [
            .. (report?.Data ?? [])
                .Select(bucket => new AIProviderCostDay(
                    DateOnly.FromDateTime(bucket.StartingAt),
                    bucket.Results.Sum(result => decimal.Parse(result.Amount, CultureInfo.InvariantCulture) / 100m)))
        ];
    }

    static async Task<string> Send(HttpClient httpClient, ConfiguredAIProvider provider, string url)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.TryAddWithoutValidation("x-api-key", provider.UsageApiKey.Value);
        request.Headers.TryAddWithoutValidation("anthropic-version", ApiVersion);

        using var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStringAsync();
    }

    sealed record UsageReportResponse([property: JsonPropertyName("data")] IEnumerable<UsageBucket> Data);

    sealed record UsageBucket(
        [property: JsonPropertyName("starting_at")] DateTime StartingAt,
        [property: JsonPropertyName("results")] IEnumerable<UsageResult> Results);

    sealed record UsageResult(
        [property: JsonPropertyName("model")] string Model,
        [property: JsonPropertyName("uncached_input_tokens")] long UncachedInputTokens,
        [property: JsonPropertyName("cache_creation")] CacheCreation? CacheCreation,
        [property: JsonPropertyName("cache_read_input_tokens")] long CacheReadInputTokens,
        [property: JsonPropertyName("output_tokens")] long OutputTokens);

    sealed record CacheCreation(
        [property: JsonPropertyName("ephemeral_5m_input_tokens")] long Ephemeral5MInputTokens,
        [property: JsonPropertyName("ephemeral_1h_input_tokens")] long Ephemeral1HInputTokens);

    sealed record CostReportResponse([property: JsonPropertyName("data")] IEnumerable<CostBucket> Data);

    sealed record CostBucket(
        [property: JsonPropertyName("starting_at")] DateTime StartingAt,
        [property: JsonPropertyName("results")] IEnumerable<CostResult> Results);

    sealed record CostResult([property: JsonPropertyName("amount")] string Amount);
}
