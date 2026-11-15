// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.ReverseProxy.Protocols;

namespace Cratis.AI.ReverseProxy.Endpoints;

/// <summary>
/// Somewhere models are served from: a base address, the protocols it speaks and the models it has. The address is only
/// meaningful to the <see cref="Transport.IModelTransport"/> that reaches it - a tunnel may carry it to another machine.
/// </summary>
/// <param name="Id">A DNS-label-safe identity, unique among endpoints. Used as the host name inside the proxy.</param>
/// <param name="Name">What people call it.</param>
/// <param name="BaseUrl">The backend's address without a trailing <c>/v1</c>, for example <c>http://localhost:11434</c>.</param>
/// <param name="Protocols">The protocols the backend answers.</param>
/// <param name="Models">The models it serves.</param>
/// <param name="ApiKey">The credential the backend wants, when it wants one. Never sent to callers.</param>
public record ModelEndpoint(
    string Id,
    string Name,
    string BaseUrl,
    AIProtocol Protocols,
    IReadOnlyList<ServedModel> Models,
    string ApiKey = "")
{
    /// <summary>
    /// Whether an identity is usable as a <see cref="Id"/>: a lowercase DNS label.
    /// </summary>
    /// <param name="id">The candidate.</param>
    /// <returns>True when it is one to 63 lowercase letters, digits or hyphens, not starting or ending with a hyphen.</returns>
    public static bool IsValidId(string id) =>
        id.Length is >= 1 and <= 63 &&
        id.All(character => character is (>= 'a' and <= 'z') or (>= '0' and <= '9') or '-') &&
        id[0] != '-' && id[^1] != '-';

    /// <summary>
    /// Normalizes a backend address: no trailing slash and no trailing <c>/v1</c>, which requests carry themselves.
    /// </summary>
    /// <param name="baseUrl">The address as typed.</param>
    /// <returns>The address as the proxy appends request paths to it.</returns>
    public static string NormalizeBaseAddress(string baseUrl)
    {
        var trimmed = baseUrl.Trim().TrimEnd('/');
        return trimmed.EndsWith("/v1", StringComparison.OrdinalIgnoreCase) ? trimmed[..^3] : trimmed;
    }

    /// <summary>
    /// Whether this endpoint serves a model over a protocol.
    /// </summary>
    /// <param name="model">The model name as the caller sent it.</param>
    /// <returns>True when the endpoint lists the model, ignoring case.</returns>
    public bool Serves(string model) => Models.Any(served => served.Name.Equals(model, StringComparison.OrdinalIgnoreCase));
}
