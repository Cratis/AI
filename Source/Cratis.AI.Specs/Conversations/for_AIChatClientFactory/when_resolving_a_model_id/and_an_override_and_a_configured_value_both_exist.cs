// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers;

namespace Cratis.AI.Conversations.for_AIChatClientFactory.when_resolving_a_model_id;

public class and_an_override_and_a_configured_value_both_exist : Specification
{
    string _result;

    void Because() => _result = AIChatClientFactory.ResolveModelId(AIProviderType.OpenAI, new ModelName("configured-model"), new ModelName("override-model"));

    [Fact] void should_prefer_the_override() => _result.ShouldEqual("override-model");
}
