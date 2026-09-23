// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions;

/// <summary>
/// What a decision provider is given to weigh the choices against - free text, structured
/// key/value pairs, or both.
/// </summary>
/// <param name="Text">The free-text context, when there is one.</param>
/// <param name="Structured">The structured context, when there is one.</param>
/// <remarks>
/// Both halves are optional but a context with neither is meaningless, which
/// <see cref="IDecisions"/> rejects rather than sending an empty prompt to a provider that would
/// answer it anyway with a uniform-ish distribution a caller could mistake for a real signal.
/// </remarks>
public record DecisionContext(string? Text = null, IReadOnlyDictionary<string, string>? Structured = null)
{
    /// <summary>
    /// Gets a value indicating whether this context carries anything at all.
    /// </summary>
    public bool IsEmpty => string.IsNullOrWhiteSpace(Text) && (Structured is null || Structured.Count == 0);

    /// <summary>
    /// Creates a context from free text.
    /// </summary>
    /// <param name="text">The text.</param>
    /// <returns>The <see cref="DecisionContext"/>.</returns>
    public static DecisionContext FromText(string text) => new(text);

    /// <summary>
    /// Creates a context from structured key/value pairs.
    /// </summary>
    /// <param name="structured">The structured context.</param>
    /// <returns>The <see cref="DecisionContext"/>.</returns>
    public static DecisionContext FromStructured(IReadOnlyDictionary<string, string> structured) => new(Structured: structured);
}
