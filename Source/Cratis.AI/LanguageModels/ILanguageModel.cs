// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.LanguageModels;

/// <summary>
/// The abstraction every single-shot completion goes through, deliberately separate from the
/// conversational/tool-calling surface (<c>Conversations/</c>) and from the harness worker path
/// (<c>Workers/</c>) - a new provider is a new vendor client, not a change to every caller. Ported
/// from Direct's <c>LanguageModels.ILanguageModel</c> (plan Section 5.2 step 7).
/// </summary>
public interface ILanguageModel
{
    /// <summary>
    /// Asks the model to complete a prompt.
    /// </summary>
    /// <param name="prompt">The prompt.</param>
    /// <param name="purpose">What the completion is for - the caller, so usage can be attributed to it.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The <see cref="LanguageModelResult"/>.</returns>
    Task<LanguageModelResult> Complete(string prompt, LanguageModelPurpose purpose, CancellationToken cancellationToken = default);
}
