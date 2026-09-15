// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Abstractions;

/// <summary>
/// How urgent an <see cref="AIAlert"/> is.
/// </summary>
public enum AIAlertSeverity
{
    /// <summary>
    /// Informational - nothing is broken, but it is worth knowing.
    /// </summary>
    Information = 0,

    /// <summary>
    /// Something degraded but the system is still serving traffic.
    /// </summary>
    Warning = 1,

    /// <summary>
    /// Something is broken and needs attention.
    /// </summary>
    Error = 2,
}
