// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_AIModelCapabilities.when_checking_support_for_an_invocation_mode;

public class and_the_mode_is_chat_and_the_model_is_conversational : Specification
{
    bool _result;

    void Because() => _result = AIModelCapabilities.Supports(AgentInvocationMode.Chat, (ModelName)"gpt-5.2");

    [Fact] void should_be_supported() => _result.ShouldBeTrue();
}
