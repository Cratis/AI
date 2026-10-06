// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Globalization;
using System.Net;
using System.Text.Json;

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// What a vendor usage surface answered.
/// </summary>
/// <param name="Status">The HTTP status code.</param>
/// <param name="Body">The response body.</param>
internal sealed record CapacityResponse(HttpStatusCode Status, string Body)
{
    /// <summary>
    /// Gets a value indicating whether the vendor answered successfully.
    /// </summary>
    public bool Succeeded => (int)Status is >= 200 and < 300;

    /// <summary>
    /// Describes a failed answer without echoing the body, which some vendors fill with request details.
    /// </summary>
    /// <param name="vendor">The vendor's usage surface, for the description.</param>
    /// <returns>The description.</returns>
    public string Describe(string vendor) => Status == HttpStatusCode.TooManyRequests
        ? $"{vendor} rate limited the usage read"
        : $"{vendor} answered the usage read with {(int)Status} {Status}";
}

/// <summary>
/// The one GET every vendor usage surface is read with - bounded by a timeout, and never echoing a
/// credential into an exception or log.
/// </summary>
internal static class CapacityRequests
{
    /// <summary>
    /// Sends a GET to a vendor usage surface.
    /// </summary>
    /// <param name="httpClientFactory">Creates the <see cref="HttpClient"/>.</param>
    /// <param name="url">Where to send it.</param>
    /// <param name="headers">The headers - including the credential.</param>
    /// <param name="timeout">How long the vendor may take.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>What the vendor answered.</returns>
    /// <exception cref="HttpRequestException">Thrown when the vendor could not be reached or did not answer within <paramref name="timeout"/>.</exception>
    public static async Task<CapacityResponse> Get(
        IHttpClientFactory httpClientFactory,
        string url,
        IEnumerable<KeyValuePair<string, string>> headers,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        using var httpClient = httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        foreach (var (name, value) in headers)
        {
            request.Headers.TryAddWithoutValidation(name, value);
        }

        request.Headers.TryAddWithoutValidation("Accept", "application/json");
        request.Headers.TryAddWithoutValidation("User-Agent", "Cratis.AI");

        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(timeout);
        try
        {
            using var response = await httpClient.SendAsync(request, deadline.Token);
            var body = await response.Content.ReadAsStringAsync(deadline.Token);
            return new(response.StatusCode, body);
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            throw new HttpRequestException($"The usage read did not answer within {timeout}", exception);
        }
    }
}

/// <summary>
/// Tolerant readers for vendor usage JSON - every vendor surface read here is undocumented, so a
/// missing field, a number sent as a string or a null is read as "not stated" rather than thrown on.
/// </summary>
internal static class CapacityJson
{
    /// <summary>
    /// Reads a named property, when it is present and not null.
    /// </summary>
    /// <param name="element">The object to read from.</param>
    /// <param name="name">The property name.</param>
    /// <returns>The property, or <see langword="null"/>.</returns>
    public static JsonElement? Property(JsonElement? element, string name) =>
        element is { ValueKind: JsonValueKind.Object } value && value.TryGetProperty(name, out var property) && property.ValueKind is not (JsonValueKind.Null or JsonValueKind.Undefined)
            ? property
            : null;

    /// <summary>
    /// Reads a named number, whether sent as a number or as a numeric string.
    /// </summary>
    /// <param name="element">The object to read from.</param>
    /// <param name="name">The property name.</param>
    /// <returns>The number, or <see langword="null"/>.</returns>
    public static double? Number(JsonElement? element, string name) => Property(element, name) switch
    {
        { ValueKind: JsonValueKind.Number } number => number.GetDouble(),
        { ValueKind: JsonValueKind.String } text when double.TryParse(text.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed) => parsed,
        _ => null
    };

    /// <summary>
    /// Reads a named string.
    /// </summary>
    /// <param name="element">The object to read from.</param>
    /// <param name="name">The property name.</param>
    /// <returns>The string, or <see langword="null"/>.</returns>
    public static string? Text(JsonElement? element, string name) => Property(element, name) switch
    {
        { ValueKind: JsonValueKind.String } text => text.GetString(),
        { ValueKind: JsonValueKind.Number } number => number.GetRawText(),
        _ => null
    };

    /// <summary>
    /// Reads a named boolean.
    /// </summary>
    /// <param name="element">The object to read from.</param>
    /// <param name="name">The property name.</param>
    /// <returns>The boolean, or <see langword="null"/>.</returns>
    public static bool? Flag(JsonElement? element, string name) => Property(element, name) switch
    {
        { ValueKind: JsonValueKind.True } => true,
        { ValueKind: JsonValueKind.False } => false,
        _ => null
    };

    /// <summary>
    /// Reads a named timestamp, sent as an ISO 8601 string.
    /// </summary>
    /// <param name="element">The object to read from.</param>
    /// <param name="name">The property name.</param>
    /// <returns>The timestamp, or <see langword="null"/>.</returns>
    public static DateTimeOffset? Timestamp(JsonElement? element, string name) =>
        Text(element, name) is { } text && DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var timestamp)
            ? timestamp
            : null;

    /// <summary>
    /// Turns a percentage into a fraction of 1, clamped.
    /// </summary>
    /// <param name="percent">The percentage, 0 to 100.</param>
    /// <returns>The fraction.</returns>
    public static double Fraction(double percent) => Math.Clamp(percent / 100d, 0d, 1d);
}
