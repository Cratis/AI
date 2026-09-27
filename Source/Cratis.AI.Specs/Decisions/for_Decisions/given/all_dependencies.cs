// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Decisions.Usage;
using Cratis.Types;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace Cratis.AI.Decisions.for_Decisions.given;

public class all_dependencies : Specification
{
    protected static readonly ModelName _model = "decision-model-for-specs";

    protected IDecisionEngineResolver _resolver;
    protected IDecisionEngineClient _client;
    protected IDecisionUsageRecorder _usage;
    protected IDecisionTelemetry _telemetry;
    protected DecisionOptions _options;
    protected DecisionEngineConnection _connection;
    protected Decisions _decisions;

    void Establish()
    {
        _options = new();

        _client = Substitute.For<IDecisionEngineClient>();
        _client.Type.Returns(DecisionEngineType.BuiltIn);

        _resolver = Substitute.For<IDecisionEngineResolver>();
        EngineIs(DecisionEngineType.BuiltIn);

        _usage = Substitute.For<IDecisionUsageRecorder>();
        _telemetry = Substitute.For<IDecisionTelemetry>();

        _decisions = new(
            _resolver,
            new KnownInstancesOf<IDecisionEngineClient>(_client),
            _usage,
            _telemetry,
            Options.Create(_options),
            Substitute.For<ILogger<Decisions>>());
    }

    protected void EngineIs(DecisionEngineType type)
    {
        _connection = new DecisionEngineConnection(type, "http://decisions", DecisionEngineApiKey.NotSet, _model);
        _resolver.Resolve(Arg.Any<CancellationToken>()).Returns(_connection);
    }

    protected void NoEngineIsResolved() =>
        _resolver.Resolve(Arg.Any<CancellationToken>()).Returns((DecisionEngineConnection?)null);

    protected void ClientAnswers(params (string Choice, double Probability)[] distribution) =>
        _client.Decide(
                Arg.Any<IReadOnlyList<DecisionRequest>>(),
                Arg.Any<DecisionEngineConnection>(),
                Arg.Any<CancellationToken>())
            .Returns(new DecisionEngineAnswers(
                [[.. distribution.Select(entry => new DecisionOutcome(entry.Choice, entry.Probability))]],
                _model,
                InputTokens: 42,
                OutputTokens: 7));

    protected static DecisionRequest RequestFor(params string[] choices) =>
        new(DecisionContext.FromText("a bounded question"), [.. choices.Select(choice => (DecisionChoiceId)choice)]);
}
