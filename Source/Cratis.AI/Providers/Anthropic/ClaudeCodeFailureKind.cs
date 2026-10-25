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

    /// <summary>
    /// The vendor did not accept the subscription token: it is invalid, expired or revoked (HTTP 401/403).
    /// </summary>
    Authentication,

    /// <summary>
    /// The vendor refused the request because the account has no credit or the plan does not cover the use (HTTP 402).
    /// </summary>
    Billing,

    /// <summary>
    /// The vendor rejected the request itself - typically a model the account cannot use (HTTP 400/404).
    /// </summary>
    InvalidRequest,

    /// <summary>
    /// The vendor failed on its side (HTTP 5xx, overloaded); trying again or another provider may work.
    /// </summary>
    ServerError,
}
