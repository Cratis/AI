// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Decisions;

/// <summary>
/// What a decision engine answered for a set of requests.
/// </summary>
/// <param name="Distributions">One distribution per request, in request order; each distribution in any order.</param>
/// <param name="Model">The model that actually answered - an engine may resolve an alias such as <c>jev-latest</c>.</param>
/// <param name="InputTokens">The input tokens the engine reported, or zero when it reports none.</param>
/// <param name="OutputTokens">The output tokens the engine reported, or zero when it reports none.</param>
public record DecisionEngineAnswers(
    IReadOnlyList<IReadOnlyList<DecisionOutcome>> Distributions,
    ModelName Model,
    long InputTokens = 0,
    long OutputTokens = 0);
