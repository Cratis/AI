// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Harnesses;
using Cratis.AI.Providers.HarnessSupport;
using Cratis.Types;

namespace Cratis.AI.Providers.SettingHarnesses;

/// <summary>
/// Replaces the harnesses allowed to run jobs using a particular provider. An empty collection
/// disables harness dispatch for that provider without affecting direct completions.
/// </summary>
/// <param name="Provider">The provider whose harnesses are being set.</param>
/// <param name="SupportedHarnesses">The complete set of allowed harnesses.</param>
[Command]
public record SetAIProviderHarnesses(AIProviderId Provider, IReadOnlyList<Harness> SupportedHarnesses)
{
    /// <summary>
    /// Records the complete selection on the provider's event stream.
    /// </summary>
    /// <returns>The selected harnesses.</returns>
    public AIProviderHarnessesSet Handle() => new(SupportedHarnesses.ToArray());
}

/// <summary>
/// Validates the selection against the provider's vendor and credential.
/// </summary>
public class SetAIProviderHarnessesValidator : CommandValidator<SetAIProviderHarnesses>
{
    /// <summary>
    /// Initializes the validator.
    /// </summary>
    /// <param name="readModels">The configured providers.</param>
    /// <param name="supports">The vendor-specific harness contracts.</param>
    public SetAIProviderHarnessesValidator(IReadModels readModels, IInstancesOf<IHarnessSupport> supports)
    {
        RuleFor(_ => _.Provider).NotEqual(AIProviderId.NotSet).WithMessage("A provider is required");
        RuleFor(_ => _.SupportedHarnesses).NotNull().WithMessage("A harness selection is required");
        RuleFor(_ => _).Must(_ => _.SupportedHarnesses is null ||
            _.SupportedHarnesses.Distinct().Count() == _.SupportedHarnesses.Count)
            .WithMessage("Harnesses must be distinct");
        RuleFor(_ => _).MustAsync(async (command, _) =>
        {
            if (command.SupportedHarnesses is null || command.Provider.Equals(AIProviderId.NotSet)) return true;
            var provider = await readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)command.Provider);
            if (provider is null) return false;
            var support = supports.FirstOrDefault(_ => _.Type == provider.Type);
            return support is not null && command.SupportedHarnesses.All(harness =>
                support.SupportsCredential(harness, provider.ApiKey));
        }).WithMessage("The provider does not support the selected harnesses or is not configured");
    }
}

/// <summary>
/// Event raised when the allowed harnesses for a provider have been replaced.
/// </summary>
/// <param name="SupportedHarnesses">The complete set of allowed harnesses.</param>
[EventType]
public record AIProviderHarnessesSet(IReadOnlyList<Harness> SupportedHarnesses);
