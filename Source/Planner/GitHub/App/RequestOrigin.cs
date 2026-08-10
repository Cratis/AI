// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Primitives;

namespace Planner.GitHub.App;

/// <summary>
/// Resolves the publicly reachable origin a request actually arrived on.
/// </summary>
/// <remarks>
/// GitHub sends the operator's browser to whatever URLs the App manifest carries, so those have to be
/// addresses a browser outside the cluster can reach. The Planner's own configured addresses are not:
/// the worker callback URL is an in-cluster service name (<c>http://planner</c>), and behind a reverse
/// proxy the request's own scheme and host are the internal ones too. What the browser asked for is
/// recorded by the proxy in <c>X-Forwarded-Proto</c> and <c>X-Forwarded-Host</c>, so those win when
/// present and the request's own values are the fallback for a direct hit.
/// </remarks>
public static class RequestOrigin
{
    /// <summary>
    /// The header a reverse proxy records the client's scheme in.
    /// </summary>
    public const string ForwardedProtoHeader = "X-Forwarded-Proto";

    /// <summary>
    /// The header a reverse proxy records the client's host in.
    /// </summary>
    public const string ForwardedHostHeader = "X-Forwarded-Host";

    /// <summary>
    /// Resolves the scheme and host the client reached the Planner on.
    /// </summary>
    /// <param name="request">The <see cref="HttpRequest"/> to resolve from.</param>
    /// <returns>The origin as <c>scheme://host</c>, with no trailing slash.</returns>
    public static string From(HttpRequest request)
    {
        var scheme = Forwarded(request.Headers[ForwardedProtoHeader]) ?? request.Scheme;
        var host = Forwarded(request.Headers[ForwardedHostHeader]) ?? request.Host.Value;

        return $"{scheme}://{host}";
    }

    /// <summary>
    /// Reads the client-facing value out of a forwarding header. A request that passed through several
    /// proxies carries one entry per hop, oldest first - the client's own value is the first one.
    /// </summary>
    /// <param name="values">The header values to read.</param>
    /// <returns>The client-facing value, or <see langword="null"/> when the header carries nothing usable.</returns>
    static string? Forwarded(StringValues values)
    {
        var header = values.ToString();
        if (string.IsNullOrWhiteSpace(header))
        {
            return null;
        }

        var first = header.Split(',')[0].Trim();

        return string.IsNullOrEmpty(first) ? null : first;
    }
}
