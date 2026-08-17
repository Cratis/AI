// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work.Authorizing;

/// <summary>
/// Reads the work token a caller presented as an HTTP bearer credential.
/// </summary>
/// <remarks>
/// Anything that is not a well-formed <c>Authorization: Bearer &lt;token&gt;</c> reads as
/// <see cref="WorkToken.NotSet"/>, which never matches an issued token - so a missing, malformed or
/// wrong-scheme header and a wrong token all take the same rejection path.
/// </remarks>
public static class BearerToken
{
    /// <summary>
    /// The header a caller presents its credential in.
    /// </summary>
    public const string Header = "Authorization";

    /// <summary>
    /// The authentication scheme the credential is presented with.
    /// </summary>
    public const string Scheme = "Bearer";

    /// <summary>
    /// Reads the presented token from a request.
    /// </summary>
    /// <param name="request">The <see cref="HttpRequest"/> to read from.</param>
    /// <returns>The presented <see cref="WorkToken"/>, or <see cref="WorkToken.NotSet"/> when the request carries none.</returns>
    public static WorkToken From(HttpRequest request)
    {
        var header = request.Headers[Header].ToString();
        if (!header.StartsWith($"{Scheme} ", StringComparison.OrdinalIgnoreCase))
        {
            return WorkToken.NotSet;
        }

        var value = header[(Scheme.Length + 1)..].Trim();

        return string.IsNullOrEmpty(value) ? WorkToken.NotSet : new WorkToken(value);
    }
}
