// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Decisions.Usage;

/// <summary>
/// The day/engine/model/topic bucket a decision's usage accumulates into.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record DecisionUsageBucketKey(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing no bucket.
    /// </summary>
    public static readonly DecisionUsageBucketKey NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="DecisionUsageBucketKey"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator DecisionUsageBucketKey(string value) => new(value);

    /// <summary>
    /// Creates the bucket key for a day, engine, model and topic.
    /// </summary>
    /// <param name="day">The day.</param>
    /// <param name="engine">The engine.</param>
    /// <param name="model">The model.</param>
    /// <param name="topic">The topic.</param>
    /// <returns>The <see cref="DecisionUsageBucketKey"/>.</returns>
    public static DecisionUsageBucketKey For(DayKey day, DecisionEngineType engine, ModelName model, DecisionTopic topic) =>
        $"{day}|{engine}|{model}|{topic}";
}
