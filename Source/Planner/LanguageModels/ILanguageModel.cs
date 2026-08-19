// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.LanguageModels;

/// <summary>
/// Defines the abstraction the Planner's own short reasoning (triage classification, plan
/// summaries, merge-safety classification) goes through - deliberately separate from the worker
/// harness that does the actual implementation work, so the Planner is never left unable to reason
/// about an issue just because no worker account has capacity, and so a new provider is a new
/// implementation of this interface rather than a change to every caller.
/// </summary>
public interface ILanguageModel
{
    /// <summary>
    /// Asks the model to complete a prompt.
    /// </summary>
    /// <param name="prompt">The prompt.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The <see cref="LanguageModelResult"/>.</returns>
    Task<LanguageModelResult> Complete(string prompt, CancellationToken cancellationToken = default);
}

/// <summary>
/// The outcome of asking a language model to complete a prompt.
/// </summary>
/// <param name="Succeeded">Whether the model produced a completion.</param>
/// <param name="Text">The completion text - empty when it did not succeed.</param>
/// <param name="FailureReason">Why it did not succeed - empty when it did.</param>
public record LanguageModelResult(bool Succeeded, string Text, string FailureReason)
{
    /// <summary>
    /// Builds a successful result.
    /// </summary>
    /// <param name="text">The completion text.</param>
    /// <returns>The <see cref="LanguageModelResult"/>.</returns>
    public static LanguageModelResult Success(string text) => new(true, text, string.Empty);

    /// <summary>
    /// Builds a failed result.
    /// </summary>
    /// <param name="reason">Why it did not succeed.</param>
    /// <returns>The <see cref="LanguageModelResult"/>.</returns>
    public static LanguageModelResult Failure(string reason) => new(false, string.Empty, reason);
}
