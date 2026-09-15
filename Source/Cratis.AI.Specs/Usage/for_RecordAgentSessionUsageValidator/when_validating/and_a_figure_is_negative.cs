// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using FluentValidation.TestHelper;

namespace Cratis.AI.Usage.for_RecordAgentSessionUsageValidator.when_validating;

/// <summary>
/// A negative measurement is never real - Direct hit exactly this bug once (Cratis/Stagehand#747)
/// and every figure here is rejected the same way, at the command boundary, before it ever reaches a
/// concept's own validator.
/// </summary>
public class and_a_figure_is_negative : Specification
{
    RecordAgentSessionUsageValidator _validator;
    RecordAgentSessionUsage _command;
    TestValidationResult<RecordAgentSessionUsage> _result;

    void Establish()
    {
        _validator = new RecordAgentSessionUsageValidator();
        _command = new RecordAgentSessionUsage(
            AgentSessionId.New(),
            new AgentId("triage"),
            new ModelName("sonnet"),
            new LanguageModelPurpose("triage"),
            CpuSeconds: new CpuSeconds(-1m));
    }

    void Because() => _result = _validator.TestValidate(_command);

    [Fact] void should_have_a_validation_error_for_cpu_seconds() => _result.ShouldHaveValidationErrorFor(_ => _.CpuSeconds!.Value);
}
