// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// Decides whether a team member may use a configured AI provider. Pure so the restriction - and its
/// unrestricted default for a provider nobody has ever set a selection for - is directly specifiable.
/// </summary>
public static class AIProviderMemberAccess
{
    /// <summary>
    /// Whether the given team member may use the provider.
    /// </summary>
    /// <param name="provider">The configured provider.</param>
    /// <param name="member">The team member asking to use it.</param>
    /// <returns>
    /// <see langword="true"/> when the provider has no explicit member selection
    /// (<see cref="ConfiguredAIProvider.HasAllowedMembersSelection"/> is <see langword="false"/>), or the
    /// member is one of the provider's <see cref="ConfiguredAIProvider.AllowedMembers"/>.
    /// </returns>
    public static bool IsAllowedFor(ConfiguredAIProvider provider, TeamMemberId member) =>
        !provider.HasAllowedMembersSelection || provider.AllowedMembers.Contains(member);
}
