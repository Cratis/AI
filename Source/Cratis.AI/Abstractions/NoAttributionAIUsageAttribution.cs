// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;

namespace Cratis.AI.Abstractions;

/// <summary>
/// The default <see cref="IAIUsageAttribution"/> for a consumer that has nothing to fan usage out to.
/// </summary>
public sealed class NoAttributionAIUsageAttribution : IAIUsageAttribution
{
    /// <inheritdoc/>
    public IReadOnlyList<UsageSubject> Resolve(AgentSessionId session) => [];
}
