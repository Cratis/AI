// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Globalization;

namespace Cratis.AI.Common;

/// <summary>
/// An ISO week identifier (<c>yyyy-Www</c>), used to bucket usage data by calendar week. Ported from
/// Direct's <c>Common.WeekKey</c> (plan Section 5.3a).
/// </summary>
/// <param name="Value">The underlying value.</param>
public record WeekKey(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset week key.
    /// </summary>
    public static readonly WeekKey NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="WeekKey"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator WeekKey(string value) => new(value);

    /// <summary>
    /// Gets the <see cref="WeekKey"/> for the ISO week a given point in time falls into.
    /// </summary>
    /// <param name="timestamp">The point in time to resolve the week for.</param>
    /// <returns>The resolved <see cref="WeekKey"/>.</returns>
    public static WeekKey For(DateTimeOffset timestamp)
    {
        var date = timestamp.UtcDateTime;
        return $"{ISOWeek.GetYear(date)}-W{ISOWeek.GetWeekOfYear(date):D2}";
    }
}
