// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions;

/// <summary>
/// A bounded question: this context, weighed against exactly these outcomes.
/// </summary>
/// <param name="Context">The context to weigh the choices against.</param>
/// <param name="Choices">The finite set of possible outcomes.</param>
/// <param name="Question">The question the choices answer - <see langword="null"/> when the choices speak for themselves.</param>
/// <param name="Descriptions">What each choice means, keyed by choice - <see langword="null"/> or partial when a choice's identifier says it all.</param>
/// <param name="Topic">What the decision is about, for usage reporting - <see langword="null"/> when the caller has no name for it.</param>
/// <remarks>
/// The question and descriptions are guidance, not vocabulary: the choices remain the opaque
/// identifiers the caller branches on. An engine that can use them - Jev takes both natively, the
/// built-in engine puts them into its prompt - weighs the choices against what they mean rather
/// than against how their identifiers happen to read.
/// </remarks>
public record DecisionRequest(
    DecisionContext Context,
    IReadOnlyList<DecisionChoiceId> Choices,
    DecisionQuestion? Question = null,
    IReadOnlyDictionary<DecisionChoiceId, string>? Descriptions = null,
    DecisionTopic? Topic = null)
{
    /// <summary>
    /// Gets the question, when the caller supplied one.
    /// </summary>
    public string? QuestionText => Question is { } question && !string.IsNullOrWhiteSpace(question.Value) ? question.Value : null;

    /// <summary>
    /// Creates a request from free text and a set of choices.
    /// </summary>
    /// <param name="text">The free-text context.</param>
    /// <param name="choices">The choices.</param>
    /// <returns>The <see cref="DecisionRequest"/>.</returns>
    public static DecisionRequest For(string text, params DecisionChoiceId[] choices) =>
        new(DecisionContext.FromText(text), choices);

    /// <summary>
    /// Gets the description of a choice, when the caller supplied one.
    /// </summary>
    /// <param name="choice">The choice.</param>
    /// <returns>The description, or <see langword="null"/> when there is none.</returns>
    public string? DescriptionOf(DecisionChoiceId choice) =>
        Descriptions is not null && Descriptions.TryGetValue(choice, out var description) && !string.IsNullOrWhiteSpace(description)
            ? description
            : null;
}
