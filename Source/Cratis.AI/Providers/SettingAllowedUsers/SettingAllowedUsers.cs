// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingAllowedUsers;

/// <summary>
/// The opaque identifier the host application uses for one of its own people - a GitHub login, a
/// subject id, or whatever identity the host already carries on its own work. Cratis.AI holds this
/// only to compare it against an incoming request; it has no concept of a person of its own.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record AIProviderAllowedUserId(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="AIProviderAllowedUserId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AIProviderAllowedUserId(string value) => new(value);
}

/// <summary>
/// Replaces which of the host application's people may use a particular provider. An empty
/// collection means the provider is open to whoever - or whatever automation - would otherwise be
/// allowed to use it; this is how a provider starts out, and how a restriction is lifted again.
/// </summary>
/// <param name="Provider">The provider whose allowed people are being set.</param>
/// <param name="AllowedUserIds">The complete set of people allowed to use it, empty for unrestricted.</param>
[Command]
public record SetAIProviderAllowedUsers(AIProviderId Provider, IReadOnlyList<AIProviderAllowedUserId> AllowedUserIds)
{
    /// <summary>
    /// Records the complete selection on the provider's event stream.
    /// </summary>
    /// <returns>The selected people.</returns>
    public AIProviderAllowedUsersSet Handle() => new(AllowedUserIds.ToArray());
}

/// <summary>
/// Validates the selection against the provider it names.
/// </summary>
public class SetAIProviderAllowedUsersValidator : CommandValidator<SetAIProviderAllowedUsers>
{
    /// <summary>
    /// Initializes the validator.
    /// </summary>
    /// <param name="readModels">The configured providers.</param>
    public SetAIProviderAllowedUsersValidator(IReadModels readModels)
    {
        RuleFor(_ => _.Provider).NotEqual(AIProviderId.NotSet).WithMessage("A provider is required");
        RuleFor(_ => _.AllowedUserIds).NotNull().WithMessage("A selection is required - empty allows everyone");
        RuleFor(_ => _).Must(_ => _.AllowedUserIds is null ||
            _.AllowedUserIds.Distinct().Count() == _.AllowedUserIds.Count)
            .WithMessage("People must be distinct");
        RuleFor(_ => _).MustAsync(async (command, _) =>
        {
            if (command.Provider.Equals(AIProviderId.NotSet)) return true;
            return await readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)command.Provider) is not null;
        }).WithMessage("The provider is not configured");
    }
}

/// <summary>
/// Event raised when the people allowed to use a provider have been replaced.
/// </summary>
/// <param name="AllowedUserIds">The complete set of people allowed to use it, empty for unrestricted.</param>
[EventType]
public record AIProviderAllowedUsersSet(IReadOnlyList<AIProviderAllowedUserId> AllowedUserIds);
