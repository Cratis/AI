// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels;

/// <summary>
/// The exception that is thrown when a provider model catalog cannot be read.
/// </summary>
public class ModelCatalogUnavailable : Exception
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ModelCatalogUnavailable"/> class for an HTTP failure.
    /// </summary>
    /// <param name="url">The catalog URL.</param>
    /// <param name="statusCode">The returned status code.</param>
    public ModelCatalogUnavailable(string url, int statusCode)
        : base($"Model discovery at {url} returned HTTP {statusCode}.")
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="ModelCatalogUnavailable"/> class for a transport or payload failure.
    /// </summary>
    /// <param name="url">The catalog URL.</param>
    /// <param name="innerException">The underlying failure.</param>
    public ModelCatalogUnavailable(string url, Exception innerException)
        : base($"Model discovery at {url} could not be completed.", innerException)
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="ModelCatalogUnavailable"/> class for a provider
    /// that cannot be asked at all - no credential, no endpoint, or a vendor that publishes no
    /// catalog. Distinct from an empty catalog, which is an answer.
    /// </summary>
    /// <param name="vendor">The vendor that could not be asked.</param>
    /// <param name="reason">Why, in words an operator can act on.</param>
    public ModelCatalogUnavailable(string vendor, string reason)
        : base($"{vendor} could not be asked for its models - {reason}.")
    {
    }
}
