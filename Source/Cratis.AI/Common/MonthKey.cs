// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Globalization;

namespace Cratis.AI.Common;

/// <summary>
/// A calendar month identifier (<c>yyyy-MM</c>), used to bucket usage data by calendar month. Ported
/// from Direct's <c>Common.MonthKey</c> (plan Section 5.3a).
/// </summary>
/// <param name="Value">The underlying value.</param>
public record MonthKey(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset month key.
    /// </summary>
    public static readonly MonthKey NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="MonthKey"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator MonthKey(string value) => new(value);

    /// <summary>
    /// Gets the <see cref="MonthKey"/> for the calendar month a given point in time falls into.
    /// </summary>
    /// <param name="timestamp">The point in time to resolve the month for.</param>
    /// <returns>The resolved <see cref="MonthKey"/>.</returns>
    public static MonthKey For(DateTimeOffset timestamp) => timestamp.UtcDateTime.ToString("yyyy-MM", CultureInfo.InvariantCulture);
}
