// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// What a failed vendor request knows about itself: the credentials it sent, which are withheld by
/// exact value, and the identifiers it asked for, which stay readable.
/// </summary>
/// <param name="Secrets">The exact credential values to withhold, whatever they look like.</param>
/// <param name="Preserved">The exact identifiers (request model, provider id) exempted from pattern redaction.</param>
internal sealed record VendorRedaction(IReadOnlyList<string> Secrets, IReadOnlyList<string> Preserved)
{
    /// <summary>
    /// A redaction with no request context: only the credential patterns apply.
    /// </summary>
    internal static readonly VendorRedaction None = new([], []);

    /// <summary>
    /// Builds the redaction for a failed request.
    /// </summary>
    /// <param name="apiKey">The credential the request was authenticated with, if any.</param>
    /// <param name="model">The model the request asked for.</param>
    /// <param name="providerId">The configured provider the request was sent as.</param>
    /// <returns>The <see cref="VendorRedaction"/>.</returns>
    internal static VendorRedaction For(AIProviderApiKey? apiKey, string model, AIProviderId providerId)
    {
        var secrets = new List<string>();
        if (apiKey is not null && !string.IsNullOrWhiteSpace(apiKey.Value))
        {
            secrets.Add(apiKey.Value);
            secrets.Add(apiKey.Value.Trim());

            // A vendor may echo the key URL-encoded, where '%' would also split it below the patterns' reach.
            secrets.Add(Uri.EscapeDataString(apiKey.Value.Trim()));
        }

        // A credential is never exempt, even if it is also what the model or provider id says.
        var preserved = new[] { model, providerId.Value.ToString() }
            .Where(value => !string.IsNullOrEmpty(value) && !secrets.Contains(value))
            .Distinct(StringComparer.Ordinal);

        return new(Ordered(secrets), Ordered(preserved));
    }

    static string[] Ordered(IEnumerable<string> values) =>
        [.. values.Distinct(StringComparer.Ordinal).OrderByDescending(value => value.Length)];
}
