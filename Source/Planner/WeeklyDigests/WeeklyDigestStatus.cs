// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.WeeklyDigests;

/// <summary>
/// Where a weekly digest entry stands in its lifecycle.
/// </summary>
public enum WeeklyDigestStatus
{
    /// <summary>Received, waiting for the language model to extract themes and a description.</summary>
    Received = 0,

    /// <summary>Ready for review - themes and a description exist, nothing published yet.</summary>
    Unpublished = 1,

    /// <summary>Published.</summary>
    Published = 2,
}
