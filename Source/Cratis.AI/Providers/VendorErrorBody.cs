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
    /// <param name="redaction">What the failed request sent and asked for.</param>
    /// <param name="cancellationToken">The caller's cancellation token.</param>
    /// <returns>The bounded, redacted diagnostic text.</returns>
    internal static async Task<string> Read(HttpResponseMessage response, VendorRedaction redaction, CancellationToken cancellationToken)
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

            return Redact(text, redaction);
        }
        catch (Exception)
        {
            // Diagnostics must not turn the vendor's HTTP failure into a second failure, including
            // content/stream implementations that ignore cancellation or throw while opening.
            return "unavailable";
        }
    }

    /// <summary>
    /// Withholds credentials and bounds the remaining UTF-8 text. The request's configured credentials
    /// are withheld by exact value first; the request's own model and provider ids are exempted by
    /// exact value from the credential patterns, which themselves stay broad.
    /// </summary>
    /// <param name="text">The vendor diagnostic text.</param>
    /// <param name="redaction">What the failed request sent and asked for, or <see langword="null"/> for patterns only.</param>
    /// <returns>Credential-free, bounded text.</returns>
    internal static string Redact(string text, VendorRedaction? redaction = null)
    {
        redaction ??= VendorRedaction.None;

        // Decode JSON string escapes before matching, so an escaped key is withheld too.
        var normalized = JsonStrings().Replace(text, match => RedactJsonString(match.Value, redaction));
        var redacted = Scrub(normalized, redaction);
        if (Encoding.UTF8.GetByteCount(redacted) <= Limit)
        {
            return redacted;
        }

        Encoding.UTF8.GetEncoder().Convert(redacted.AsSpan(), new byte[Limit], true, out var charactersUsed, out _, out _);

        return redacted[..charactersUsed];
    }

    static string RedactJsonString(string text, VendorRedaction redaction)
    {
        try
        {
            var value = JsonSerializer.Deserialize<string>(text)!;
            var redacted = Scrub(value, redaction);

            return value == redacted ? text : JsonSerializer.Serialize(redacted);
        }
        catch (JsonException)
        {
            return text;
        }
    }

    static string Scrub(string text, VendorRedaction redaction)
    {
        // Exact configured credentials go first, so a short or oddly shaped key is withheld before any
        // pattern could split or miss it.
        var scrubbed = redaction.Secrets.Aggregate(text, (current, secret) => current.Replace(secret, "[redacted]", StringComparison.Ordinal));

        // The request's own ids are parked behind a marker no pattern can match, then restored, so the
        // exemption is the exact string and the patterns are not narrowed.
        scrubbed = redaction.Preserved
            .Select((value, index) => (value, marker: $"~keep{index}~"))
            .Aggregate(scrubbed, (current, entry) => current.Replace(entry.value, entry.marker, StringComparison.Ordinal));
        scrubbed = Credentials().Replace(scrubbed, "[redacted]");

        return redaction.Preserved
            .Select((value, index) => (value, marker: $"~keep{index}~"))
            .Aggregate(scrubbed, (current, entry) => current.Replace(entry.marker, entry.value, StringComparison.Ordinal));
    }

    [GeneratedRegex(@"""(?:\\.|[^""\\])*""", RegexOptions.CultureInvariant, 100)]
    private static partial Regex JsonStrings();

    [GeneratedRegex(@"\bsk-[A-Za-z0-9_+/=\-]*|Bearer\s+[^\s""'<>;,}]+|[A-Za-z0-9_+/=\-]{32,}", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, 100)]
    private static partial Regex Credentials();

    [GeneratedRegex(@"[A-Za-z0-9_+/=\-]+$", RegexOptions.CultureInvariant, 100)]
    private static partial Regex TrailingToken();
}
