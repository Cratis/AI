// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues;

/// <summary>
/// What kind of issue triage classified this as.
/// </summary>
public enum IssueKind
{
    /// <summary>Not classified yet.</summary>
    Unclassified = 0,

    /// <summary>Something is broken.</summary>
    Bug = 1,

    /// <summary>A request for new capability.</summary>
    Feature = 2,

    /// <summary>A question, not a change request.</summary>
    Question = 3,

    /// <summary>A documentation gap or correction.</summary>
    Docs = 4,

    /// <summary>Maintenance work with no user-visible behavior change.</summary>
    Chore = 5,

    /// <summary>A request for help using the product, not a defect or a feature.</summary>
    Support = 6,
}

/// <summary>
/// Whether triage judged an issue as something an agent can act on.
/// </summary>
public enum IssueFeasibility
{
    /// <summary>Not classified yet.</summary>
    Unclassified = 0,

    /// <summary>An agent can plan and implement this without a person deciding anything first.</summary>
    AgentCanDo = 1,

    /// <summary>Someone has to make a product or design decision before any work starts.</summary>
    NeedsHumanDecision = 2,

    /// <summary>The report is not specific enough to act on yet.</summary>
    NeedsMoreInformation = 3,

    /// <summary>Not something to act on - out of scope, wontfix, or otherwise closed by judgment.</summary>
    NotActionable = 4,

    /// <summary>Looks like a duplicate of existing work.</summary>
    Duplicate = 5,
}
