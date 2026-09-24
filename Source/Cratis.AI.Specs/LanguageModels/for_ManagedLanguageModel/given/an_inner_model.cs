// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Agents;
using Cratis.AI.LanguageModels;
using Cratis.Arc.Commands;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Cratis.AI.LanguageModels.for_ManagedLanguageModel.given;

/// <summary>
/// A substituted inner <see cref="ILanguageModel"/>, an assertable fake delay so retry specs never
/// cost the suite real wall-clock seconds, and a no-op <see cref="IAgentExecution"/>/<see cref="IAIAgents"/>
/// pair - mirrors Direct's own <c>AgentExecutionScope.ForSpecs()</c> precedent.
/// </summary>
public class an_inner_model : Specification
{
    protected ILanguageModel Inner;
    protected ICommandPipeline CommandPipeline;
    protected Func<TimeSpan, CancellationToken, Task> Delay;
    protected ManagedLanguageModel Model;

    protected void Establish()
    {
        Inner = Substitute.For<ILanguageModel>();
        CommandPipeline = Substitute.For<ICommandPipeline>();

        Delay = Substitute.For<Func<TimeSpan, CancellationToken, Task>>();
        Delay.Invoke(Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);

        var agents = Substitute.For<IAIAgents>();
        agents.FindByPurpose(Arg.Any<LanguageModelPurpose>()).Returns((AgentDescriptor?)null);

        Model = new ManagedLanguageModel(
            Inner,
            CommandPipeline,
            agents,
            new AgentExecution(new Cratis.Chronicle.Identities.BaseIdentityProvider(), new Cratis.Chronicle.Auditing.CausationManager(), agents),
            Substitute.For<ILogger<ManagedLanguageModel>>(),
            Delay);
    }
}
