// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Globalization;

namespace Cratis.AI.Common;

/// <summary>
/// An ISO calendar day identifier (<c>yyyy-MM-dd</c>, UTC), used to bucket usage data by day - the
/// daily counterpart to <see cref="WeekKey"/> and <see cref="MonthKey"/>.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record DayKey(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset day key.
    /// </summary>
    public static readonly DayKey NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="DayKey"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator DayKey(string value) => new(value);

    /// <summary>
    /// Gets the <see cref="DayKey"/> for the UTC day a given point in time falls into.
    /// </summary>
    /// <param name="timestamp">The point in time to resolve the day for.</param>
    /// <returns>The resolved <see cref="DayKey"/>.</returns>
    public static DayKey For(DateTimeOffset timestamp) =>
        timestamp.UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    /// <summary>
    /// Gets the <see cref="DateOnly"/> this key represents.
    /// </summary>
    /// <returns>The calendar day, or <see cref="DateOnly.MinValue"/> when the key is unset.</returns>
    public DateOnly ToDateOnly() =>
        DateOnly.TryParseExact(Value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var day)
            ? day
            : DateOnly.MinValue;
}
