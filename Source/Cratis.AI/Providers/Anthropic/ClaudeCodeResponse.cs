// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Usage;

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// Reads a Claude Code result without treating a zero exit, partial answer or missing verdict as success.
/// </summary>
internal static class ClaudeCodeResponse
{
    /// <summary>
    /// Reads the result and includes cached input in the measured input-token count.
    /// </summary>
    /// <param name="output">The child outcome.</param>
    /// <param name="model">The configured model.</param>
    /// <returns>The completed answer or a truthful failure.</returns>
    internal static LanguageModelResult Read(ClaudeCodeOutput output, ModelName model)
    {
        try
        {
            using var document = JsonDocument.Parse(output.StandardOutput);
            var body = document.RootElement;
            if (body.ValueKind != JsonValueKind.Object)
            {
                return LanguageModelResult.Failure("Claude Code returned no result envelope");
            }

            if (body.TryGetProperty("api_error_status", out var status) && status.ValueKind == JsonValueKind.Number)
            {
                var code = status.GetInt32();
                if (code == 429 || code >= 500)
                {
                    return LanguageModelResult.TransientFailure($"Claude Code's model request returned HTTP {code}");
                }
            }

            if (output.ExitCode != 0 || !body.TryGetProperty("is_error", out var error) || error.ValueKind != JsonValueKind.False ||
                !body.TryGetProperty("subtype", out var subtype) || subtype.ValueKind != JsonValueKind.String || subtype.GetString() != "success" ||
                !body.TryGetProperty("result", out var result) || result.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(result.GetString()))
            {
                return LanguageModelResult.Failure($"Claude Code did not complete the analysis (exit {output.ExitCode}). Check the configured subscription and model.");
            }

            // Cache creation is fresh work, not a cache hit. LanguageModelUsage separates reads
            // from fresh input, whereas UsageDetails includes all input in its input-token total.
            var measured = ClaudeCodeUsage.Read(body);
            LanguageModelUsage? usage = measured is not null
                ? new(
                    new InputTokens((measured.InputTokenCount ?? 0) - (measured.CachedInputTokenCount ?? 0)),
                    new OutputTokens(measured.OutputTokenCount ?? 0),
                    new CachedTokens(measured.CachedInputTokenCount ?? 0),
                    ClaudeCodeUsage.CostUsd(body) is { } cost ? new CostUsd(cost) : null)
                : null;

            return LanguageModelResult.Success(result.GetString()!, usage, model);
        }
        catch (JsonException)
        {
            return LanguageModelResult.Failure("Claude Code returned an unreadable result");
        }
    }
}
