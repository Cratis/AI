// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// Translates <see cref="Effort"/> into the Claude Code CLI's <c>--effort</c> value - shared by every
/// transport that shells out to the CLI, so the mapping lives in exactly one place.
/// </summary>
internal static class ClaudeCodeEffort
{
    /// <summary>
    /// Maps a reasoning effort tier to the CLI's accepted <c>--effort</c> value.
    /// </summary>
    /// <param name="effort">The requested reasoning effort.</param>
    /// <returns>The CLI argument value.</returns>
    internal static string Arg(Effort effort) => effort switch
    {
        Effort.Low => "low",
        Effort.Medium => "medium",
        Effort.ExtraHigh => "xhigh",
        _ => "high",
    };
}
