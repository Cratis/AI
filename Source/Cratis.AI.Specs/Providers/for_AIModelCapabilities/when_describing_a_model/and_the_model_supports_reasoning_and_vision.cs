// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_AIModelCapabilities.when_describing_a_model;

public class and_the_model_supports_reasoning_and_vision : Specification
{
    IReadOnlySet<AIModelCapability> _result;

    void Because() => _result = AIModelCapabilities.For((ModelName)"claude-sonnet-4-5");

    [Fact] void should_be_conversational() => _result.ShouldContain(AIModelCapability.Conversational);
    [Fact] void should_support_tool_use() => _result.ShouldContain(AIModelCapability.ToolUse);
    [Fact] void should_support_reasoning() => _result.ShouldContain(AIModelCapability.Reasoning);
    [Fact] void should_support_vision() => _result.ShouldContain(AIModelCapability.Vision);
}
