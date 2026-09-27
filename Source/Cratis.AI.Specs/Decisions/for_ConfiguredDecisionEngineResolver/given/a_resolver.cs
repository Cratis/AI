// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Decisions.Configuring;
using Cratis.Chronicle.ReadModels;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace Cratis.AI.Decisions.for_ConfiguredDecisionEngineResolver.given;

public class a_resolver : Specification
{
    protected IReadModels _readModels;
    protected BuiltInDecisionEngineOptions _builtIn;
    protected ConfiguredDecisionEngineResolver _resolver;

    void Establish()
    {
        _readModels = Substitute.For<IReadModels>();
        _builtIn = new() { Endpoint = "http://decision-engine", Model = "Qwen/Qwen2.5-0.5B-Instruct" };
        _resolver = new(_readModels, Options.Create(_builtIn));
    }

    protected void Configured(ConfiguredDecisionEngine? engine) =>
        _readModels.GetInstanceById<ConfiguredDecisionEngine>((EventSourceId)DecisionEngineId.Default).Returns(engine!);
}
