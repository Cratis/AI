// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingAllowedMembers;

/// <summary>
/// Replaces the team members allowed to use a particular provider. An empty collection disables the
/// provider for every team member; a provider nobody has ever set a selection for remains open to
/// everyone - see <see cref="ConfiguredAIProvider.HasAllowedMembersSelection"/>.
/// </summary>
/// <param name="Provider">The provider whose allowed members are being set.</param>
/// <param name="AllowedMembers">The complete set of team members allowed to use the provider.</param>
[Command]
public record SetAIProviderAllowedMembers(AIProviderId Provider, IReadOnlyList<TeamMemberId> AllowedMembers)
{
    /// <summary>
    /// Records the complete selection on the provider's event stream.
    /// </summary>
    /// <returns>The selected members.</returns>
    public AIProviderAllowedMembersSet Handle() => new(AllowedMembers.ToArray());
}

/// <summary>
/// Validates the selection.
/// </summary>
public class SetAIProviderAllowedMembersValidator : CommandValidator<SetAIProviderAllowedMembers>
{
    /// <summary>
    /// Initializes the validator.
    /// </summary>
    public SetAIProviderAllowedMembersValidator()
    {
        RuleFor(_ => _.Provider).NotEqual(AIProviderId.NotSet).WithMessage("A provider is required");
        RuleFor(_ => _.AllowedMembers).NotNull().WithMessage("A member selection is required");
        RuleFor(_ => _).Must(_ => _.AllowedMembers is null ||
            _.AllowedMembers.Distinct().Count() == _.AllowedMembers.Count)
            .WithMessage("Members must be distinct");
    }
}

/// <summary>
/// Event raised when the team members allowed to use a provider have been replaced.
/// </summary>
/// <param name="AllowedMembers">The complete set of team members allowed to use the provider.</param>
[EventType]
public record AIProviderAllowedMembersSet(IReadOnlyList<TeamMemberId> AllowedMembers);
