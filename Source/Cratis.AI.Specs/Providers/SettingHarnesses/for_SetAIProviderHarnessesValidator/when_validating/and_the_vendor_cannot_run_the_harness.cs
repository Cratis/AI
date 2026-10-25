// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Harnesses;
using Cratis.AI.Providers.HarnessSupport;
using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.SettingHarnesses.for_SetAIProviderHarnessesValidator.when_validating;

public class and_the_vendor_cannot_run_the_harness : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();
    FluentValidation.Results.ValidationResult _result;

    void Establish()
    {
        var readModels = Substitute.For<IReadModels>();
        readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_providerId)
            .Returns(new ConfiguredAIProvider(_providerId, AIProviderType.OpenAI, "sk-key"));
        var supports = new Cratis.Types.KnownInstancesOf<IHarnessSupport>(new OpenAIHarnessSupport());
        _validator = new(readModels, supports);
    }

    SetAIProviderHarnessesValidator _validator;

    async Task Because() => _result = await _validator.ValidateAsync(new SetAIProviderHarnesses(_providerId, [Harness.Claude]));

    [Fact] void should_reject_the_selection() => _result.IsValid.ShouldBeFalse();
}
