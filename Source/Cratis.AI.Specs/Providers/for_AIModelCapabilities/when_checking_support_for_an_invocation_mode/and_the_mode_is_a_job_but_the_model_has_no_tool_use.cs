// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_AIModelCapabilities.when_checking_support_for_an_invocation_mode;

/// <summary>
/// A worker-harness job needs tool use - a model with no tool-use capability (an embedding model,
/// say) can never serve one, regardless of whether it happens to be conversational.
/// </summary>
public class and_the_mode_is_a_job_but_the_model_has_no_tool_use : Specification
{
    bool _result;

    void Because() => _result = AIModelCapabilities.Supports(AgentInvocationMode.Job, (ModelName)"text-embedding-3-large");

    [Fact] void should_not_be_supported() => _result.ShouldBeFalse();
}
