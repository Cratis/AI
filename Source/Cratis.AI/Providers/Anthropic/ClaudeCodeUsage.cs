// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// Reads the token and cost fields Claude Code's result envelopes carry, whether they arrived through
/// the buffered <c>json</c> output or a streamed <c>stream-json</c> <c>result</c> line - both use the
/// same property names, so the reading is shared rather than duplicated per transport.
/// </summary>
internal static class ClaudeCodeUsage
{
    /// <summary>
    /// Reads a token count property, treating anything missing or not a number as zero rather than failing the whole read.
    /// </summary>
    /// <param name="usage">The <c>usage</c> object.</param>
    /// <param name="property">The property name.</param>
    /// <returns>The token count, or zero when absent.</returns>
    internal static long Tokens(JsonElement usage, string property) =>
        usage.ValueKind == JsonValueKind.Object && usage.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out var tokens) ? tokens : 0;

    /// <summary>
    /// Reads the reported cost in USD, when the envelope carried one.
    /// </summary>
    /// <param name="body">The result envelope.</param>
    /// <returns>The cost, or <see langword="null"/> when the envelope did not report one.</returns>
    internal static decimal? CostUsd(JsonElement body)
    {
        if (body.TryGetProperty("total_cost_usd", out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var cost)) return cost;
        if (!body.TryGetProperty("modelUsage", out var models) || models.ValueKind != JsonValueKind.Object) return null;
        return models.EnumerateObject().Sum(model => model.Value.TryGetProperty("costUSD", out var amount) && amount.TryGetDecimal(out var measured) ? measured : 0);
    }

    /// <summary>
    /// Aggregates model usage without double-counting the envelope's copy.
    /// </summary>
    /// <param name="body">Result envelope.</param>
    /// <returns>Measured usage, when reported.</returns>
    internal static UsageDetails? Read(JsonElement body)
    {
        if (body.TryGetProperty("modelUsage", out var models) && models.ValueKind == JsonValueKind.Object && models.EnumerateObject().Any())
        {
            var entries = models.EnumerateObject().Select(model => model.Value).ToArray();
            if (entries.Any(entry => entry.ValueKind == JsonValueKind.Object && (entry.TryGetProperty("inputTokens", out _) || entry.TryGetProperty("outputTokens", out _))))
            {
                return Usage(entries.Sum(entry => Tokens(entry, "inputTokens")), entries.Sum(entry => Tokens(entry, "outputTokens")), entries.Sum(entry => Tokens(entry, "cacheReadInputTokens")), entries.Sum(entry => Tokens(entry, "cacheCreationInputTokens")));
            }
        }

        return body.TryGetProperty("usage", out var usage) && usage.ValueKind == JsonValueKind.Object
            ? Usage(Tokens(usage, "input_tokens"), Tokens(usage, "output_tokens"), Tokens(usage, "cache_read_input_tokens"), Tokens(usage, "cache_creation_input_tokens"))
            : null;
    }

    static UsageDetails Usage(long input, long output, long cacheRead, long cacheCreation) => new()
    {
        InputTokenCount = input + cacheRead + cacheCreation,
        OutputTokenCount = output,
        TotalTokenCount = input + cacheRead + cacheCreation + output,
        CachedInputTokenCount = cacheRead,
        AdditionalCounts = new AdditionalPropertiesDictionary<long> { ["cache_creation_input_tokens"] = cacheCreation },
    };
}
