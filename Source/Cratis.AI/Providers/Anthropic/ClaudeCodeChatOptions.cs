// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// Validates CLI capabilities and normalizes generic factory preferences explicitly.
/// </summary>
internal static class ClaudeCodeChatOptions
{
    /// <summary>
    /// Lists preferences left to the vendor harness.
    /// </summary>
    /// <param name="options">Caller options.</param>
    /// <returns>The omitted option names.</returns>
    internal static IReadOnlyList<string> OmittedControls(ChatOptions? options)
    {
        List<string> omitted = [];
        if (options?.Temperature is not null) omitted.Add(nameof(ChatOptions.Temperature));
        if (options?.MaxOutputTokens is not null) omitted.Add(nameof(ChatOptions.MaxOutputTokens));
        return omitted;
    }

    /// <summary>
    /// Clones generic preferences without claiming unsupported guarantees.
    /// </summary>
    /// <param name="options">Caller options.</param>
    /// <returns>Normalized options.</returns>
    /// <exception cref="ClaudeCodeConversationFailed">A generic preference is invalid.</exception>
    internal static ChatOptions? WithVendorDefaults(ChatOptions? options)
    {
        if (options is null) return null;
        if (options.MaxOutputTokens is <= 0 ||
            (options.Temperature is { } temperature && (!float.IsFinite(temperature) || temperature is < 0 or > 2)))
        {
            throw new ClaudeCodeConversationFailed("Invalid generic sampling or output-limit preference.");
        }

        var normalized = options.Clone();
        normalized.Temperature = null;
        normalized.MaxOutputTokens = null;
        return normalized;
    }

    /// <summary>
    /// Rejects unsupported transport guarantees before any resources are created.
    /// </summary>
    /// <param name="options">Caller options.</param>
    /// <exception cref="ClaudeCodeConversationFailed">The options request unsupported guarantees.</exception>
    internal static void Validate(ChatOptions? options)
    {
        if (options?.ToolMode is not null && options.ToolMode != ChatToolMode.Auto && options.ToolMode != ChatToolMode.None)
        {
            throw new ClaudeCodeConversationFailed("Claude Code does not support required or specific tool selection.");
        }

        if (options?.MaxOutputTokens is not null || options?.Temperature is not null || options?.TopP is not null || options?.TopK is not null ||
            options?.FrequencyPenalty is not null || options?.PresencePenalty is not null || options?.Seed is not null || options?.StopSequences?.Count > 0)
        {
            throw new ClaudeCodeConversationFailed("Claude Code does not support output limits or sampling controls through this chat transport.");
        }

        if ((options?.ToolMode != ChatToolMode.None && options?.Tools?.Any(tool => tool is not AIFunction) == true) ||
            options?.ResponseFormat is ChatResponseFormatJson { Schema: null })
        {
            throw new ClaudeCodeConversationFailed("Claude Code requires function tools and an explicit JSON response schema.");
        }
    }
}
