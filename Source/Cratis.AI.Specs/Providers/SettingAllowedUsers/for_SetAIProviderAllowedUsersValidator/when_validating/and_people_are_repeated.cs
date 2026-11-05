// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.SettingAllowedUsers.for_SetAIProviderAllowedUsersValidator.when_validating;

public class and_people_are_repeated : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();
    FluentValidation.Results.ValidationResult _result;
    SetAIProviderAllowedUsersValidator _validator;

    void Establish()
    {
        var readModels = Substitute.For<IReadModels>();
        readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_providerId)
            .Returns(new ConfiguredAIProvider(_providerId, AIProviderType.Anthropic, "sk-ant-key"));
        _validator = new(readModels);
    }

    async Task Because() => _result = await _validator.ValidateAsync(new SetAIProviderAllowedUsers(_providerId, ["alice", "alice"]));

    [Fact] void should_reject_duplicates() => _result.IsValid.ShouldBeFalse();
}
