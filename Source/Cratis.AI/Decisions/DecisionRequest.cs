// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions;

/// <summary>
/// A bounded question: this context, weighed against exactly these outcomes.
/// </summary>
/// <param name="Context">The context to weigh the choices against.</param>
/// <param name="Choices">The finite set of possible outcomes.</param>
public record DecisionRequest(DecisionContext Context, IReadOnlyList<DecisionChoiceId> Choices)
{
    /// <summary>
    /// Creates a request from free text and a set of choices.
    /// </summary>
    /// <param name="text">The free-text context.</param>
    /// <param name="choices">The choices.</param>
    /// <returns>The <see cref="DecisionRequest"/>.</returns>
    public static DecisionRequest For(string text, params DecisionChoiceId[] choices) =>
        new(DecisionContext.FromText(text), choices);
}
