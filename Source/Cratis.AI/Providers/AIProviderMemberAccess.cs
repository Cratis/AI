// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// Decides whether a team member may use a configured AI provider - the check a consumer makes
/// before dispatching a unit of work on that member's behalf, and again at every pool member it
/// considers and every retry, so a person's access does not change partway through something they
/// already started. Pure so the restriction - and its unrestricted default for a provider nobody has
/// ever set a selection for - is directly specifiable.
/// </summary>
public static class AIProviderMemberAccess
{
    /// <summary>
    /// Whether the given team member may use the provider.
    /// </summary>
    /// <param name="provider">The configured provider.</param>
    /// <param name="member">The team member asking to use it.</param>
    /// <returns>
    /// <see langword="true"/> when the provider has no explicit selection
    /// (<see cref="ConfiguredAIProvider.HasAllowedTeamMembersSelection"/> is <see langword="false"/>), or the
    /// member is one of the provider's <see cref="ConfiguredAIProvider.AllowedTeamMembers"/>.
    /// </returns>
    public static bool IsAllowedFor(ConfiguredAIProvider provider, TeamMemberId member) =>
        !provider.HasAllowedTeamMembersSelection || provider.AllowedTeamMembers.Contains(member);
}
