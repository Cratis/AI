// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions;

/// <summary>
/// One choice and the probability the provider assigned it.
/// </summary>
/// <param name="Choice">The choice.</param>
/// <param name="Probability">The probability, between zero and one.</param>
public record DecisionOutcome(DecisionChoiceId Choice, double Probability);
