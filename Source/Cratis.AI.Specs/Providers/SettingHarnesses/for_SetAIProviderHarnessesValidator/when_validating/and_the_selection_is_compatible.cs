// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Harnesses;
using Cratis.AI.Providers.HarnessSupport;
using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.SettingHarnesses.for_SetAIProviderHarnessesValidator.when_validating;

public class and_the_selection_is_compatible : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();
    FluentValidation.Results.ValidationResult _result;
    SetAIProviderHarnessesValidator _validator;

    void Establish()
    {
        var readModels = Substitute.For<IReadModels>();
        readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_providerId)
            .Returns(new ConfiguredAIProvider(_providerId, AIProviderType.Anthropic, "sk-ant-key"));
        _validator = new(readModels, new Cratis.Types.KnownInstancesOf<IHarnessSupport>(new AnthropicHarnessSupport()));
    }

    async Task Because() => _result = await _validator.ValidateAsync(new SetAIProviderHarnesses(_providerId, [Harness.Claude, Harness.Pi]));

    [Fact] void should_accept_both_harnesses() => _result.IsValid.ShouldBeTrue();
}
