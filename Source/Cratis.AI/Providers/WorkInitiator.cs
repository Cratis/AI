// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>The person who started work, distinct from the agent carrying it out.</summary>
/// <param name="Member">The authenticated member, or no member for unattributed work.</param>
public record WorkInitiator(TeamMemberId? Member)
{
    /// <summary>Work without a known human initiator. Does not bypass provider restrictions.</summary>
    public static readonly WorkInitiator None = new((TeamMemberId?)null);

    /// <summary>Attributes work to the authenticated member resolved by the host.</summary>
    /// <param name="member">The host's canonical member identity.</param>
    /// <returns>The initiator to carry unchanged through the work.</returns>
    public static WorkInitiator By(TeamMemberId member) => new(member);
}
