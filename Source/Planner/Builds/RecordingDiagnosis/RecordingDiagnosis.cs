// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Builds.RecordingDiagnosis;

/// <summary>
/// Command for recording what the language model made of a newly failing build - executed by the
/// build failure analysis reactor.
/// </summary>
/// <param name="Workflow">The identity of the workflow.</param>
/// <param name="Diagnosis">What the language model thinks is wrong.</param>
/// <param name="Fixable">Whether the language model judged an agent could plausibly fix it.</param>
[Command]
public record RecordBuildDiagnosis(BuildWorkflowId Workflow, BuildDiagnosis Diagnosis, bool Fixable)
{
    /// <summary>
    /// Handles the command by appending a <see cref="BuildDiagnosisRecorded"/> event to the
    /// workflow's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public BuildDiagnosisRecorded Handle() => new(Diagnosis, Fixable);
}

/// <summary>
/// Event raised when the language model has diagnosed a newly failing build.
/// </summary>
/// <param name="Diagnosis">What the language model thinks is wrong.</param>
/// <param name="Fixable">Whether the language model judged an agent could plausibly fix it.</param>
[EventType]
public record BuildDiagnosisRecorded(BuildDiagnosis Diagnosis, bool Fixable);
