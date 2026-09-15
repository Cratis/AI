// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Concepts;

namespace Cratis.AI.LanguageModels;

/// <summary>
/// What a call into the package's language model surface was for - the reactor, command handler or
/// conversation turn that made the call, so usage and causation can be attributed to a job rather
/// than lumped into one undifferentiated total.
/// </summary>
/// <param name="Value">The underlying value.</param>
/// <remarks>
/// Ported from Direct's <c>Common.LanguageModelPurpose</c> (plan Section 5.2 step 1). An <c>IAIAgents</c>
/// lookup keys the default agent-per-purpose mapping off this value (see <c>Abstractions.IAIAgents.FindByPurpose</c>).
/// </remarks>
public record LanguageModelPurpose(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unspecified purpose.
    /// </summary>
    public static readonly LanguageModelPurpose NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="LanguageModelPurpose"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator LanguageModelPurpose(string value) => new(value);
}
