// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using System.Text.Json.Serialization;
using Cratis.AI.Common;

namespace Cratis.AI.Providers.UsageReporting;

/// <summary>
/// The <see cref="ICanReportAIUsage"/> for OpenAI - reads the organization usage and cost reports
/// (<c>/v1/organization/usage/completions</c> and <c>/v1/organization/costs</c>), which require a
/// separate Admin API key from a project/completions key. OpenAI has no separate cache-write metric,
/// so <see cref="AIProviderUsageDay.CacheCreationTokens"/> is always zero for this vendor. Fixed to a
/// trailing 30-day daily window, which fits both endpoints' page limits (31 buckets for usage, 180 for
/// costs) in one request, so no pagination loop is needed. Ported from Direct's
/// <c>AIProviders.UsageReporting.OpenAIUsageReporting</c> (migration-status.md, "Usage reporting").
/// </summary>
/// <param name="httpClientFactory">Creates the <see cref="HttpClient"/> requests are sent with.</param>
/// <param name="timeProvider">The <see cref="TimeProvider"/> the trailing window is measured from.</param>
public class OpenAIUsageReporting(IHttpClientFactory httpClientFactory, TimeProvider timeProvider) : ICanReportAIUsage
{
    static readonly JsonSerializerOptions _serializerOptions = new(JsonSerializerDefaults.Web);

    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.OpenAI;

    /// <inheritdoc/>
    public async Task<AIProviderUsageData> ReportFor(ConfiguredAIProvider provider)
    {
        var startTime = timeProvider.GetUtcNow().AddDays(-30).ToUnixTimeSeconds();
        using var httpClient = httpClientFactory.CreateClient();

        var usage = await ReadUsage(httpClient, provider, startTime);
        var costs = await ReadCosts(httpClient, provider, startTime);
        return new(usage, costs);
    }

    static async Task<IEnumerable<AIProviderUsageDay>> ReadUsage(HttpClient httpClient, ConfiguredAIProvider provider, long startTime)
    {
        var url = $"https://api.openai.com/v1/organization/usage/completions?start_time={startTime}&bucket_width=1d&group_by=model&limit=31";
        var response = await Send(httpClient, provider, url);
        var report = JsonSerializer.Deserialize<UsagePage>(response, _serializerOptions);

        return
        [
            .. (report?.Data ?? [])
                .SelectMany(bucket => bucket.Results.Select(result => new AIProviderUsageDay(
                    ToDate(bucket.StartTime),
                    new ModelName(result.Model),
                    result.InputTokens - result.InputCachedTokens,
                    0,
                    result.InputCachedTokens,
                    result.OutputTokens)))
        ];
    }

    static async Task<IEnumerable<AIProviderCostDay>> ReadCosts(HttpClient httpClient, ConfiguredAIProvider provider, long startTime)
    {
        var url = $"https://api.openai.com/v1/organization/costs?start_time={startTime}&bucket_width=1d&limit=31";
        var response = await Send(httpClient, provider, url);
        var report = JsonSerializer.Deserialize<CostPage>(response, _serializerOptions);

        return
        [
            .. (report?.Data ?? [])
                .Select(bucket => new AIProviderCostDay(
                    ToDate(bucket.StartTime),
                    bucket.Results.Sum(result => result.Amount.Value)))
        ];
    }

    static async Task<string> Send(HttpClient httpClient, ConfiguredAIProvider provider, string url)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {provider.UsageApiKey.Value}");

        using var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStringAsync();
    }

    static DateOnly ToDate(long unixSeconds) => DateOnly.FromDateTime(DateTime.UnixEpoch.AddSeconds(unixSeconds));

    sealed record UsagePage([property: JsonPropertyName("data")] IEnumerable<UsageBucket> Data);

    sealed record UsageBucket(
        [property: JsonPropertyName("start_time")] long StartTime,
        [property: JsonPropertyName("results")] IEnumerable<UsageResult> Results);

    sealed record UsageResult(
        [property: JsonPropertyName("model")] string Model,
        [property: JsonPropertyName("input_tokens")] long InputTokens,
        [property: JsonPropertyName("input_cached_tokens")] long InputCachedTokens,
        [property: JsonPropertyName("output_tokens")] long OutputTokens);

    sealed record CostPage([property: JsonPropertyName("data")] IEnumerable<CostBucket> Data);

    sealed record CostBucket(
        [property: JsonPropertyName("start_time")] long StartTime,
        [property: JsonPropertyName("results")] IEnumerable<CostResult> Results);

    sealed record CostResult([property: JsonPropertyName("amount")] CostAmount Amount);

    sealed record CostAmount([property: JsonPropertyName("value")] decimal Value);
}
