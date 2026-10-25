// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Globalization;

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// Words used to describe a provider's capacity.
/// </summary>
static class CapacityText
{
    /// <summary>
    /// Formats a fraction as a whole percentage the same way in every culture.
    /// </summary>
    /// <param name="fraction">The fraction, from 0 to 1.</param>
    /// <returns>The percentage, for example <c>83%</c>.</returns>
    internal static string Percent(double fraction) =>
        $"{Math.Round(fraction * 100, MidpointRounding.AwayFromZero).ToString(CultureInfo.InvariantCulture)}%";
}
