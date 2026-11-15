// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.LanguageModels;

/// <summary>
/// A sibling of <see cref="ILanguageModel"/> for completions that take images alongside the prompt.
/// It is a separate interface so existing <see cref="ILanguageModel"/> implementers keep compiling:
/// an implementer that cannot take images simply does not implement it. A model without the
/// <see cref="Cratis.AI.Providers.AIModelCapability.Vision"/> capability answers with a failed
/// <see cref="LanguageModelResult"/> that says so - it never silently drops the images. Usage is
/// metered under the purpose exactly like a text completion.
/// </summary>
public interface IVisionLanguageModel
{
    /// <summary>
    /// Asks the model to complete a prompt about one or more images.
    /// </summary>
    /// <param name="prompt">The prompt.</param>
    /// <param name="images">The images the prompt is about. An empty list behaves exactly like <see cref="ILanguageModel.Complete"/>.</param>
    /// <param name="purpose">What the completion is for - the caller, so usage can be attributed to it.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The <see cref="LanguageModelResult"/>.</returns>
    Task<LanguageModelResult> Complete(string prompt, IReadOnlyList<LanguageModelImage> images, LanguageModelPurpose purpose, CancellationToken cancellationToken = default);
}
