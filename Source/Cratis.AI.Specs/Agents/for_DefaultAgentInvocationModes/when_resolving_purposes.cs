// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;

namespace Cratis.AI.Agents.for_DefaultAgentInvocationModes;

public class when_resolving_purposes : Specification
{
    readonly DefaultAgentInvocationModes _modes = new();
    readonly LanguageModelPurpose[] _purposes =
    [
        AgentPurposes.WorkExecution,
        AgentPurposes.ContentAuthoring,
        AgentPurposes.TaskExecution,
        AgentPurposes.BugFixing,
        AgentPurposes.Conversation,
        new("ApplicationSpecificPurpose"),
        new("WorkExecution"),
        new("workexecution")
    ];
    AgentInvocationMode[] _results;

    void Because() => _results = _purposes.Select(_modes.For).ToArray();

    [Fact] void should_run_work_execution_as_a_job() => _results[0].ShouldEqual(AgentInvocationMode.Job);
    [Fact] void should_run_content_authoring_as_a_job() => _results[1].ShouldEqual(AgentInvocationMode.Job);
    [Fact] void should_run_task_execution_as_a_job() => _results[2].ShouldEqual(AgentInvocationMode.Job);
    [Fact] void should_run_bug_fixing_as_a_job() => _results[3].ShouldEqual(AgentInvocationMode.Job);
    [Fact] void should_keep_conversation_as_chat() => _results[4].ShouldEqual(AgentInvocationMode.Chat);
    [Fact] void should_default_an_unlisted_purpose_to_chat() => _results[5].ShouldEqual(AgentInvocationMode.Chat);
    [Fact] void should_match_a_job_purpose_by_value() => _results[6].ShouldEqual(AgentInvocationMode.Job);
    [Fact] void should_keep_purpose_matching_case_sensitive() => _results[7].ShouldEqual(AgentInvocationMode.Chat);
}
