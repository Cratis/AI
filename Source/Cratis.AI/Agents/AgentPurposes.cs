// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;
namespace Cratis.AI.Agents;

/// <summary>
/// The purposes the built-in agents serve - one well-known <see cref="LanguageModelPurpose"/> per
/// agent in the <c>DefaultAgents</c> catalog, so code that resolves an acting agent
/// names it through a constant rather than a scattered string.
/// </summary>
public static class AgentPurposes
{
    /// <summary>
    /// General conversation - the default agent other automation reaches for when nothing more
    /// specific applies, and the one that names chat topics from their first message - the System
    /// agent's job.
    /// </summary>
    public static readonly LanguageModelPurpose Conversation = new("Conversation");

    /// <summary>
    /// Classifying a new or reopened issue - Scout's job.
    /// </summary>
    public static readonly LanguageModelPurpose IssueTriage = new("IssueTriage");

    /// <summary>
    /// Checking a newly opened issue against the stated vision - Sentinel's job.
    /// </summary>
    public static readonly LanguageModelPurpose VisionGuardian = new("VisionGuardian");

    /// <summary>
    /// Planning a set of selected issues together - Cartographer's job.
    /// </summary>
    public static readonly LanguageModelPurpose PlanGeneration = new("PlanGeneration");

    /// <summary>
    /// Diagnosing a failing workflow - Mechanic's job.
    /// </summary>
    public static readonly LanguageModelPurpose BuildFailureAnalysis = new("BuildFailureAnalysis");

    /// <summary>
    /// Turning a week of activity into themes and a summary - Chronicler's job.
    /// </summary>
    public static readonly LanguageModelPurpose WeeklyDigestAnalysis = new("WeeklyDigestAnalysis");

    /// <summary>
    /// Judging whether a pull request is safe to merge on its own - Gatekeeper's job.
    /// </summary>
    public static readonly LanguageModelPurpose AutoMergeClassification = new("AutoMergeClassification");

    /// <summary>
    /// Carrying out scheduled units of work in worker containers - Wright's job, and the purpose the
    /// work dispatcher resolves the acting agent by for every <c>WorkPurpose</c>.
    /// </summary>
    public static readonly LanguageModelPurpose WorkExecution = new("WorkExecution");

    /// <summary>
    /// Reading an inbound issue or comment for content that tries to steer an agent into writing
    /// something unsafe - Warden's job, and the first thing that happens to anything a stranger wrote.
    /// </summary>
    public static readonly LanguageModelPurpose SecurityScreening = new("SecurityScreening");

    /// <summary>
    /// Reading an inbound issue or comment for a sales pitch or a breach of the code of conduct -
    /// Steward's job.
    /// </summary>
    public static readonly LanguageModelPurpose ContentModeration = new("ContentModeration");

    /// <summary>
    /// Writing a blog post, a LinkedIn post or a piece of documentation in the organization's own
    /// voice, as a lightweight, in-process AI completion - Scribe's job. Distinct from
    /// <see cref="ContentAuthoring"/>, which drives a full worker session with tools instead of a
    /// single completion.
    /// </summary>
    public static readonly LanguageModelPurpose ContentCreation = new("ContentCreation");

    /// <summary>
    /// Writing a blog post or documentation as a full unit of work in a worker container, with tools
    /// (screenshots, GIFs) available and its own configured harness and AI provider - Bard's job.
    /// Distinct from <see cref="ContentCreation"/>, which stays a lightweight completion.
    /// </summary>
    public static readonly LanguageModelPurpose ContentAuthoring = new("ContentAuthoring");

    /// <summary>
    /// Carrying out scheduled runs of a defined task from the palette - Roadie's job.
    /// </summary>
    public static readonly LanguageModelPurpose TaskExecution = new("TaskExecution");

    /// <summary>
    /// Carrying out scheduled units of work that fix a reported bug - Medic's job.
    /// </summary>
    public static readonly LanguageModelPurpose BugFixing = new("BugFixing");

    /// <summary>
    /// Reading a known venue's announcements page and judging whether a call for papers is currently
    /// open - Herald's job.
    /// </summary>
    public static readonly LanguageModelPurpose SpeakingOpportunityScreening = new("SpeakingOpportunityScreening");
}
