// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Harnesses;
using Cratis.AI.Providers.HarnessSupport;
using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.SettingHarnesses.for_SetAIProviderHarnessesValidator.when_validating;

public class and_the_provider_is_missing : Specification
{
    FluentValidation.Results.ValidationResult _result;
    SetAIProviderHarnessesValidator _validator;

    void Establish() => _validator = new(
        Substitute.For<IReadModels>(),
        new Cratis.Types.KnownInstancesOf<IHarnessSupport>(new AnthropicHarnessSupport()));

    async Task Because() => _result = await _validator.ValidateAsync(new SetAIProviderHarnesses(AIProviderId.New(), [Harness.Claude]));

    [Fact] void should_reject_the_selection() => _result.IsValid.ShouldBeFalse();
}
