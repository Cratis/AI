// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// Safe classification of a CLI failure without vendor diagnostic text.
/// </summary>
public enum ClaudeCodeFailureKind
{
    /// <summary>
    /// The conversation could not complete.
    /// </summary>
    Conversation,

    /// <summary>
    /// The vendor rejected a request because of a rate limit.
    /// </summary>
    RateLimit,

    /// <summary>
    /// The vendor rejected a model API request.
    /// </summary>
    ModelRequest,
}
