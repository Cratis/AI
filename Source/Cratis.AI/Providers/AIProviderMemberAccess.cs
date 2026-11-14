// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// Decides whether a team member may use a configured AI provider - the check a consumer makes
/// before dispatching a unit of work on that member's behalf, and again at every pool member it
/// considers and every retry, so removing access takes effect on the next dispatch, including work
/// already in progress. Pure so the restriction - and its unrestricted default for a provider nobody has
/// ever set a selection for - is directly specifiable.
/// </summary>
public static class AIProviderMemberAccess
{
    /// <summary>Evaluates current access without granting unattributed work a bypass.</summary>
    /// <param name="provider">The current provider access state.</param>
    /// <param name="initiator">The trusted, host-established work initiator.</param>
    /// <returns>The dispatch decision and a reason when denied.</returns>
    public static AIProviderAccessDecision Evaluate(ConfiguredAIProvider provider, WorkInitiator initiator) =>
        IsAllowedFor(provider, initiator.Member ?? TeamMemberId.NotSet)
            ? new(true, string.Empty)
            : new(false, $"AI provider {provider.Id} is not available to the work initiator");

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
        !provider.HasAllowedTeamMembersSelection ||
        (!string.IsNullOrWhiteSpace(member.Value) && provider.AllowedTeamMembers.Contains(member));
}
