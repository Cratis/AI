// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Adding.when_adding_openai_provider;

/// <summary>
/// A ChatGPT subscription record missing its refresh token is useless: Pi reports it only as
/// invalid_state, from inside a container that has already been launched. Caught in the dialog
/// instead, where the person pasting it can fix it.
/// </summary>
public class and_the_subscription_record_is_incomplete : Specification
{
    CommandScenario<AddOpenAIProvider> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(
        new AddOpenAIProvider("Subscription", """{"type":"oauth","access":"at","expires":4102444800000}""", MaxConcurrentJobs.NotSet));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();
}
