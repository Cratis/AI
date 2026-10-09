// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// Official Claude Code model aliases, deliberately separate from Anthropic's discovered API catalog.
/// </summary>
public static class ClaudeCodeModels
{
    /// <summary>
    /// Maps capability tiers to CLI aliases without pinning a guessed model version.
    /// Powerful and Premier share Opus: Claude Code has no separate fourth capability family.
    /// </summary>
    /// <param name="tier">The requested capability tier.</param>
    /// <returns>The CLI alias, or <see cref="ModelName.NotSet"/> for an unknown tier.</returns>
    public static ModelName For(ModelTier tier) => tier switch
    {
        ModelTier.Fast => new("haiku"),
        ModelTier.Balanced => new("sonnet"),
        ModelTier.Powerful or ModelTier.Premier => new("opus"),
        _ => ModelName.NotSet
    };
}
