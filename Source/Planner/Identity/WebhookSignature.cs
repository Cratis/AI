// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Cryptography;
using System.Text;

namespace Planner.Identity;

/// <summary>
/// Verifies the HMAC-SHA256 signature a webhook delivery carries over its raw body - the scheme
/// GitHub uses, and the one the Planner asks every other sender to use so a single implementation
/// covers both.
/// </summary>
/// <remarks>
/// This fails closed on purpose. A webhook endpoint is reachable by anyone who knows the URL, and
/// every delivery it accepts turns into agent work or repository state, so an unconfigured secret
/// means the endpoint rejects everything rather than accepting everything.
/// </remarks>
public static class WebhookSignature
{
    /// <summary>
    /// The prefix a signature value carries, naming the algorithm.
    /// </summary>
    public const string Prefix = "sha256=";

    /// <summary>
    /// The number of hex characters a SHA-256 signature is written as.
    /// </summary>
    public const int HexLength = 64;

    /// <summary>
    /// Verifies a delivery's signature against the configured secret.
    /// </summary>
    /// <param name="signature">The signature the delivery presented, as <c>sha256=&lt;hex&gt;</c>.</param>
    /// <param name="body">The raw body exactly as delivered.</param>
    /// <param name="secret">The configured shared secret. Empty rejects every delivery.</param>
    /// <returns><see langword="true"/> only when a secret is configured and the delivery is authentic.</returns>
    public static bool IsValid(string signature, string body, string secret)
    {
        if (string.IsNullOrEmpty(secret))
        {
            return false;
        }

        if (!signature.StartsWith(Prefix, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var provided = signature[Prefix.Length..];
        if (provided.Length != HexLength || !provided.All(char.IsAsciiHexDigit))
        {
            return false;
        }

        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(body));

        return CryptographicOperations.FixedTimeEquals(Convert.FromHexString(provided), expected);
    }
}
