// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Cratis.AI.Providers;

/// <summary>
/// Reads bounded vendor diagnostics without disclosing credentials or delaying the failure indefinitely.
/// </summary>
internal static partial class VendorErrorBody
{
    /// <summary>
    /// The maximum UTF-8 byte count retained from the vendor body.
    /// </summary>
    internal const int Limit = 2048;
    static readonly TimeSpan _readTimeout = TimeSpan.FromSeconds(1);

    /// <summary>
    /// Reads and redacts a vendor response body, or reports it unavailable.
    /// </summary>
    /// <param name="response">The vendor response.</param>
    /// <param name="cancellationToken">The caller's cancellation token.</param>
    /// <returns>The bounded, redacted diagnostic text.</returns>
    internal static async Task<string> Read(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(_readTimeout);
        try
        {
            var stream = await response.Content.ReadAsStreamAsync(deadline.Token).WaitAsync(deadline.Token);
            var buffer = new byte[Limit];
            var count = 0;
            while (count < buffer.Length)
            {
                var read = await stream.ReadAsync(buffer.AsMemory(count), deadline.Token).AsTask().WaitAsync(deadline.Token);
                if (read == 0)
                {
                    break;
                }

                count += read;
            }

            var text = Encoding.UTF8.GetString(buffer, 0, count);

            // A token cut by the bound may be too short for the credential matcher. Withhold its
            // trailing fragment too, rather than leaking the beginning of a truncated credential.
            if (count == Limit)
            {
                text = TrailingToken().Replace(text, "[redacted]");
            }

            return Redact(text);
        }
        catch (Exception)
        {
            // Diagnostics must not turn the vendor's HTTP failure into a second failure, including
            // content/stream implementations that ignore cancellation or throw while opening.
            return "unavailable";
        }
    }

    /// <summary>
    /// Withholds recognizable credentials and bounds the remaining UTF-8 text.
    /// </summary>
    /// <param name="text">The vendor diagnostic text.</param>
    /// <returns>Credential-free, bounded text.</returns>
    internal static string Redact(string text)
    {
        // Decode JSON string escapes before matching, so an escaped key is withheld too.
        var normalized = JsonStrings().Replace(text, match => RedactJsonString(match.Value));
        var redacted = Credentials().Replace(normalized, "[redacted]");
        if (Encoding.UTF8.GetByteCount(redacted) <= Limit)
        {
            return redacted;
        }

        Encoding.UTF8.GetEncoder().Convert(redacted.AsSpan(), new byte[Limit], true, out var charactersUsed, out _, out _);

        return redacted[..charactersUsed];
    }

    static string RedactJsonString(string text)
    {
        try
        {
            var value = JsonSerializer.Deserialize<string>(text)!;
            var redacted = Credentials().Replace(value, "[redacted]");

            return value == redacted ? text : JsonSerializer.Serialize(redacted);
        }
        catch (JsonException)
        {
            return text;
        }
    }

    [GeneratedRegex(@"""(?:\\.|[^""\\])*""", RegexOptions.CultureInvariant, 100)]
    private static partial Regex JsonStrings();

    [GeneratedRegex(@"\bsk-[A-Za-z0-9_+/=\-]*|Bearer\s+[^\s""'<>;,}]+|[A-Za-z0-9_+=\-]{32,}", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, 100)]
    private static partial Regex Credentials();

    [GeneratedRegex(@"[A-Za-z0-9_+/=\-]+$", RegexOptions.CultureInvariant, 100)]
    private static partial Regex TrailingToken();
}
