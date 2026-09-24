// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.ZAI.for_ZAIProviderClient.when_the_api_returns_no_text;

public class the_completion : given.a_client_with_a_stubbed_endpoint
{
    LanguageModelResult _result;

    void Establish() => _body = """{ "content": [] }""";

    async Task Because() => _result = await PerformCompletion();

    [Fact] void should_fail() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_say_no_text_was_returned() => _result.FailureReason.ShouldEqual("The language model returned no text");
}
