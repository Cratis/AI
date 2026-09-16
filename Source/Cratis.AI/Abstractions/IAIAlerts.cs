// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Abstractions;

/// <summary>
/// Operational signalling for conditions the package cannot resolve on its own. Direct raises these
/// through <c>Alerts.Raising</c>; a consumer that has no alerting system gets <see cref="NoOpAIAlerts"/>.
/// </summary>
public interface IAIAlerts
{
    /// <summary>
    /// Raises an alert.
    /// </summary>
    /// <param name="alert">The <see cref="AIAlert"/> to raise.</param>
    /// <returns>Awaitable task.</returns>
    Task Raise(AIAlert alert);
}
