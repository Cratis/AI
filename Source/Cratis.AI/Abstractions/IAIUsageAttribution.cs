// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;

namespace Cratis.AI.Abstractions;

/// <summary>
/// What the usage of one agent session is attributed to, from the consumer's point of view - opaque
/// to the package. Direct resolves a session to the issue(s) it covered; Studio might resolve one to
/// a project. The package appends <c>AgentSessionUsageRecorded</c> on the session stream regardless;
/// this is what lets a consumer additionally fan usage out into its own domain (plan Section 5.3b).
/// </summary>
public interface IAIUsageAttribution
{
    /// <summary>
    /// Resolves what a session's usage should be attributed to.
    /// </summary>
    /// <param name="session">The <see cref="AgentSessionId"/> of the session.</param>
    /// <returns>The <see cref="UsageSubject"/>s the session's usage is attributed to. Empty when the consumer has none.</returns>
    IReadOnlyList<UsageSubject> Resolve(AgentSessionId session);
}
