// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.Adding.when_adding_openai_provider;

/// <summary>
/// The whole record from Pi's credential store is a valid OpenAI credential - it just is not an API
/// key, and the provider has to accept it as readily as one.
/// </summary>
public class and_a_complete_subscription_record_is_given : Specification
{
    CommandScenario<AddOpenAIProvider> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(
        new AddOpenAIProvider("Subscription", """{"type":"oauth","access":"at","refresh":"rt","expires":4102444800000}""", MaxConcurrentJobs.NotSet));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
}
