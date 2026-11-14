// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;

namespace Cratis.AI.Providers.SettingAllowedTeamMembers;

/// <summary>
/// Replaces the team members allowed to use a particular provider. No selection at all - the
/// package's default - leaves the provider open to everyone, matching its behavior before this
/// restriction existed; an explicit empty collection instead denies every team member.
/// </summary>
/// <param name="Provider">The provider whose allowed team members are being set.</param>
/// <param name="AllowedTeamMembers">The complete set of team members allowed to use the provider.</param>
[Command]
[Authorize]
public record SetAIProviderAllowedTeamMembers(AIProviderId Provider, IReadOnlyList<TeamMemberId> AllowedTeamMembers)
{
    /// <summary>
    /// Records the complete selection on the provider's event stream.
    /// </summary>
    /// <param name="authority">The consumer's administrative authority.</param>
    /// <returns>The selected team members when authorized.</returns>
    /// <exception cref="AIProviderSelectionNotAuthorized">The caller may not change the selection.</exception>
    public async Task<AIProviderAllowedTeamMembersSet> Handle(IProviderSelectionAuthority authority)
    {
        if (!await authority.CanSet(Provider))
        {
            throw new AIProviderSelectionNotAuthorized();
        }

        return new(AllowedTeamMembers.ToArray());
    }
}

/// <summary>The caller may not change the allowed-team-members selection.</summary>
public sealed class AIProviderSelectionNotAuthorized() : UnauthorizedAccessException("Not authorized to change provider selection");

/// <summary>
/// Validates the selection's own shape - this package has no directory of team members to check
/// membership against, so it can only reject what the selection itself cannot mean.
/// </summary>
public class SetAIProviderAllowedTeamMembersValidator : CommandValidator<SetAIProviderAllowedTeamMembers>
{
    /// <summary>
    /// Initializes the validator.
    /// </summary>
    /// <param name="authority">The consumer's administrative policy; absent means denied.</param>
    /// <param name="readModels">The provider read models; absent means the provider cannot be verified.</param>
    public SetAIProviderAllowedTeamMembersValidator(IProviderSelectionAuthority? authority = null, IReadModels? readModels = null)
    {
        RuleFor(_ => _.Provider).MustAsync((provider, _) =>
            (authority ?? new DenyProviderSelectionAuthority()).CanSet(provider))
            .WithMessage("Not authorized to change provider selection");
        RuleFor(_ => _.Provider).NotEqual(AIProviderId.NotSet).WithMessage("A provider is required");
        RuleFor(_ => _.Provider).MustAsync(async (provider, _) => readModels is not null &&
            await readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)provider) is not null)
            .WithMessage("Provider must exist");
        RuleFor(_ => _.AllowedTeamMembers).NotNull().WithMessage("A team member selection is required");
        RuleFor(_ => _).Must(_ => _.AllowedTeamMembers is null ||
            _.AllowedTeamMembers.Distinct().Count() == _.AllowedTeamMembers.Count)
            .WithMessage("Team members must be distinct");
        RuleFor(_ => _.AllowedTeamMembers).Must(members => members?.All(member => member is not null && !string.IsNullOrWhiteSpace(member.Value)) != false)
            .WithMessage("Team members must have an identity");
    }
}

/// <summary>
/// Event raised when the allowed team members for a provider have been replaced.
/// </summary>
/// <param name="AllowedTeamMembers">The complete set of team members allowed to use the provider.</param>
[EventType]
public record AIProviderAllowedTeamMembersSet(IReadOnlyList<TeamMemberId> AllowedTeamMembers);
