// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers;
using Cratis.Types;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace Cratis.AI.Decisions.for_Decisions.given;

public class all_dependencies : Specification
{
    protected static readonly ModelName _model = "decision-model-for-specs";

    protected IDecisionProviderResolver _resolver;
    protected IDecisionProviderClient _client;
    protected IDecisionTelemetry _telemetry;
    protected DecisionOptions _options;
    protected Decisions _decisions;

    void Establish()
    {
        _options = new();

        _client = Substitute.For<IDecisionProviderClient>();
        _client.Type.Returns(AIProviderType.DecisionEngine);

        _resolver = Substitute.For<IDecisionProviderResolver>();
        ProviderIs(AIProviderType.DecisionEngine);

        _telemetry = Substitute.For<IDecisionTelemetry>();

        _decisions = new(
            _resolver,
            new KnownInstancesOf<IDecisionProviderClient>(_client),
            _telemetry,
            Options.Create(_options),
            Substitute.For<ILogger<Decisions>>());
    }

    protected void ProviderIs(AIProviderType type) =>
        _resolver.Resolve(Arg.Any<CancellationToken>()).Returns(new DecisionProviderSelection(
            new ConfiguredAIProvider(AIProviderId.New(), type, AIProviderApiKey.NotSet, (AIProviderEndpoint)"http://decisions"),
            _model));

    protected void NoProviderIsResolved() =>
        _resolver.Resolve(Arg.Any<CancellationToken>()).Returns((DecisionProviderSelection?)null);

    protected void ClientAnswers(params (string Choice, double Probability)[] distribution) =>
        _client.Decide(
                Arg.Any<IReadOnlyList<DecisionRequest>>(),
                Arg.Any<ConfiguredAIProvider>(),
                Arg.Any<ModelName>(),
                Arg.Any<CancellationToken>())
            .Returns<IReadOnlyList<IReadOnlyList<DecisionOutcome>>>(
                [[.. distribution.Select(entry => new DecisionOutcome(entry.Choice, entry.Probability))]]);

    protected static DecisionRequest RequestFor(params string[] choices) =>
        new(DecisionContext.FromText("a bounded question"), [.. choices.Select(choice => (DecisionChoiceId)choice)]);
}
