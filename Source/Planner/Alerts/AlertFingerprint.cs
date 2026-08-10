// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Alerts;

/// <summary>
/// What makes an alert the same alert across deliveries - the sending system's own stable key for
/// the condition, for instance <c>pod:studio/loki-0:CrashLoopBackOff</c>. A watchdog that re-reports
/// an unresolved condition every few minutes sends the same fingerprint every time, which is what
/// keeps one condition one alert instead of hundreds.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record AlertFingerprint(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset fingerprint.
    /// </summary>
    public static readonly AlertFingerprint NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="AlertFingerprint"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AlertFingerprint(string value) => new(value);
}
