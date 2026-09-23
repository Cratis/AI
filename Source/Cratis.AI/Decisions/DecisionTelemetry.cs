// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using System.Diagnostics.Metrics;
using Cratis.AI.Common;
using Cratis.AI.Providers;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Decisions;

/// <summary>
/// Traces and meters decision calls.
/// </summary>
/// <remarks>
/// The distribution's shape is the calibration signal - a provider that answers every question at
/// 0.34/0.33/0.33 is useless in a way that a latency graph will never show. Recording top
/// probability as a histogram is what makes that visible without keeping the contexts themselves.
/// </remarks>
public interface IDecisionTelemetry
{
    /// <summary>
    /// Starts a span for a decision.
    /// </summary>
    /// <param name="choiceCount">How many choices are being weighed.</param>
    /// <param name="context">The context being weighed against.</param>
    /// <returns>The <see cref="Activity"/>, or <see langword="null"/> when nothing is listening.</returns>
    Activity? Start(int choiceCount, DecisionContext context);

    /// <summary>
    /// Records a decision that produced a distribution.
    /// </summary>
    /// <param name="activity">The span the decision ran in.</param>
    /// <param name="type">The provider type that answered.</param>
    /// <param name="result">The result.</param>
    void Decided(Activity? activity, AIProviderType type, DecisionResult result);

    /// <summary>
    /// Records a decision that failed.
    /// </summary>
    /// <param name="activity">The span the decision ran in.</param>
    /// <param name="type">The provider type that failed.</param>
    /// <param name="model">The model that was asked.</param>
    /// <param name="duration">How long it took to fail.</param>
    /// <param name="reason">Why it failed.</param>
    void Failed(Activity? activity, AIProviderType type, ModelName model, TimeSpan duration, string reason);
}

/// <summary>
/// Represents an implementation of <see cref="IDecisionTelemetry"/>.
/// </summary>
public sealed class DecisionTelemetry : IDecisionTelemetry, IDisposable
{
    /// <summary>
    /// The name of the <see cref="System.Diagnostics.ActivitySource"/> and <see cref="Meter"/> decisions are reported on.
    /// </summary>
    public const string Name = "Cratis.AI.Decisions";

    static readonly ActivitySource _source = new(Name);

    readonly IOptions<DecisionOptions> _options;
    readonly Meter _meter;
    readonly Histogram<double> _duration;
    readonly Histogram<double> _topProbability;
    readonly Counter<long> _count;

    /// <summary>
    /// Initializes a new instance of the <see cref="DecisionTelemetry"/> class.
    /// </summary>
    /// <param name="options">The <see cref="DecisionOptions"/>.</param>
    public DecisionTelemetry(IOptions<DecisionOptions> options)
    {
        _options = options;
        _meter = new(Name);
        _duration = _meter.CreateHistogram<double>(
            "cratis.ai.decision.duration",
            unit: "ms",
            description: "How long a decision took.");
        _topProbability = _meter.CreateHistogram<double>(
            "cratis.ai.decision.top_probability",
            description: "The probability assigned to the winning choice - the calibration signal.");
        _count = _meter.CreateCounter<long>(
            "cratis.ai.decision.count",
            description: "How many decisions were asked for.");
    }

    /// <inheritdoc/>
    public Activity? Start(int choiceCount, DecisionContext context)
    {
        var activity = _source.StartActivity("ai.decision", ActivityKind.Client);
        activity?.SetTag("ai.decision.choice_count", choiceCount);
        activity?.SetTag("ai.decision.context_chars", context.Text?.Length ?? 0);

        if (_options.Value.RecordContextInTelemetry && context.Text is { } text)
        {
            activity?.SetTag("ai.decision.context", text);
        }

        return activity;
    }

    /// <inheritdoc/>
    public void Decided(Activity? activity, AIProviderType type, DecisionResult result)
    {
        activity?.SetTag("ai.decision.model", result.Model.Value);
        activity?.SetTag("ai.decision.top", result.Top.Value);
        activity?.SetTag("ai.decision.top_probability", result.TopProbability);
        activity?.SetTag("ai.decision.margin", result.Margin);
        activity?.SetStatus(ActivityStatusCode.Ok);

        var tags = TagsFor(type, result.Model, "decided");
        _duration.Record(result.Latency.TotalMilliseconds, tags);
        _topProbability.Record(result.TopProbability, tags);
        _count.Add(1, tags);
    }

    /// <inheritdoc/>
    public void Failed(Activity? activity, AIProviderType type, ModelName model, TimeSpan duration, string reason)
    {
        activity?.SetStatus(ActivityStatusCode.Error, reason);

        var tags = TagsFor(type, model, "failed");
        _duration.Record(duration.TotalMilliseconds, tags);
        _count.Add(1, tags);
    }

    /// <inheritdoc/>
    public void Dispose() => _meter.Dispose();

    static TagList TagsFor(AIProviderType type, ModelName model, string outcome) =>
        new()
        {
            { "provider.type", type.ToString() },
            { "model", model.Value },
            { "outcome", outcome },
        };
}
