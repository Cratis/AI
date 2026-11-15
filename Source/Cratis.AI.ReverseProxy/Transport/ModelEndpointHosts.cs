// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.ReverseProxy.Transport;

/// <summary>
/// The placeholder host names the proxy gives its destinations: <c>{endpoint-id}.models.proxy</c>. Nothing resolves them; the
/// <see cref="ModelTransportHandler"/> reads the endpoint back out and hands the request to the transport instead.
/// </summary>
public static class ModelEndpointHosts
{
    /// <summary>
    /// The domain every placeholder host lives under.
    /// </summary>
    public const string Domain = "models.proxy";

    /// <summary>
    /// Gets the destination address for an endpoint.
    /// </summary>
    /// <param name="endpointId">The endpoint identity.</param>
    /// <returns>The address.</returns>
    public static string AddressOf(string endpointId) => $"http://{endpointId}.{Domain}/";

    /// <summary>
    /// Reads the endpoint identity out of a placeholder host.
    /// </summary>
    /// <param name="host">The host.</param>
    /// <param name="endpointId">The identity, when the host is one of ours.</param>
    /// <returns>True when it is.</returns>
    public static bool TryGetEndpointId(string host, out string endpointId)
    {
        var suffix = $".{Domain}";
        if (host.EndsWith(suffix, StringComparison.OrdinalIgnoreCase) && host.Length > suffix.Length)
        {
            endpointId = host[..^suffix.Length].ToLowerInvariant();
            return true;
        }

        endpointId = string.Empty;
        return false;
    }
}
