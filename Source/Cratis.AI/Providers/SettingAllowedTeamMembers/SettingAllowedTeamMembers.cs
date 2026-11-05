// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingAllowedTeamMembers;

/// <summary>
/// Replaces the team members allowed to use a particular provider. No selection at all - the
/// package's default - leaves the provider open to everyone, matching its behavior before this
/// restriction existed; an explicit empty collection instead denies every team member.
/// </summary>
/// <param name="Provider">The provider whose allowed team members are being set.</param>
/// <param name="AllowedTeamMembers">The complete set of team members allowed to use the provider.</param>
[Command]
public record SetAIProviderAllowedTeamMembers(AIProviderId Provider, IReadOnlyList<TeamMemberId> AllowedTeamMembers)
{
    /// <summary>
    /// Records the complete selection on the provider's event stream.
    /// </summary>
    /// <returns>The selected team members.</returns>
    public AIProviderAllowedTeamMembersSet Handle() => new(AllowedTeamMembers.ToArray());
}

/// <summary>
/// Validates the selection's own shape - this package has no directory of team members to check
/// membership against, so it can only reject what the selection itself cannot mean.
/// </summary>
public class SetAIProviderAllowedTeamMembersValidator : CommandValidator<SetAIProviderAllowedTeamMembers>
{
    /// <summary>
    /// Initializes the validator.
    /// </summary>
    public SetAIProviderAllowedTeamMembersValidator()
    {
        RuleFor(_ => _.Provider).NotEqual(AIProviderId.NotSet).WithMessage("A provider is required");
        RuleFor(_ => _.AllowedTeamMembers).NotNull().WithMessage("A team member selection is required");
        RuleFor(_ => _).Must(_ => _.AllowedTeamMembers is null ||
            _.AllowedTeamMembers.Distinct().Count() == _.AllowedTeamMembers.Count)
            .WithMessage("Team members must be distinct");
    }
}

/// <summary>
/// Event raised when the allowed team members for a provider have been replaced.
/// </summary>
/// <param name="AllowedTeamMembers">The complete set of team members allowed to use the provider.</param>
[EventType]
public record AIProviderAllowedTeamMembersSet(IReadOnlyList<TeamMemberId> AllowedTeamMembers);
