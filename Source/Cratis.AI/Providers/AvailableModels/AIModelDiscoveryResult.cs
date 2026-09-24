// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
namespace Cratis.AI.Providers.AvailableModels;

/// <summary>
/// The outcome of asking a configured provider for its model catalog.
/// </summary>
/// <param name="Models">The authentic provider catalog, which may be empty.</param>
/// <param name="Failure">A retryable failure description, or an empty string when discovery succeeded.</param>
public record AIModelDiscoveryResult(IReadOnlyList<ModelName> Models, string Failure)
{
    /// <summary>
    /// Gets whether discovery succeeded, independently of whether the catalog is empty.
    /// </summary>
    public bool Succeeded => string.IsNullOrEmpty(Failure);

    /// <summary>
    /// The outcome for a catalog that was read - possibly an empty one, which is a real answer and
    /// not the same thing as not having been able to ask.
    /// </summary>
    /// <param name="models">The models the provider published.</param>
    /// <returns>The outcome.</returns>
    public static AIModelDiscoveryResult Discovered(IReadOnlyList<ModelName> models) => new(models, string.Empty);

    /// <summary>
    /// The outcome for a catalog that could not be read.
    /// </summary>
    /// <param name="failure">Why it could not be read, in words an operator can act on.</param>
    /// <returns>The outcome.</returns>
    public static AIModelDiscoveryResult Failed(string failure) => new([], failure);
}
