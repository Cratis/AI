// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues;

/// <summary>
/// The Planner's internal status of an issue - deliberately separate from anything GitHub tracks.
/// </summary>
public enum IssueStatus
{
    /// <summary>The issue has no internal status - the default.</summary>
    None = 0,

    /// <summary>The issue can be scheduled for development as soon as capacity allows. An issue in a
    /// group waits until every issue in the group is ready.</summary>
    ReadyForDevelopment = 1,

    /// <summary>An agent is working on the issue.</summary>
    InProgress = 2,

    /// <summary>The work is done and awaits review - the issue has an associated pull request.</summary>
    ForReview = 3
}
