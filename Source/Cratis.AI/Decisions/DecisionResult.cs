// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Decisions;

/// <summary>
/// The full probability distribution a decision provider returned, plus the two derived values
/// every caller needs to decide whether to act on it.
/// </summary>
/// <param name="Outcomes">Every supplied choice with its probability, ordered by probability descending.</param>
/// <param name="Top">The highest-probability choice.</param>
/// <param name="TopProbability">The highest probability.</param>
/// <param name="Margin">The distance between the highest and second-highest probability - one when there was only one choice.</param>
/// <param name="Model">The model that produced the distribution.</param>
/// <param name="Engine">The kind of decision engine that answered.</param>
/// <param name="Latency">How long the provider took.</param>
/// <remarks>
/// <para>
/// <b><see cref="Margin"/> is precomputed rather than left to callers.</b> Every consumer of this
/// package needs "how close was the runner-up" to decide whether a decision is actionable, and four
/// consumers each deriving it from <see cref="Outcomes"/> is how four subtly different definitions
/// of the same word appear. Computed once, here.
/// </para>
/// <para>
/// <b><see cref="Outcomes"/> is the provider's raw distribution.</b> It is never clamped, rounded or
/// filtered on the way through - thresholding is a consumer policy, and a package that pre-applied
/// one would make calibration impossible to measure after the fact.
/// </para>
/// </remarks>
public record DecisionResult(
    IReadOnlyList<DecisionOutcome> Outcomes,
    DecisionChoiceId Top,
    double TopProbability,
    double Margin,
    ModelName Model,
    DecisionEngineType Engine,
    TimeSpan Latency)
{
    /// <summary>
    /// Creates a result from an unordered distribution, deriving the top choice and margin.
    /// </summary>
    /// <param name="outcomes">The distribution, in any order.</param>
    /// <param name="model">The model that produced it.</param>
    /// <param name="engine">The kind of decision engine that answered.</param>
    /// <param name="latency">How long the provider took.</param>
    /// <returns>The <see cref="DecisionResult"/>.</returns>
    /// <remarks>
    /// Ties are broken by the order the outcomes arrive in, which <see cref="Decisions"/> keeps
    /// aligned with the order the caller supplied the choices in - so two equally-weighted choices
    /// resolve to the one the workflow listed first, deterministically, rather than to whichever
    /// way a sort happened to fall.
    /// </remarks>
    public static DecisionResult From(
        IReadOnlyList<DecisionOutcome> outcomes,
        ModelName model,
        DecisionEngineType engine,
        TimeSpan latency)
    {
        var ordered = outcomes.OrderByDescending(_ => _.Probability).ToList();
        var top = ordered[0];
        var margin = ordered.Count > 1 ? top.Probability - ordered[1].Probability : 1d;

        return new(ordered, top.Choice, top.Probability, margin, model, engine, latency);
    }

    /// <summary>
    /// Gets the probability assigned to a choice.
    /// </summary>
    /// <param name="choice">The choice.</param>
    /// <returns>The probability, or zero when the choice was not part of the distribution.</returns>
    public double ProbabilityOf(DecisionChoiceId choice) =>
        Outcomes.FirstOrDefault(_ => _.Choice == choice)?.Probability ?? 0d;
}
