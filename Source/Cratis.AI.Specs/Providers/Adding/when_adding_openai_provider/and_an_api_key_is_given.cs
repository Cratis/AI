// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.Adding.when_adding_openai_provider;

/// <summary>
/// An ordinary API key is not a subscription record and must not be judged as one - the new rule
/// only applies to something shaped like JSON.
/// </summary>
public class and_an_api_key_is_given : Specification
{
    CommandScenario<AddOpenAIProvider> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new AddOpenAIProvider("Metered", "sk-proj-abc", 5));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
}
