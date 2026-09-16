// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Conversations.for_AIChatClientFactory.when_normalizing_an_openai_compatible_base;

public class and_the_endpoint_already_names_a_version : Specification
{
    string _result;

    void Because() => _result = AIChatClientFactory.NormalizeOpenAICompatibleBase("https://localhost:11434/v1/");

    [Fact] void should_not_append_another_version_segment() => _result.ShouldEqual("https://localhost:11434/v1");
}
