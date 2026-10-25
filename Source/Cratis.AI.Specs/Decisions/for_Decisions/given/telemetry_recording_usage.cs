// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using Cratis.AI.Common;

namespace Cratis.AI.Decisions.for_Decisions.given;

/// <summary>
/// A hand-written <see cref="IDecisionTelemetry"/>: NSubstitute cannot intercept <see cref="IDecisionTelemetry.RecordUsage"/>,
/// which has a default implementation, so the specs record what reaches it here.
/// </summary>
/// <param name="fail">Whether every telemetry call throws, as a failing listener would.</param>
public class telemetry_recording_usage(bool fail = false) : IDecisionTelemetry
{
    public List<(DecisionEngineType Type, ModelName Model, DecisionTopic Topic, int Decisions, int Choices, long InputTokens, long OutputTokens)> Usages { get; } = [];

    public Activity? Start(int choiceCount, DecisionContext context) => fail ? throw new TelemetryListenerFailed() : null;

    public void Decided(Activity? activity, DecisionEngineType type, DecisionResult result) => FailIfAsked();

    public void Failed(Activity? activity, DecisionEngineType type, ModelName model, TimeSpan duration, string reason) => FailIfAsked();

    public void RecordUsage(DecisionEngineType type, ModelName model, DecisionTopic topic, int decisions, int choices, long inputTokens, long outputTokens)
    {
        FailIfAsked();
        Usages.Add((type, model, topic, decisions, choices, inputTokens, outputTokens));
    }

    void FailIfAsked()
    {
        if (fail)
        {
            throw new TelemetryListenerFailed();
        }
    }
}

/// <summary>
/// The exception that is thrown when a spec's telemetry listener is asked to fail.
/// </summary>
public class TelemetryListenerFailed() : Exception("listener failed");
